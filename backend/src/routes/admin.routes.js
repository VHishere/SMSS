const express = require("express");

const adminController = require("../controllers/admin.controller");
const academicController = require("../controllers/academic.controller");
const behaviourController = require("../controllers/behaviour.controller");
const reportController = require("../controllers/report.controller");
const attendanceController = require("../controllers/attendance.controller");
const announcementController = require("../controllers/announcement.controller");
const communicationController = require("../controllers/communication.controller");
const eventController = require("../controllers/event.controller");

const {
  authenticate,
  authorize,
} = require("../middleware/auth.middleware");
const { messageFileUpload, eventFileUpload } = require("../middleware/upload.middleware");

const router = express.Router();

router.get(
  "/users",
  authenticate,
  authorize("ADMIN"),
  adminController.getUsers,
);

router.put(
  "/users/:id/status",
  authenticate,
  authorize("ADMIN"),
  adminController.updateUserStatus,
);

router.get(
  "/roles",
  authenticate,
  authorize("ADMIN"),
  adminController.getRoles,
);

router.get(
  "/users/:id",
  authenticate,
  authorize("ADMIN"),
  adminController.getUserDetail,
);

router.put(
  "/users/:id/roles",
  authenticate,
  authorize("ADMIN"),
  adminController.updateUserRoles,
);

router.put(
  "/users/:id/children",
  authenticate,
  authorize("ADMIN"),
  adminController.updateUserChildren,
);

// UC-10: Manage Tuition Fee Categories
router.get(
  "/fee-categories",
  authenticate,
  authorize("ADMIN"),
  adminController.getFeeCategories,
);

router.post(
  "/fee-categories",
  authenticate,
  authorize("ADMIN"),
  adminController.createFeeCategory,
);

router.put(
  "/fee-categories/:id",
  authenticate,
  authorize("ADMIN"),
  adminController.updateFeeCategory,
);

router.put(
  "/fee-categories/:id/status",
  authenticate,
  authorize("ADMIN"),
  adminController.updateFeeCategoryStatus,
);

// UC-11: Configure Fee Rates
router.get(
  "/fee-rates",
  authenticate,
  authorize("ADMIN"),
  adminController.getFeeRates,
);

router.post(
  "/fee-rates",
  authenticate,
  authorize("ADMIN"),
  adminController.createFeeRate,
);

router.put(
  "/fee-rates/:id",
  authenticate,
  authorize("ADMIN"),
  adminController.updateFeeRate,
);

router.put(
  "/fee-rates/:id/status",
  authenticate,
  authorize("ADMIN"),
  adminController.updateFeeRateStatus,
);

// UC-14: full online payment transaction history for a fee plan
router.get(
  "/fees/:id/transactions",
  authenticate,
  authorize("ADMIN"),
  adminController.getFeePlanTransactions,
);

// Student management — school-wide, read-only 360 view (mirrors teacher's
// feature but without the per-teacher class-ownership restriction).
// Static segments declared before "/students/:studentId" params.
router.get(
  "/students/meta",
  authenticate,
  authorize("ADMIN"),
  adminController.getStudentsMeta,
);

router.get(
  "/students/overview",
  authenticate,
  authorize("ADMIN"),
  adminController.getStudentsClassOverview,
);

router.get(
  "/students/:studentId/profile",
  authenticate,
  authorize("ADMIN"),
  adminController.getStudentProfile,
);

router.get(
  "/students/:studentId/attendance",
  authenticate,
  authorize("ADMIN"),
  adminController.getStudentAttendanceHistory,
);

router.get(
  "/students/:studentId/academic",
  authenticate,
  authorize("ADMIN"),
  adminController.getStudentAcademicProfile,
);

router.get(
  "/students/:studentId/behaviour",
  authenticate,
  authorize("ADMIN"),
  adminController.getStudentBehaviourProfile,
);

router.get(
  "/students/:studentId/goals",
  authenticate,
  authorize("ADMIN"),
  adminController.getStudentGoalsList,
);

// UC-106: School-Wide Operations Dashboard
router.get(
  "/dashboard/operations",
  authenticate,
  authorize("ADMIN"),
  adminController.getOperationsDashboard,
);

// Fee collection summary — surfaced on the admin overview dashboard.
router.get(
  "/dashboard/fees",
  authenticate,
  authorize("ADMIN"),
  adminController.getFeesDashboard,
);

// Academic (điểm số) — read-only, school-wide (mirrors teacher's Academic
// page minus score entry/editing/warning generation).
router.get(
  "/academic/meta",
  authenticate,
  authorize("ADMIN"),
  academicController.getMetaAdmin,
);

router.get(
  "/academic/gradebook",
  authenticate,
  authorize("ADMIN"),
  academicController.getGradebookAdmin,
);

router.get(
  "/academic/analytics",
  authenticate,
  authorize("ADMIN"),
  academicController.getAnalyticsAdmin,
);

