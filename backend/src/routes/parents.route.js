const express = require("express");

const parentController      = require("../controllers/parent.controller");
const meetingController     = require("../controllers/meeting.controller");
const attendanceController  = require("../controllers/attendance.controller");
const leaveRequestController = require("../controllers/leaveRequest.controller");
const homeworkController    = require("../controllers/homework.controller");
const communicationController = require("../controllers/communication.controller");
const paymentController     = require("../controllers/payment.controller");

const {
  authenticate,
  authorize,
} = require("../middleware/auth.middleware");
const { ensureParentOwnsStudent } = require("../middleware/parentAccess.middleware");
const { handleUpload, messageFileUpload } = require("../middleware/upload.middleware");
const router = express.Router();

router.get(
  "/me",
  authenticate,
  authorize("PARENT"),
  parentController.getMyProfile,
);

router.get(
  "/me/students",
  authenticate,
  authorize("PARENT"),
  parentController.getMyStudents,
);

router.get(
  "/me/students/:studentId",
  authenticate,
  authorize("PARENT"),
  ensureParentOwnsStudent,
  parentController.getStudentProfile,
);

router.get(
  "/me/students/:studentId/timetable",
  authenticate,
  authorize("PARENT"),
  ensureParentOwnsStudent,
  parentController.getStudentTimetable,
);

router.get(
  "/me/students/:studentId/grades",
  authenticate,
  authorize("PARENT"),
  ensureParentOwnsStudent,
  parentController.getStudentGrades,
);

router.get(
  "/me/students/:studentId/feedback",
  authenticate,
  authorize("PARENT"),
  parentController.getStudentLessonFeedback,
);

router.get(
  "/me/students/:studentId/attendance/stats",
  authenticate,
  authorize("PARENT"),
  ensureParentOwnsStudent,
  attendanceController.getStudentAttendanceStats,
);

router.get(
  "/me/students/:studentId/attendance/history",
  authenticate,
  authorize("PARENT"),
  ensureParentOwnsStudent,
  attendanceController.getStudentAttendanceHistory,
);

router.get(
  "/me/students/:studentId/attendance/analytics",
  authenticate,
  authorize("PARENT"),
  ensureParentOwnsStudent,
  attendanceController.getStudentAttendanceAnalytics,
);

router.post(
  "/me/students/:studentId/leave-requests",
  authenticate,
  authorize("PARENT"),
  ensureParentOwnsStudent,
  handleUpload,
  leaveRequestController.createLeaveRequest,
);

router.get(
  "/me/students/:studentId/leave-requests",
  authenticate,
  authorize("PARENT"),
  ensureParentOwnsStudent,
  leaveRequestController.getStudentLeaveRequests,
);

router.get(
  "/me/students/:studentId/leave-requests/:leaveRequestId",
  authenticate,
  authorize("PARENT"),
  ensureParentOwnsStudent,
  leaveRequestController.getParentLeaveRequestDetail,
);

router.patch(
  "/me/students/:studentId/leave-requests/:leaveRequestId/cancel",
  authenticate,
  authorize("PARENT"),
  ensureParentOwnsStudent,
  leaveRequestController.cancelLeaveRequest,
);

router.get(
  "/me/students/:studentId/behaviour/semesters",
  authenticate,
  authorize("PARENT"),
  ensureParentOwnsStudent,
  parentController.getStudentBehaviourSemesters,
);

router.get(
  "/me/students/:studentId/behaviour/records",
  authenticate,
  authorize("PARENT"),
  ensureParentOwnsStudent,
  parentController.getStudentBehaviourRecords,
);

router.get(
  "/me/students/:studentId/behaviour/conduct",
  authenticate,
  authorize("PARENT"),
  ensureParentOwnsStudent,
  parentController.getStudentBehaviourConduct,
);

router.get(
  "/me/students/:studentId/goals",
  authenticate,
  authorize("PARENT"),
  ensureParentOwnsStudent,
  parentController.getStudentGoals,
);

