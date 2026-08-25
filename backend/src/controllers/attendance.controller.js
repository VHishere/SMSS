const attendanceModel = require("../models/attendance.model");
const attendanceWarningService = require("../services/attendanceWarning.service");
const studentProfileModel = require("../models/studentProfile.model");
const { toIsoDate } = require("../utils/date");

function handleAdminError(res, error, fallback) {
  if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
  console.error(`${fallback}:`, error);
  return res.status(500).json({ success: false, message: fallback });
}

async function getStudentAttendanceHistory(req, res) {
  try {
    const studentId = parseInt(req.params.studentId, 10);

    const {
      startDate,
      endDate,
      context,
      typeId,
      page = "1",
      limit = "20",
    } = req.query;

    const parsedPage  = Math.max(1, parseInt(page, 10));
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10)));

    const { total, rows } = await attendanceModel.findHistoryByStudentId(studentId, {
      page: parsedPage,
      limit: parsedLimit,
      startDate,
      endDate,
      context,
      typeId,
    });

    return res.json({
      success: true,
      data: {
        items: rows,
        pagination: {
          total,
          page: parsedPage,
          limit: parsedLimit,
          totalPages: Math.ceil(total / parsedLimit),
        },
      },
    });
  } catch (error) {
    console.error("getStudentAttendanceHistory error:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể lấy lịch sử điểm danh",
    });
  }
}

async function getStudentAttendanceAnalytics(req, res) {
  try {
    const studentId = parseInt(req.params.studentId, 10);

    const now          = new Date();
    const defaultEnd   = toIsoDate(now);
    const defaultStart = toIsoDate(new Date(now.getFullYear(), now.getMonth(), 1));

    const startDate = req.query.startDate || defaultStart;
    const endDate   = req.query.endDate   || defaultEnd;
    const context   = req.query.context   || null;

    const { typeSummary, timeline } = await attendanceModel.findStudentAttendanceAnalytics(
      studentId, startDate, endDate, context,
    );

    let totalRecords = 0;
    const rawByType  = {};
    for (const row of typeSummary) {
      const count = Number(row.count);
      totalRecords += count;
      rawByType[row.typeName] = count;
    }

    const ALL_TYPES = ["PRESENT", "LATE", "ABSENT_EXCUSED", "ABSENT_UNEXCUSED", "EARLY_LEAVE"];
    const byType    = {};
    for (const t of ALL_TYPES) {
      const count = rawByType[t] || 0;
      byType[t]   = {
        count,
        rate: totalRecords > 0 ? Math.round((count / totalRecords) * 1000) / 10 : 0,
      };
    }

    const TYPE_KEY = {
      PRESENT:          "present",
      LATE:             "late",
      ABSENT_EXCUSED:   "absentExcused",
      ABSENT_UNEXCUSED: "absentUnexcused",
      EARLY_LEAVE:      "earlyLeave",
    };

    const timelineMap = {};
    for (const row of timeline) {
      if (!timelineMap[row.date]) {
        timelineMap[row.date] = {
          date: row.date, present: 0, late: 0,
          absentExcused: 0, absentUnexcused: 0, earlyLeave: 0, total: 0,
        };
      }
      const key   = TYPE_KEY[row.typeName];
      const count = Number(row.count);
      if (key) timelineMap[row.date][key] += count;
      timelineMap[row.date].total += count;
    }

    return res.json({
      success: true,
      data: {
        studentId,
        period:   { startDate, endDate },
        summary:  { totalRecords, byType },
        timeline: Object.values(timelineMap),
      },
    });
  } catch (error) {
    console.error("getStudentAttendanceAnalytics error:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể lấy thống kê điểm danh",
    });
  }
}

// ── Admin (school-wide, any class) ──────────────────────────────────────────

// GET /admin/attendance/meta — every class school-wide + attendance types
async function getMeta(_req, res) {
  try {
    const [classes, attendanceTypes] = await Promise.all([
      studentProfileModel.findAllClasses(),
      attendanceModel.findAttendanceTypes(),
    ]);
    return res.json({ success: true, data: { classes, attendanceTypes } });
  } catch (error) {
    return handleAdminError(res, error, "Không thể lấy dữ liệu khởi tạo");
  }
}