router.get(
  "/academic/analytics/trend",
  authenticate,
  authorize("ADMIN"),
  academicController.getTrendAdmin,
);

router.get(
  "/academic/warnings",
  authenticate,
  authorize("ADMIN"),
  academicController.getWarningsAdmin,
);

// Behaviour & Conduct (hạnh kiểm) — school-wide, mirrors teacher's
// Behaviour/Conduct pages, EXCEPT there is deliberately no admin route for
// evaluateConduct (đánh giá hạnh kiểm) — that stays homeroom-teacher-only.
router.get(
  "/behaviour/meta",
  authenticate,
  authorize("ADMIN"),
  behaviourController.getMetaAdmin,
);

// Category catalog (mức độ cộng/trừ) — admin manages the point value of
// each merit/violation category; both teacher and admin pickers read it.
router.get(
  "/behaviour/categories",
  authenticate,
  authorize("ADMIN"),
  behaviourController.listCategories,
);

router.post(
  "/behaviour/categories",
  authenticate,
  authorize("ADMIN"),
  behaviourController.createCategory,
);

router.put(
  "/behaviour/categories/:categoryId",
  authenticate,
  authorize("ADMIN"),
  behaviourController.updateCategory,
);

router.put(
  "/behaviour/categories/:categoryId/status",
  authenticate,
  authorize("ADMIN"),
  behaviourController.setCategoryStatus,
);

router.get(
  "/behaviour/records",
  authenticate,
  authorize("ADMIN"),
  behaviourController.listRecordsAdmin,
);

router.post(
  "/behaviour/records",
  authenticate,
  authorize("ADMIN"),
  behaviourController.createRecordAdmin,
);

router.put(
  "/behaviour/records/:behaviorId",
  authenticate,
  authorize("ADMIN"),
  behaviourController.updateRecordAdmin,
);

router.post(
  "/behaviour/records/:behaviorId/archive",
  authenticate,
  authorize("ADMIN"),
  behaviourController.archiveRecordAdmin,
);

router.get(
  "/behaviour/conduct",
  authenticate,
  authorize("ADMIN"),
  behaviourController.getConductPreviewAdmin,
);

router.get(
  "/behaviour/analytics",
  authenticate,
  authorize("ADMIN"),
  behaviourController.getAnalyticsAdmin,
);

router.get(
  "/behaviour/warnings",
  authenticate,
  authorize("ADMIN"),
  behaviourController.getWarningsAdmin,
);

router.post(
  "/behaviour/warnings/generate",
  authenticate,
  authorize("ADMIN"),
  behaviourController.generateWarningsAdmin,
);

router.put(
  "/behaviour/warnings/:warningId",
  authenticate,
  authorize("ADMIN"),
  behaviourController.updateWarningAdmin,
);

// Reports (báo cáo) — view + export only (mirrors teacher's Reports /
// Report Builder minus saved templates).
router.get(
  "/reports/meta",
  authenticate,
  authorize("ADMIN"),
  reportController.getMetaAdmin,
);

router.post(
  "/reports/generate",
  authenticate,
  authorize("ADMIN"),
  reportController.generateAdmin,
);

router.post(
  "/reports/export-excel",
  authenticate,
  authorize("ADMIN"),
  reportController.exportExcelAdmin,
);

router.post(
  "/reports/log-export",
  authenticate,
  authorize("ADMIN"),
  reportController.logExportAdmin,
);

router.get(
  "/reports/history",
  authenticate,
  authorize("ADMIN"),
  reportController.getHistoryAdmin,
);

// Attendance (điểm danh) — school-wide history/stats + class summary
// (mirrors teacher's homeroom overview but for any class), plus admin can
// scan absence warnings & notify parents for any class.
router.get(
  "/attendance/meta",
  authenticate,
  authorize("ADMIN"),
  attendanceController.getMeta,
);

router.get(
  "/attendance/overview",
  authenticate,
  authorize("ADMIN"),
  attendanceController.getClassOverview,
);

router.post(
  "/attendance/warnings/generate",
  authenticate,
  authorize("ADMIN"),
  attendanceController.generateWarnings,
);

router.get(
  "/attendance/classes/:classId/history",
  authenticate,
  authorize("ADMIN"),
  attendanceController.getHistory,
);

router.get(
  "/attendance/classes/:classId/analytics",
  authenticate,
  authorize("ADMIN"),
  attendanceController.getAnalytics,
);

// Notifications (thông báo) — generic notification-table inbox for admin,
// surfaced via the header bell dropdown + a full "Xem tất cả" page.
router.get(
  "/me/notifications",
  authenticate,
  authorize("ADMIN"),
  adminController.getMyNotifications,
);

router.patch(
  "/me/notifications/read-all",
  authenticate,
  authorize("ADMIN"),
  adminController.markAllMyNotificationsRead,
);

router.patch(
  "/me/notifications/:notificationId/read",
  authenticate,
  authorize("ADMIN"),
  adminController.markMyNotificationRead,
);

