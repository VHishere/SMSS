const parentModel = require("../models/parents");
const attendanceModel = require("../models/attendance.model");

async function getStudentAttendanceStats(req, res) {
  try {
    const studentId = parseInt(req.params.studentId, 10);

    const students = await parentModel.findLinkedStudentsByUserId(req.user.userId);
    const isLinked = students.some((s) => s.studentId === studentId);

    if (!isLinked) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy học sinh hoặc bạn không có quyền xem thông tin này",
      });
    }

    const { startDate, endDate, context } = req.query;

    const rawStats = await attendanceModel.findStatsByStudentId(studentId, {
      startDate,
      endDate,
      context,
    });

    const byType = {};
    const byContext = {};
    let total = 0;

    for (const row of rawStats) {
      const count = Number(row.count);
      total += count;

      byType[row.typeName] = (byType[row.typeName] || 0) + count;

      if (!byContext[row.context]) byContext[row.context] = {};
      byContext[row.context][row.typeName] = (byContext[row.context][row.typeName] || 0) + count;
    }

    return res.json({
      success: true,
      data: { total, byType, byContext },
    });
  } catch (error) {
    console.error("getStudentAttendanceStats error:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể lấy thống kê điểm danh",
    });
  }
}

async function getStudentAttendanceHistory(req, res) {
  try {
    const studentId = parseInt(req.params.studentId, 10);

    const students = await parentModel.findLinkedStudentsByUserId(req.user.userId);
    const isLinked = students.some((s) => s.studentId === studentId);

    if (!isLinked) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy học sinh hoặc bạn không có quyền xem thông tin này",
      });
    }

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

    const students = await parentModel.findLinkedStudentsByUserId(req.user.userId);
    const isLinked = students.some((s) => s.studentId === studentId);

    if (!isLinked) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy học sinh hoặc bạn không có quyền xem thông tin này",
      });
    }

    const now          = new Date();
    const defaultEnd   = now.toISOString().split("T")[0];
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString().split("T")[0];

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

module.exports = {
  getStudentAttendanceStats,
  getStudentAttendanceHistory,
  getStudentAttendanceAnalytics,
};
