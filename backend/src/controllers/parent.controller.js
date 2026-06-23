const parentModel = require("../models/parents");
const timetableModel = require("../models/timetable.model");
const behaviourModel = require("../models/behaviour.model");
const behaviourService = require("../services/behaviour.service");
const { TIMETABLE_SLOTS, WEEK_DAYS } = require("../config/timetable.config");

async function getMyProfile(req, res) {
  try {
    const parent = await parentModel.findProfileByUserId(req.user.userId);

    if (!parent) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy hồ sơ phụ huynh",
      });
    }

    return res.json({
      success: true,
      data: parent,
    });
  } catch (error) {
    console.error("getMyProfile error:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể lấy hồ sơ phụ huynh",
    });
  }
}

async function getMyStudents(req, res) {
  try {
    const students = await parentModel.findLinkedStudentsByUserId(req.user.userId);

    return res.json({
      success: true,
      data: students,
    });
  } catch (error) {
    console.error("getMyStudents error:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể lấy danh sách học sinh",
    });
  }
}

async function getStudentProfile(req, res) {
  try {
    const studentId = parseInt(req.params.studentId, 10);

    const linked = await parentModel.findLinkedStudentsByUserId(req.user.userId);
    const isLinked = linked.some((s) => s.studentId === studentId);

    if (!isLinked) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy học sinh hoặc bạn không có quyền xem hồ sơ này",
      });
    }

    const student = await parentModel.findStudentDetailByStudentId(studentId);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy hồ sơ học sinh",
      });
    }

    return res.json({
      success: true,
      data: student,
    });
  } catch (error) {
    console.error("getStudentProfile error:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể lấy hồ sơ học sinh",
    });
  }
}

async function getStudentTimetable(req, res) {
  try {
    const studentId = parseInt(req.params.studentId, 10);

    const students = await parentModel.findLinkedStudentsByUserId(req.user.userId);
    const isLinked = students.some((s) => s.studentId === studentId);

    if (!isLinked) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy học sinh hoặc bạn không có quyền xem thời khóa biểu này",
      });
    }

    const context = await timetableModel.findCurrentStudentContextByStudentId(studentId);

    if (!context) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy lớp học hiện tại của học sinh",
      });
    }

    const lessons = await timetableModel.findLessonsByClassId(context.classId);

    return res.json({
      success: true,
      data: {
        context,
        weekDays: WEEK_DAYS,
        slots: TIMETABLE_SLOTS,
        lessons,
      },
    });
  } catch (error) {
    console.error("getStudentTimetable error:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể tải thời khóa biểu của học sinh",
    });
  }
}

async function getStudentGrades(req, res) {
  try {
    const studentId = parseInt(req.params.studentId, 10);

    const students = await parentModel.findLinkedStudentsByUserId(req.user.userId);
    const isLinked = students.some((s) => s.studentId === studentId);

    if (!isLinked) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy học sinh hoặc bạn không có quyền xem bảng điểm này",
      });
    }

    const result = await parentModel.findGradesByStudentId(studentId);

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("getStudentGrades error:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể tải bảng điểm của học sinh",
    });
  }
}

// ── Student behaviour (read-only for parents) ─────────────────────────────────

async function checkStudentLink(userId, studentId) {
  const linked = await parentModel.findLinkedStudentsByUserId(userId);
  return linked.some((s) => s.studentId === studentId);
}

async function getStudentBehaviourSemesters(req, res) {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    if (!await checkStudentLink(req.user.userId, studentId)) {
      return res.status(403).json({ success: false, message: "Không có quyền xem thông tin học sinh này" });
    }
    const semesters = await behaviourModel.findSemesters();
    return res.json({ success: true, data: semesters });
  } catch (error) {
    console.error("getStudentBehaviourSemesters error:", error);
    return res.status(500).json({ success: false, message: "Không thể lấy danh sách học kỳ" });
  }
}

async function getStudentBehaviourRecords(req, res) {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    if (!await checkStudentLink(req.user.userId, studentId)) {
      return res.status(403).json({ success: false, message: "Không có quyền xem thông tin học sinh này" });
    }
    const { behaviorType, startDate, endDate, page = "1", limit = "50" } = req.query;
    const parsedPage  = Math.max(1, parseInt(page, 10));
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const { total, rows } = await behaviourModel.findRecords({
      studentId, behaviorType, startDate, endDate, page: parsedPage, limit: parsedLimit,
    });
    return res.json({
      success: true,
      data: { items: rows, pagination: { total, page: parsedPage, limit: parsedLimit, totalPages: Math.ceil(total / parsedLimit) } },
    });
  } catch (error) {
    console.error("getStudentBehaviourRecords error:", error);
    return res.status(500).json({ success: false, message: "Không thể lấy danh sách hành vi" });
  }
}

async function getStudentBehaviourConduct(req, res) {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    if (!await checkStudentLink(req.user.userId, studentId)) {
      return res.status(403).json({ success: false, message: "Không có quyền xem thông tin học sinh này" });
    }
    const { semesterId } = req.query;
    if (!semesterId) return res.status(400).json({ success: false, message: "Thiếu học kỳ" });
    const data = await behaviourService.getConductPreview({ studentId, semesterId: parseInt(semesterId, 10) });
    return res.json({ success: true, data });
  } catch (error) {
    console.error("getStudentBehaviourConduct error:", error);
    return res.status(500).json({ success: false, message: "Không thể lấy thông tin hạnh kiểm" });
  }
}

module.exports = {
  getMyProfile,
  getMyStudents,
  getStudentProfile,
  getStudentTimetable,
  getStudentGrades,
  getStudentBehaviourSemesters,
  getStudentBehaviourRecords,
  getStudentBehaviourConduct,
};
