const express = require("express");

const communicationController = require("../controllers/communication.controller");
const studentController = require("../controllers/student.controller");
const timetableController = require("../controllers/timetable.controller");

const {
  authenticate,
  authorize,
} = require("../middleware/auth.middleware");

const {
  profileAvatarUpload,
  homeworkFileUpload,
  messageFileUpload,
} = require("../middleware/upload.middleware");

const router = express.Router();

const studentOnly = [
  authenticate,
  authorize("STUDENT"),
];

router.get(
  "/me/dashboard",
  ...studentOnly,
  studentController.getMyDashboard,
);

router.get(
  "/me/timetable",
  ...studentOnly,
  timetableController.getMyTimetable,
);

router.get(
  "/me/homeworks",
  ...studentOnly,
  studentController.getMyHomeworks,
);

router.get(
  "/me/homeworks/:homeworkId",
  ...studentOnly,
  studentController.getMyHomeworkDetail,
);

router.post(
  "/me/homeworks/:homeworkId/submission",
  ...studentOnly,
  homeworkFileUpload,
  studentController.submitMyHomework,
);

router.get(
  "/me/grades",
  ...studentOnly,
  studentController.getMyGrades,
);

router.get(
  "/me/attendance/history",
  ...studentOnly,
  studentController.getMyAttendanceHistory,
);

router.get(
  "/me/attendance/analytics",
  ...studentOnly,
  studentController.getMyAttendanceAnalytics,
);

router.get(
  "/me/behaviour",
  ...studentOnly,
  studentController.getMyBehaviour,
);

// Nhận xét theo tiết (GVBM → HS)
router.get(
  "/me/feedback",
  ...studentOnly,
  studentController.getMyLessonFeedback,
);

// Khảo sát đánh giá giáo viên (ẩn danh)
router.get(
  "/me/surveys",
  ...studentOnly,
  studentController.getMySurveys,
);

router.post(
  "/me/surveys/:surveyId/submit",
  ...studentOnly,
  studentController.submitMySurvey,
);

router.get(
  "/me/goals/types",
  ...studentOnly,
  studentController.getGoalTypes,
);

router.get(
  "/me/goals",
  ...studentOnly,
  studentController.getMyGoals,
);

router.post(
  "/me/goals",
  ...studentOnly,
  studentController.createMyGoal,
);

router.patch(
  "/me/goals/:goalId/progress",
  ...studentOnly,
  studentController.updateMyGoalProgress,
);

router.get(
  "/me/goals/:goalId/log",
  ...studentOnly,
  studentController.getMyGoalLog,
);

router.get(
  "/me/events",
  ...studentOnly,
  studentController.getMyEvents,
);

router.post(
  "/me/events/:eventId/register",
  ...studentOnly,
  studentController.registerMyEvent,
);

router.get(
  "/me/notifications",
  ...studentOnly,
  studentController.getMyNotifications,
);

router.patch(
  "/me/notifications/read-all",
  ...studentOnly,
  studentController.markAllMyNotificationsRead,
);

router.patch(
  "/me/notifications/:notificationId/read",
  ...studentOnly,
  studentController.markMyNotificationRead,
);

router.get(
  "/me/communication/contacts",
  ...studentOnly,
  studentController.getMyMessageContacts,
);

router.get(
  "/me/communication/conversations",
  ...studentOnly,
  communicationController.listConversations,
);

router.post(
  "/me/communication/conversations",
  ...studentOnly,
  studentController.startMyTeacherConversation,
);

router.post(
  "/me/communication/upload",
  ...studentOnly,
  messageFileUpload,
  communicationController.uploadFile,
);

router.get(
  "/me/communication/conversations/:conversationId",
  ...studentOnly,
  communicationController.getThread,
);

router.post(
  "/me/communication/conversations/:conversationId/messages",
  ...studentOnly,
  communicationController.sendMessage,
);

router.delete(
  "/me/communication/messages/:messageId",
  ...studentOnly,
  communicationController.deleteMessage,
);

router.patch(
  "/me/communication/conversations/:conversationId/archive",
  ...studentOnly,
  communicationController.archiveConversation,
);

router.patch(
  "/me",
  ...studentOnly,
  profileAvatarUpload,
  studentController.updateMyProfile,
);

router.get(
  "/me/communication/search",
  ...studentOnly,
  studentController.searchMyMessages,
);

router.get(
  "/me",
  ...studentOnly,
  studentController.getMyProfile,
);

module.exports = router;