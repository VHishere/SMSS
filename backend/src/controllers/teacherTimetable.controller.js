const teacherModel   = require("../models/teacher.model");
const timetableModel = require("../models/timetable.model");
const { pool } = require("../config/db");
const { WEEK_DAYS, TIMETABLE_SLOTS } = require("../config/timetable.config");

const REQUEST_TYPES = ["SUBSTITUTE", "SWAP", "CANCEL"];

function toDateOnly(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateOrToday(value) {
  if (!value) return new Date();
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function getSchoolWeek(dateValue) {
  const start = parseDateOrToday(dateValue);
  const day = start.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diffToMonday);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 5);

  return {
    startDate: toDateOnly(start),
    endDate: toDateOnly(end),
  };
}

function withWeekDates(startDate) {
  const start = new Date(`${startDate}T00:00:00`);
  return WEEK_DAYS.map((day, index) => {
    const current = new Date(start);
    current.setDate(start.getDate() + index);
    const isoDate = toDateOnly(current);
    const [, month, date] = isoDate.split("-");
    return {
      ...day,
      date: isoDate,
      dateLabel: `${date}/${month}`,
    };
  });
}

async function resolveTeacher(userId) {
  const profile = await teacherModel.findProfileByUserId(userId);
  if (!profile) return null;
  return { teacherId: profile.teacherId, userId, fullName: profile.fullName };
}

function handleError(res, error, fallback) {
  if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
  console.error(`${fallback}:`, error);
  return res.status(500).json({ success: false, message: fallback });
}

async function notify(receivers, title, content) {
  if (!receivers.length) return;
  await pool.query(
    `INSERT INTO notification (receiver_id, title, content, type, related_type, related_id, is_read) VALUES ?`,
    [receivers.map((rid) => [rid, title, content, "TIMETABLE", "TIMETABLE_SUBSTITUTION", null, false])],
  );
}

// GET /teachers/timetable
async function getMyTimetable(req, res) {
  try {
    const teacher = await resolveTeacher(req.user.userId);
    if (!teacher) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });

    const week = getSchoolWeek(req.query.date);
    const lessons = await timetableModel.findLessonsByTeacherId(teacher.teacherId, week);
    return res.json({
      success: true,
      data: {
        context: { fullName: teacher.fullName, ...week },
        weekDays: withWeekDates(week.startDate),
        slots: TIMETABLE_SLOTS,
        lessons,
      },
    });
  } catch (error) {
    return handleError(res, error, "Không thể lấy thời khóa biểu");
  }
}

// GET /teachers/timetable/substitutions/meta  — my lessons + teacher candidates
async function getSubstitutionMeta(req, res) {
  try {
    const teacher = await resolveTeacher(req.user.userId);
    if (!teacher) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });

    const week = getSchoolWeek(req.query.date);
    const [lessons, candidates] = await Promise.all([
      timetableModel.findLessonsByTeacherId(teacher.teacherId, week),
      timetableModel.findTeacherCandidates(teacher.teacherId),
    ]);

    const dayLabel = Object.fromEntries(WEEK_DAYS.map((d) => [d.value, d.label]));
    return res.json({
      success: true,
      data: {
        lessons: lessons.map((l) => ({
          ...l,
          label: `${l.subjectName} · ${l.className} · ${dayLabel[l.dayOfWeek] ?? "?"} tiết ${l.periodNo}`,
        })),
        candidates,
      },
    });
  } catch (error) {
    return handleError(res, error, "Không thể lấy dữ liệu đổi tiết");
  }
}

// GET /teachers/timetable/substitutions  — UC-87 view substitution logs
async function listSubstitutions(req, res) {
  try {
    const teacher = await resolveTeacher(req.user.userId);
    if (!teacher) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });

    const { status, page = "1", limit = "20" } = req.query;
    const parsedPage = Math.max(1, parseInt(page, 10));
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10)));

    const { total, rows } = await timetableModel.findSubstitutionsByRequester(teacher.userId, {
      status, page: parsedPage, limit: parsedLimit,
    });
    return res.json({
      success: true,
      data: { items: rows, pagination: { total, page: parsedPage, limit: parsedLimit, totalPages: Math.ceil(total / parsedLimit) } },
    });
  } catch (error) {
    return handleError(res, error, "Không thể lấy lịch sử đổi tiết");
  }
}

