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

async function getRoles(_req, res) {
  try {
    const data = await adminModel.listRoles();
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể tải danh sách vai trò");
  }
}

async function getUserDetail(req, res) {
  try {
    const data = await adminModel.getUserDetail(req.params.id);

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tài khoản",
      });
    }

    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể tải chi tiết tài khoản");
  }
}

async function updateUserRoles(req, res) {
  try {
    const { roleIds } = req.body;
    const data = await adminModel.updateUserRoles(
      req.params.id,
      roleIds,
      req.user.userId,
    );
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể cập nhật vai trò tài khoản");
  }
}

async function updateUserChildren(req, res) {
  try {
    const { children } = req.body;
    const data = await adminModel.updateUserChildren(req.params.id, children);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể cập nhật danh sách con của phụ huynh");
  }
}

module.exports = {
  getUsers,
  updateUserStatus,
  getRoles,
  getUserDetail,
  updateUserRoles,
  updateUserChildren,
};