router.get(
  "/me/students/:studentId/homework",
  authenticate,
  authorize("PARENT"),
  ensureParentOwnsStudent,
  homeworkController.getParentStudentHomework,
);

router.get(
  "/me/students/:studentId/homework/:homeworkId",
  authenticate,
  authorize("PARENT"),
  ensureParentOwnsStudent,
  homeworkController.getParentStudentHomeworkDetail,
);

router.get(
  "/me/students/:studentId/events",
  authenticate,
  authorize("PARENT"),
  ensureParentOwnsStudent,
  parentController.getStudentEvents,
);

router.post(
  "/me/students/:studentId/events/:eventId/register",
  authenticate,
  authorize("PARENT"),
  ensureParentOwnsStudent,
  parentController.registerStudentEvent,
);

router.get(
  "/me/meetings/dashboard",
  authenticate,
  authorize("PARENT"),
  meetingController.getParentDashboard,
);

router.get(
  "/me/meetings",
  authenticate,
  authorize("PARENT"),
  meetingController.listParentMeetings,
);

router.get(
  "/me/meetings/:meetingId",
  authenticate,
  authorize("PARENT"),
  meetingController.getParentMeetingDetail,
);

router.patch(
  "/me/meetings/:meetingId/invitation",
  authenticate,
  authorize("PARENT"),
  meetingController.respondToInvitation,
);

router.get(
  "/me/communication/search",
  authenticate,
  authorize("PARENT"),
  parentController.searchMyMessages,
);

router.get(
  "/me/communication/contacts",
  authenticate,
  authorize("PARENT"),
  parentController.getMyMessageContacts,
);

router.get(
  "/me/communication/conversations",
  authenticate,
  authorize("PARENT"),
  communicationController.listConversations,
);

router.post(
  "/me/communication/conversations",
  authenticate,
  authorize("PARENT"),
  parentController.startMyTeacherConversation,
);

router.post(
  "/me/communication/upload",
  authenticate,
  authorize("PARENT"),
  messageFileUpload,
  communicationController.uploadFile,
);

router.get(
  "/me/communication/conversations/:conversationId",
  authenticate,
  authorize("PARENT"),
  communicationController.getThread,
);

router.post(
  "/me/communication/conversations/:conversationId/messages",
  authenticate,
  authorize("PARENT"),
  communicationController.sendMessage,
);

router.delete(
  "/me/communication/messages/:messageId",
  authenticate,
  authorize("PARENT"),
  communicationController.deleteMessage,
);

router.patch(
  "/me/communication/conversations/:conversationId/archive",
  authenticate,
  authorize("PARENT"),
  communicationController.archiveConversation,
);

router.get(
  "/me/fees",
  authenticate,
  authorize("PARENT"),
  paymentController.getMyFees,
);

router.get(
  "/me/fees/:feeAssignmentId",
  authenticate,
  authorize("PARENT"),
  paymentController.getMyFeeDetail,
);

router.post(
  "/me/fees/:feeAssignmentId/vietqr",
  authenticate,
  authorize("PARENT"),
  paymentController.createVietQrPayment,
);

router.post(
  "/me/fees/:feeAssignmentId/zalopay",
  authenticate,
  authorize("PARENT"),
  paymentController.createZaloPayOrder,
);

router.get(
  "/me/fees/:feeAssignmentId/zalopay/:appTransId/status",
  authenticate,
  authorize("PARENT"),
  paymentController.getZaloPayOrderStatus,
);

router.get(
  "/me/notifications",
  authenticate,
  authorize("PARENT"),
  parentController.getMyNotifications,
);

router.patch(
  "/me/notifications/read-all",
  authenticate,
  authorize("PARENT"),
  parentController.markAllMyNotificationsRead,
);

router.patch(
  "/me/notifications/:notificationId/read",
  authenticate,
  authorize("PARENT"),
  parentController.markMyNotificationRead,
);

module.exports = router;
