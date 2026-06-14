const studentModel = require("../models/students");

async function getMyProfile(req, res) {
  try {
    const student =
      await studentModel.findProfileByUserId(
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

module.exports = {
  getMyProfile,
};