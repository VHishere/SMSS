const studentModel = require("../models/students");

async function getMyProfile(req, res) {
  try {
    const student = await studentModel.findProfileByUserId(
      req.user.userId,
    );

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
    console.error("getMyProfile error:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể lấy hồ sơ học sinh",
    });
  }
}

async function getMyHomeworks(req, res) {
  try {
    const result = await studentModel.findHomeworksByUserId(
      req.user.userId,
    );

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy lớp hiện tại của học sinh",
      });
    }

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("getMyHomeworks error:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể tải danh sách bài tập về nhà",
    });
  }
}

async function getMyGrades(req, res) {
  try {
    const result = await studentModel.findGradesByUserId(
      req.user.userId,
    );

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy lớp hiện tại của học sinh",
      });
    }

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("getMyGrades error:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể tải bảng điểm",
    });
  }
}

module.exports = {
  getMyProfile,
  getMyHomeworks,
  getMyGrades,
};