// GET /admin/attendance/classes/:classId/history
async function getHistory(req, res) {
  try {
    const classId = parseInt(req.params.classId, 10);
    const { startDate, endDate, studentId, typeId, page = "1", limit = "20" } = req.query;

    const parsedPage = Math.max(1, parseInt(page, 10));
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10)));

    const { total, rows } = await attendanceModel.findClassAttendanceHistory(classId, {
      page: parsedPage, limit: parsedLimit, startDate, endDate, studentId, typeId,
    });

    return res.json({
      success: true,
      data: {
        items: rows,
        pagination: { total, page: parsedPage, limit: parsedLimit, totalPages: Math.ceil(total / parsedLimit) },
      },
    });
  } catch (error) {
    return handleAdminError(res, error, "Không thể lấy lịch sử điểm danh");
  }
}

// GET /admin/attendance/classes/:classId/analytics?startDate&endDate
async function getAnalytics(req, res) {
  try {
    const classId = parseInt(req.params.classId, 10);

    const now = new Date();
    const defaultEnd = toIsoDate(now);
    const defaultStart = toIsoDate(new Date(now.getFullYear(), now.getMonth(), 1));

    const startDate = req.query.startDate || defaultStart;
    const endDate = req.query.endDate || defaultEnd;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      return res.status(400).json({ success: false, message: "Định dạng ngày không hợp lệ" });
    }

    const classes = await studentProfileModel.findAllClasses();
    const classInfo = classes.find((c) => c.classId === classId);
    if (!classInfo) return res.status(404).json({ success: false, message: "Không tìm thấy lớp" });

    const { typeSummary, timeline, students } =
      await attendanceModel.findClassAttendanceAnalytics(classId, startDate, endDate);

    let totalRecords = 0;
    const rawByType = {};
    for (const row of typeSummary) {
      const count = Number(row.count);
      totalRecords += count;
      rawByType[row.typeName] = count;
    }

    const ALL_TYPES = ["PRESENT", "LATE", "ABSENT_EXCUSED", "ABSENT_UNEXCUSED", "EARLY_LEAVE"];
    const byType = {};
    for (const t of ALL_TYPES) {
      const count = rawByType[t] || 0;
      byType[t] = { count, rate: totalRecords > 0 ? Math.round((count / totalRecords) * 1000) / 10 : 0 };
    }

    const TYPE_KEY = {
      PRESENT: "present",
      LATE: "late",
      ABSENT_EXCUSED: "absentExcused",
      ABSENT_UNEXCUSED: "absentUnexcused",
      EARLY_LEAVE: "earlyLeave",
    };

    const timelineMap = {};
    for (const row of timeline) {
      if (!timelineMap[row.date]) {
        timelineMap[row.date] = {
          date: row.date, present: 0, late: 0,
          absentExcused: 0, absentUnexcused: 0, earlyLeave: 0, total: 0,
        };
      }
      const key = TYPE_KEY[row.typeName];
      const count = Number(row.count);
      if (key) timelineMap[row.date][key] += count;
      timelineMap[row.date].total += count;
    }

    const studentSummary = students.map((s) => {
      const total = Number(s.total);
      const present = Number(s.present);
      const late = Number(s.late);
      const earlyLeave = Number(s.earlyLeave);
      return {
        studentId: s.studentId,
        studentCode: s.studentCode,
        fullName: s.fullName,
        total,
        present,
        late,
        absentExcused: Number(s.absentExcused),
        absentUnexcused: Number(s.absentUnexcused),
        earlyLeave,
        attendanceRate: total > 0 ? Math.round(((present + late + earlyLeave) / total) * 1000) / 10 : 0,
      };
    });

    return res.json({
      success: true,
      data: {
        classId,
        className: classInfo.className,
        period: { startDate, endDate },
        summary: { totalRecords, byType },
        timeline: Object.values(timelineMap),
        students: studentSummary,
      },
    });
  } catch (error) {
    return handleAdminError(res, error, "Không thể lấy thống kê điểm danh");
  }
}