// POST /teachers/timetable/substitutions  — UC-83 submit period-swap request
async function createSubstitution(req, res) {
  try {
    const teacher = await resolveTeacher(req.user.userId);
    if (!teacher) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });

    const { timetableId, requestType, targetDate, substituteTeacherId, swapTimetableId, reason } = req.body;

    if (!timetableId || !requestType || !targetDate) {
      return res.status(400).json({ success: false, message: "Thiếu tiết học, loại yêu cầu hoặc ngày áp dụng" });
    }
    if (!REQUEST_TYPES.includes(requestType)) {
      return res.status(400).json({ success: false, message: "Loại yêu cầu không hợp lệ" });
    }
    if (!reason || !reason.trim()) {
      return res.status(400).json({ success: false, message: "Vui lòng nhập lý do" });
    }
    const _p = (n) => String(n).padStart(2, "0");
    const _now = new Date();
    const _today = `${_now.getFullYear()}-${_p(_now.getMonth() + 1)}-${_p(_now.getDate())}`;
    if (String(targetDate).slice(0, 10) < _today) {
      return res.status(400).json({ success: false, message: "Ngày áp dụng phải từ hôm nay trở đi" });
    }

    // Ownership: the lesson must belong to the requesting teacher
    const lesson = await timetableModel.findLessonById(parseInt(timetableId, 10));
    if (!lesson) return res.status(404).json({ success: false, message: "Không tìm thấy tiết học" });
    if (lesson.teacherId !== teacher.teacherId) {
      return res.status(403).json({ success: false, message: "Bạn không dạy tiết học này" });
    }

    if (requestType === "SUBSTITUTE") {
      if (substituteTeacherId && parseInt(substituteTeacherId, 10) === teacher.teacherId) {
        return res.status(400).json({ success: false, message: "Giáo viên dạy thay phải khác giáo viên yêu cầu" });
      }
      if (substituteTeacherId) {
        const canTeach = await timetableModel.teacherCanTeachSubject(
          parseInt(substituteTeacherId, 10),
          lesson.subjectId,
        );
        if (!canTeach) {
          return res.status(400).json({ success: false, message: "Giáo viên dạy thay không đúng chuyên môn của tiết học" });
        }
      }
    }
    if (requestType === "SWAP" && !swapTimetableId) {
      return res.status(400).json({ success: false, message: "Vui lòng chọn tiết để hoán đổi" });
    }
    if (requestType === "SWAP") {
      const swapLesson = await timetableModel.findLessonById(parseInt(swapTimetableId, 10));
      if (!swapLesson || swapLesson.teacherId !== teacher.teacherId) {
        return res.status(400).json({ success: false, message: "Tiết hoán đổi không hợp lệ" });
      }
    }
    const hasOpenRequest = await timetableModel.hasOpenSubstitutionForLesson(
      parseInt(timetableId, 10),
      targetDate,
    );
    if (hasOpenRequest) {
      return res.status(409).json({ success: false, message: "Tiết học này đã có yêu cầu đang chờ duyệt hoặc đã duyệt" });
    }

    const substitutionId = await timetableModel.createSubstitution({
      timetableId: parseInt(timetableId, 10),
      requesterId: teacher.userId,
      requestType,
      targetDate,
      substituteTeacherId: substituteTeacherId ? parseInt(substituteTeacherId, 10) : null,
      swapTimetableId: swapTimetableId ? parseInt(swapTimetableId, 10) : null,
      reason: reason.trim(),
    });

    // Staff reviews the request before the selected lesson/date changes.
    try {
      const staffUsers = await timetableModel.findStaffUserIds();
      await notify(staffUsers, "Yêu cầu đổi tiết mới",
        `${teacher.fullName} gửi yêu cầu ${requestType} cho tiết ${lesson.subjectName} (${lesson.className}) ngày ${targetDate}.`);
    } catch (e) { console.error("substitution notify (non-critical):", e); }

    return res.status(201).json({ success: true, message: "Đã gửi yêu cầu đổi tiết", data: { substitutionId } });
  } catch (error) {
    return handleError(res, error, "Không thể gửi yêu cầu đổi tiết");
  }
}

// POST /teachers/timetable/substitutions/:substitutionId/cancel
async function cancelSubstitution(req, res) {
  try {
    const substitutionId = parseInt(req.params.substitutionId, 10);
    const teacher = await resolveTeacher(req.user.userId);
    if (!teacher) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });

    const sub = await timetableModel.findSubstitutionById(substitutionId);
    if (!sub) return res.status(404).json({ success: false, message: "Không tìm thấy yêu cầu" });
    if (sub.requesterId !== teacher.userId) return res.status(403).json({ success: false, message: "Bạn không có quyền hủy yêu cầu này" });

    const affected = await timetableModel.cancelSubstitution(substitutionId, teacher.userId);
    if (affected === 0) return res.status(409).json({ success: false, message: "Chỉ hủy được yêu cầu đang chờ duyệt" });
    return res.json({ success: true, message: "Đã hủy yêu cầu" });
  } catch (error) {
    return handleError(res, error, "Không thể hủy yêu cầu");
  }
}

module.exports = {
  getMyTimetable,
  getSubstitutionMeta,
  listSubstitutions,
  createSubstitution,
  cancelSubstitution,
};
