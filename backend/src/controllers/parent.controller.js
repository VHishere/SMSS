const parentModel = require("../models/parents");

async function getMyProfile(req, res) {
  try {
    const parent =
      await parentModel.findProfileByUserId(
        req.user.userId,
      );

    if (!parent) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy hồ sơ học sinh",
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
      message: "Không thể lấy hồ sơ học sinh",
    });
  }
}

module.exports = {
  getMyProfile,
};