function buildAbsenceStudents(rows, policy) {
  const warnThreshold = policy.maxAbsentSessions * policy.warnRatio;
  const students = rows.map((r) => {
    const absentPeriods = r.absentUnexcused + (policy.countExcused ? r.absentExcused : 0);
    const absentSessions = Math.round((absentPeriods / policy.periodsPerSession) * 100) / 100;
    const level = absentSessions > policy.maxAbsentSessions ? "OVER"
      : absentSessions >= policy.maxAbsentSessions ? "LIMIT"
        : absentSessions >= warnThreshold ? "WARN" : "OK";
    return { ...r, absentPeriods, absentSessions, level };
  });
  return { students, warnThreshold };
}

// GET /admin/attendance/overview?classId — tổng hợp toàn tiết/môn của bất kỳ lớp nào
async function getClassOverview(req, res) {
  try {
    const classId = parseInt(req.query.classId, 10);
    if (!classId) return res.status(400).json({ success: false, message: "Thiếu lớp" });

    const classes = await studentProfileModel.findAllClasses();
    const classInfo = classes.find((c) => c.classId === classId);
    if (!classInfo) return res.status(404).json({ success: false, message: "Không tìm thấy lớp" });

    const year = await attendanceModel.findActiveSchoolYear();
    if (!year) return res.status(404).json({ success: false, message: "Chưa có năm học đang hoạt động" });

    const policy = await attendanceModel.findAbsencePolicy(year.schoolYearId);
    const rows = await attendanceModel.findClassAttendanceOverview(classId, year.startDate, year.endDate);
    const { students, warnThreshold } = buildAbsenceStudents(rows, policy);

    return res.json({
      success: true,
      data: {
        class: { classId, className: classInfo.className, gradeName: classInfo.gradeName },
        schoolYear: year,
        policy,
        warnThreshold: Math.round(warnThreshold * 100) / 100,
        students,
        summary: {
          total: students.length,
          over: students.filter((s) => s.level === "OVER").length,
          limit: students.filter((s) => s.level === "LIMIT").length,
          warn: students.filter((s) => s.level === "WARN").length,
        },
      },
    });
  } catch (error) {
    return handleAdminError(res, error, "Không thể lấy tổng hợp điểm danh");
  }
}

// POST /admin/attendance/warnings/generate  body: { classId } — quét cảnh báo nghỉ + báo PH
async function generateWarnings(req, res) {
  try {
    const classId = parseInt(req.body.classId, 10);
    if (!classId) return res.status(400).json({ success: false, message: "Thiếu lớp" });

    const classes = await studentProfileModel.findAllClasses();
    const classInfo = classes.find((c) => c.classId === classId);
    if (!classInfo) return res.status(404).json({ success: false, message: "Không tìm thấy lớp" });

    const year = await attendanceModel.findActiveSchoolYear();
    if (!year) return res.status(404).json({ success: false, message: "Chưa có năm học đang hoạt động" });

    const students = await attendanceModel.findEnrolledStudents(classId);
    const results = await attendanceWarningService.evaluateStudents({
      studentIds: students.map((student) => student.studentId),
      attendanceDate: year.endDate,
      actorUserId: req.user.userId,
    });
    const generated = results.filter((item) => item.level !== "OK").length;

    return res.json({
      success: true,
      message: `Đã kiểm tra ${students.length} học sinh; ${generated} học sinh đang ở mức cảnh báo trở lên.`,
      data: { generated },
    });
  } catch (error) {
    return handleAdminError(res, error, "Không thể tạo cảnh báo nghỉ học");
  }
}

module.exports = {
  getStudentAttendanceHistory,
  getStudentAttendanceAnalytics,
  getMeta,
  getHistory,
  getAnalytics,
  getClassOverview,
  generateWarnings,
};
