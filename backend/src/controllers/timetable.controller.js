const timetableModel = require(
  "../models/timetable.model",
);

const {
  TIMETABLE_SLOTS,
  WEEK_DAYS,
} = require("../config/timetable.config");

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatDate(date) {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-");
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function getStartOfCurrentWeek() {
  const today = new Date();
  const day = today.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const monday = addDays(today, diffToMonday);
  monday.setHours(0, 0, 0, 0);

  return monday;
}

function buildCurrentWeekDays() {
  const monday = getStartOfCurrentWeek();

  return WEEK_DAYS.map((day, index) => {
    const date = addDays(monday, index);

    return {
      ...day,
      date: formatDate(date),
    };
  });
}

function buildDayDateMap(weekDays) {
  const map = new Map();

  for (const day of weekDays) {
    map.set(Number(day.value), day.date);
  }

  return map;
}

function buildAttendanceMap(attendanceRows) {
  const map = new Map();

  for (const attendance of attendanceRows) {
    if (!attendance.timetableId) {
      continue;
    }

    const key = `${attendance.attendanceDate}-${attendance.timetableId}`;
    map.set(key, attendance);
  }

  return map;
}

function getAttendanceMeta(typeName) {
  const metaMap = {
    PRESENT: {
      key: "PRESENT",
      label: "Có mặt",
      tone: "green",
    },
    LATE: {
      key: "LATE",
      label: "Đi muộn",
      tone: "amber",
    },
    ABSENT_EXCUSED: {
      key: "ABSENT_EXCUSED",
      label: "Vắng có phép",
      tone: "blue",
    },
    ABSENT_UNEXCUSED: {
      key: "ABSENT_UNEXCUSED",
      label: "Vắng không phép",
      tone: "red",
    },
    EARLY_LEAVE: {
      key: "EARLY_LEAVE",
      label: "Về sớm",
      tone: "purple",
    },
  };

  return (
    metaMap[typeName] || {
      key: typeName || "UNKNOWN",
      label: "Đã điểm danh",
      tone: "slate",
    }
  );
}

function getSlotByPeriod(periodNo) {
  return TIMETABLE_SLOTS.find(
    (slot) => Number(slot.periodNo) === Number(periodNo),
  );
}

function isFutureLesson(lessonDate, startTime) {
  if (!lessonDate || !startTime) {
    return false;
  }

  const lessonStart = new Date(`${lessonDate}T${startTime}:00`);

  return lessonStart.getTime() > Date.now();
}

function attachAttendanceToLessons({
  lessons,
  weekDays,
  attendanceRows,
}) {
  const dayDateMap = buildDayDateMap(weekDays);
  const attendanceMap = buildAttendanceMap(attendanceRows);

  return lessons.map((lesson) => {
    const lessonDate =
      lesson.lessonDate ||
      dayDateMap.get(Number(lesson.dayOfWeek));
    const attendanceKey = `${lessonDate}-${lesson.timetableId}`;
    const attendance = attendanceMap.get(attendanceKey);

    if (attendance) {
      const meta = getAttendanceMeta(
        attendance.attendanceTypeName,
      );

      return {
        ...lesson,
        lessonDate,
        attendanceId: attendance.attendanceId,
        attendanceStatus: meta.key,
        attendanceStatusLabel: meta.label,
        attendanceStatusTone: meta.tone,
        attendanceCheckInTime: attendance.checkInTime,
        attendanceCheckOutTime: attendance.checkOutTime,
        attendanceNote: attendance.note,
      };
    }

    const slot = getSlotByPeriod(lesson.periodNo);
    const startTime =
      lesson.startTime ||
      slot?.startTime ||
      "07:30";

    const futureLesson = isFutureLesson(
      lessonDate,
      startTime,
    );

    return {
      ...lesson,
      lessonDate,
      attendanceId: null,
      attendanceStatus: futureLesson
        ? "NOT_YET"
        : "NOT_RECORDED",
      attendanceStatusLabel: futureLesson
        ? "Chưa tới tiết"
        : "Chưa điểm danh",
      attendanceStatusTone: futureLesson
        ? "slate"
        : "orange",
      attendanceCheckInTime: null,
      attendanceCheckOutTime: null,
      attendanceNote: null,
    };
  });
}

async function getMyTimetable(req, res) {
  try {
    const context =
      await timetableModel.findCurrentStudentContext(
        req.user.userId,
      );

    if (!context) {
      return res.status(404).json({
        success: false,
        message:
          "Không tìm thấy lớp học hiện tại của học sinh",
      });
    }

    const weekDays = buildCurrentWeekDays();
    const startDate = weekDays[0]?.date;
    const endDate = weekDays[weekDays.length - 1]?.date;

    const lessons =
      await timetableModel.findLessonsByClassId(
        context.classId,
        { startDate, endDate },
      );

    const attendanceRows =
      await timetableModel.findStudentClassAttendanceByDateRange(
        context.studentId,
        startDate,
        endDate,
      );

    const lessonsWithAttendance = attachAttendanceToLessons({
      lessons,
      weekDays,
      attendanceRows,
    });

    return res.json({
      success: true,

      data: {
        context,
        weekStart: startDate,
        weekEnd: endDate,
        weekDays,
        slots: TIMETABLE_SLOTS,
        lessons: lessonsWithAttendance,
      },
    });
  } catch (error) {
    console.error(
      "getMyTimetable error:",
      error,
    );

    return res.status(500).json({
      success: false,
      message:
        "Không thể tải thời khóa biểu",
    });
  }
}

module.exports = {
  getMyTimetable,
};
