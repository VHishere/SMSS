const adminModel = require("../models/admin.model");

function handleError(res, error, fallbackMessage) {
  console.error(fallbackMessage, error);

  if (error.code === "ER_DUP_ENTRY") {
    return res.status(409).json({
      success: false,
      message: "Email hoặc username đã tồn tại",
    });
  }

  return res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || fallbackMessage,
  });
}

async function getUsers(req, res) {
  try {
    const {
      search = "",
      role = "",
      status = "",
      dateFrom = "",
      dateTo = "",
    } = req.query;

    const data = await adminModel.listUsers({
      search,
      role,
      status,
      dateFrom,
      dateTo,
    });

    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể tải danh sách tài khoản");
  }
}

async function updateUserStatus(req, res) {
  try {
    const { status } = req.body;

    if (!["ACTIVE", "LOCKED"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Trạng thái không hợp lệ",
      });
    }

    const data = await adminModel.setUserStatus(req.params.id, status);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể cập nhật trạng thái tài khoản");
  }
}

module.exports = {
  getUsers,
  updateUserStatus,
};