// Announcements (soạn thông báo) — admin can target the whole school, a
// grade, or a single class; unlike teacher's version, admin manages every
// announcement school-wide (no homeroom/ownership restriction).
router.get(
  "/announcements/meta",
  authenticate,
  authorize("ADMIN"),
  announcementController.getMeta,
);

router.get(
  "/announcements",
  authenticate,
  authorize("ADMIN"),
  announcementController.listAdmin,
);

router.post(
  "/announcements",
  authenticate,
  authorize("ADMIN"),
  announcementController.createAdmin,
);

router.put(
  "/announcements/:announcementId",
  authenticate,
  authorize("ADMIN"),
  announcementController.updateAdmin,
);

router.post(
  "/announcements/:announcementId/publish",
  authenticate,
  authorize("ADMIN"),
  announcementController.publishAdmin,
);

router.patch(
  "/announcements/:announcementId/pin",
  authenticate,
  authorize("ADMIN"),
  announcementController.pinAdmin,
);

router.post(
  "/announcements/:announcementId/archive",
  authenticate,
  authorize("ADMIN"),
  announcementController.archiveAdmin,
);

router.get(
  "/announcements/:announcementId/receipts",
  authenticate,
  authorize("ADMIN"),
  announcementController.getReceiptsAdmin,
);

// Messages (tin nhắn) — admin can message any STAFF or TEACHER user, via the
// same generic conversation infra parent/student/teacher already use.
router.get(
  "/communication/dashboard",
  authenticate,
  authorize("ADMIN"),
  communicationController.getDashboard,
);

router.get(
  "/communication/contacts",
  authenticate,
  authorize("ADMIN"),
  communicationController.getContactsAdmin,
);

router.get(
  "/communication/search",
  authenticate,
  authorize("ADMIN"),
  communicationController.searchMessages,
);

router.get(
  "/communication/conversations",
  authenticate,
  authorize("ADMIN"),
  communicationController.listConversations,
);

router.post(
  "/communication/conversations",
  authenticate,
  authorize("ADMIN"),
  communicationController.startConversationAdmin,
);

router.post(
  "/communication/upload",
  authenticate,
  authorize("ADMIN"),
  messageFileUpload,
  communicationController.uploadFile,
);

router.get(
  "/communication/conversations/:conversationId",
  authenticate,
  authorize("ADMIN"),
  communicationController.getThread,
);

router.post(
  "/communication/conversations/:conversationId/messages",
  authenticate,
  authorize("ADMIN"),
  communicationController.sendMessage,
);

router.delete(
  "/communication/messages/:messageId",
  authenticate,
  authorize("ADMIN"),
  communicationController.deleteMessage,
);

router.patch(
  "/communication/conversations/:conversationId/archive",
  authenticate,
  authorize("ADMIN"),
  communicationController.archiveConversation,
);

// Events (sự kiện) — admin manages every event school-wide, not just its
// own class (mirrors teacher's Events page, no ownership restriction).
router.get("/events/meta", authenticate, authorize("ADMIN"), eventController.getMetaAdmin);
router.get("/events/dashboard", authenticate, authorize("ADMIN"), eventController.getDashboardAdmin);
router.get("/events/analytics", authenticate, authorize("ADMIN"), eventController.getAnalyticsAdmin);
router.get("/events/classes/:classId/contacts", authenticate, authorize("ADMIN"), eventController.getClassContactsAdmin);

router.get("/events", authenticate, authorize("ADMIN"), eventController.listEventsAdmin);
router.post("/events", authenticate, authorize("ADMIN"), eventController.createEventAdmin);

router.get("/events/:eventId", authenticate, authorize("ADMIN"), eventController.getDetailAdmin);
router.put("/events/:eventId", authenticate, authorize("ADMIN"), eventController.updateEventAdmin);
router.patch("/events/:eventId/status", authenticate, authorize("ADMIN"), eventController.changeStatusAdmin);
router.post("/events/:eventId/duplicate", authenticate, authorize("ADMIN"), eventController.duplicateEventAdmin);
router.post("/events/:eventId/reminder", authenticate, authorize("ADMIN"), eventController.sendReminderAdmin);
router.put("/events/:eventId/outcome", authenticate, authorize("ADMIN"), eventController.saveOutcomeAdmin);

router.post("/events/:eventId/participants", authenticate, authorize("ADMIN"), eventController.addParticipantsAdmin);
router.delete("/events/:eventId/participants/:registrationId", authenticate, authorize("ADMIN"), eventController.removeParticipantAdmin);
router.patch("/events/:eventId/participants/:registrationId/attendance", authenticate, authorize("ADMIN"), eventController.markAttendanceAdmin);

router.post("/events/:eventId/documents", authenticate, authorize("ADMIN"), eventFileUpload, eventController.uploadDocumentAdmin);
router.delete("/events/:eventId/documents/:attachmentId", authenticate, authorize("ADMIN"), eventController.deleteDocumentAdmin);

module.exports = router;
