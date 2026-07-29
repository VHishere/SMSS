const adminModel = require("../models/admin.model");
const adminFeesModel = require("../models/admin/fees");
const paymentModel = require("../models/payment.model");
const studentProfileModel = require("../models/studentProfile.model");
const studentProfileService = require("../services/studentProfile.service");
const academicService = require("../services/academic.service");
const behaviourService = require("../services/behaviour.service");
const goalModel = require("../models/goal.model");
const notificationModel = require("../models/notification.model");

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

// ---------------------------------------------------------------------------
// UC-10: Manage Tuition Fee Categories
// ---------------------------------------------------------------------------

async function getFeeCategories(req, res) {
  try {
    const { search = "", status = "" } = req.query;
    const data = await adminFeesModel.listFeeCategories({ search, status });
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể tải danh sách loại phí");
  }
}

async function createFeeCategory(req, res) {
  try {
    const data = await adminFeesModel.createFeeCategory(req.body, req.user.userId);
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể tạo loại phí");
  }
}

async function updateFeeCategory(req, res) {
  try {
    const data = await adminFeesModel.updateFeeCategory(req.params.id, req.body);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể cập nhật loại phí");
  }
}

async function updateFeeCategoryStatus(req, res) {
  try {
    const { status } = req.body;
    const data = await adminFeesModel.setFeeCategoryStatus(req.params.id, status);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể cập nhật trạng thái loại phí");
  }
}

// ---------------------------------------------------------------------------
// UC-11: Configure Fee Rates
// ---------------------------------------------------------------------------

async function getFeeRates(req, res) {
  try {
    const {
      feeCategoryId = "",
      schoolYearId = "",
      semesterId = "",
      gradeId = "",
      classId = "",
      status = "",
      search = "",
    } = req.query;

    const data = await adminFeesModel.listFeeRates({
      feeCategoryId,
      schoolYearId,
      semesterId,
      gradeId,
      classId,
      status,
      search,
    });

    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể tải danh sách mức thu");
  }
}

async function createFeeRate(req, res) {
  try {
    const data = await adminFeesModel.createFeeRate(req.body, req.user.userId);
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể tạo mức thu");
  }
}

async function updateFeeRate(req, res) {
  try {
    const data = await adminFeesModel.updateFeeRate(req.params.id, req.body);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể cập nhật mức thu");
  }
}

async function updateFeeRateStatus(req, res) {
  try {
    const { status } = req.body;
    const data = await adminFeesModel.setFeeRateStatus(req.params.id, status);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể cập nhật trạng thái mức thu");
  }
}

// UC-14: Monitor Tuition Payment Status — full online payment attempt log
// (VietQR/ZaloPay, every status) for a fee plan, alongside the confirmed
// fee_payment history staff already sees.
async function getFeePlanTransactions(req, res) {
  try {
    const data = await paymentModel.listTransactionsForFeePlan(req.params.id);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể tải lịch sử giao dịch");
  }
}

// ---------------------------------------------------------------------------
// Student management (mirrors the teacher 360-profile feature, but school-
// wide: every class, every student — read-only monitoring for admin).
// ---------------------------------------------------------------------------

async function getStudentsMeta(_req, res) {
  try {
    const [classes, semesters] = await Promise.all([
      studentProfileModel.findAllClasses(),
      studentProfileModel.findSemesters(),
    ]);
    return res.json({ success: true, data: { classes, semesters } });
  } catch (error) {
    return handleError(res, error, "Không thể lấy dữ liệu khởi tạo");
  }
}

async function getStudentsClassOverview(req, res) {
  try {
    const { classId, semesterId } = req.query;
    if (!classId) return res.status(400).json({ success: false, message: "Thiếu lớp" });

    const data = await studentProfileService.getClassOverview({
      classId: parseInt(classId, 10),
      semesterId,
    });
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể lấy danh sách học sinh");
  }
}

async function getStudentProfile(req, res) {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    const data = await studentProfileService.getProfile({ studentId, semesterId: req.query.semesterId });
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể lấy hồ sơ học sinh");
  }
}

async function getStudentAttendanceHistory(req, res) {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    const data = await studentProfileService.getAttendanceHistory({ studentId, semesterId: req.query.semesterId });
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể lấy lịch sử điểm danh");
  }
}

async function getStudentAcademicProfile(req, res) {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    const data = await academicService.getStudentAcademic({ studentId, semesterId: req.query.semesterId });
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể lấy kết quả học tập");
  }
}

async function getStudentBehaviourProfile(req, res) {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    const data = await behaviourService.getStudentBehaviour({ studentId, semesterId: req.query.semesterId });
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể lấy dữ liệu hạnh kiểm");
  }
}

async function getStudentGoalsList(req, res) {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    const goals = await goalModel.findByStudent(studentId, {
      status: req.query.status,
      goalType: req.query.goalType,
    });
    return res.json({ success: true, data: goals });
  } catch (error) {
    return handleError(res, error, "Không thể lấy danh sách mục tiêu");
  }
}

async function getMyNotifications(req, res) {
  try {
    const data = await notificationModel.findByUserId(req.user.userId, {
      limit: req.query.limit,
      unreadOnly: req.query.unreadOnly,
    });
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể tải thông báo");
  }
}

async function markMyNotificationRead(req, res) {
  try {
    const notificationId = parseInt(req.params.notificationId, 10);
    const affectedRows = await notificationModel.markRead(req.user.userId, notificationId);

    if (affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Không tìm thấy thông báo" });
    }

    return res.json({ success: true, message: "Đã đánh dấu thông báo là đã đọc" });
  } catch (error) {
    return handleError(res, error, "Không thể cập nhật thông báo");
  }
}

async function markAllMyNotificationsRead(req, res) {
  try {
    await notificationModel.markAllRead(req.user.userId);
    return res.json({ success: true, message: "Đã đánh dấu tất cả thông báo là đã đọc" });
  } catch (error) {
    return handleError(res, error, "Không thể cập nhật thông báo");
  }
}

// UC-106: School-Wide Operations Dashboard — high-level school analytics
// (total attendance, global counts, open warnings) for the admin overview page.
async function getOperationsDashboard(_req, res) {
  try {
    const data = await adminModel.getOperationsSummary();
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể lấy dữ liệu tổng quan vận hành");
  }
}

// Fee collection summary (active school year) — surfaced on the admin
// overview dashboard, sourced from the same tables as Theo dõi học phí.
async function getFeesDashboard(_req, res) {
  try {
    const data = await adminFeesModel.getFeeSummary();
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể lấy dữ liệu học phí");
  }
}

module.exports = {
  getUsers,
  updateUserStatus,
  getRoles,
  getUserDetail,
  updateUserRoles,
  updateUserChildren,
  getFeeCategories,
  createFeeCategory,
  updateFeeCategory,
  updateFeeCategoryStatus,
  getFeeRates,
  createFeeRate,
  updateFeeRate,
  updateFeeRateStatus,
  getFeePlanTransactions,
  getStudentsMeta,
  getStudentsClassOverview,
  getStudentProfile,
  getStudentAttendanceHistory,
  getStudentAcademicProfile,
  getStudentBehaviourProfile,
  getStudentGoalsList,
  getMyNotifications,
  markMyNotificationRead,
  markAllMyNotificationsRead,
  getOperationsDashboard,
  getFeesDashboard,
};
