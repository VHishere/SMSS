const express = require("express");

const supervisorController = require("../controllers/supervisor.controller");
const { authenticate, authorize } = require("../middleware/auth.middleware");

const router = express.Router();

// Toàn bộ route quản nhiệm yêu cầu đăng nhập + role DORM_SUPERVISOR.
// Dữ liệu luôn được scope theo (các) khu trong supervisor_area của user.
const guard = [authenticate, authorize("DORM_SUPERVISOR")];

// Dashboard
router.get("/dashboard", ...guard, supervisorController.getDashboard);

// Khu tôi phụ trách
router.get("/areas", ...guard, supervisorController.getAreas);

// Điểm danh nội trú
router.get("/attendance", ...guard, supervisorController.getAttendance);
router.post("/attendance/bulk", ...guard, supervisorController.submitBulkAttendance);

// Sổ trực quản nhiệm
router.get("/logbook", ...guard, supervisorController.getLogbook);
router.post("/logbook", ...guard, supervisorController.createLogEntry);

// Thông báo GVQN (chuông): đơn nghỉ chờ duyệt + việc trực còn tồn
router.get("/notifications", ...guard, supervisorController.getNotifications);
router.post("/notifications/read", ...guard, supervisorController.markNotificationRead);

// Duyệt nghỉ 2 cấp (GVCN → GVQN)
router.get("/leave-requests", ...guard, supervisorController.getLeaveRequests);
router.post("/leave-requests/:id/decide", ...guard, supervisorController.decideLeaveRequest);

// Đăng ký cuối tuần
router.get("/weekend", ...guard, supervisorController.getWeekend);
router.patch("/weekend/:id/status", ...guard, supervisorController.setWeekendStatus);

// Hỗ trợ học sinh + Liên lạc (danh bạ PH) — scope theo khu
router.get("/support", ...guard, supervisorController.getSupport);
router.post("/support", ...guard, supervisorController.createSupport);
router.get("/contacts", ...guard, supervisorController.getContacts);

// Việc cần làm trong ca trực
router.post("/tasks", ...guard, supervisorController.createTask);
router.patch("/tasks/:taskId", ...guard, supervisorController.updateTaskStatus);

module.exports = router;
