const parentModel = require("../models/parents");
const timetableModel = require("../models/timetable.model");
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

    const students = await parentModel.findLinkedStudentsByUserId(req.user.userId);
    const student = students.find((s) => s.studentId === studentId);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy học sinh hoặc bạn không có quyền xem hồ sơ này",
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

module.exports = {
  getMyProfile,
  getMyStudents,
  getStudentProfile,
  getStudentTimetable,
};
