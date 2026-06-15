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

module.exports = {
  getStudentAttendanceStats,
  getStudentAttendanceHistory,
};
