const express = require("express");

const staffController = require("../controllers/staff.controller");
const communicationController = require("../controllers/communication.controller");

const {
  authenticate,
  authorize,
} = require("../middleware/auth.middleware");

const {
  messageFileUpload,
  profileAvatarUpload,
} = require("../middleware/upload.middleware");

const router = express.Router();

const staffRoles = ["STAFF", "ADMIN"];

router.get(
  "/overview",
  authenticate,
  authorize(...staffRoles),
  staffController.getOverview,
);

router.get(
  "/lookups",
  authenticate,
  authorize(...staffRoles),
  staffController.getLookups,
);

router.get(
  "/communication/dashboard",
  authenticate,
  authorize(...staffRoles),
  communicationController.getDashboard,
);

router.get(
  "/communication/contacts",
  authenticate,
  authorize(...staffRoles),
  communicationController.getContactsStaff,
);

router.get(
  "/communication/search",
  authenticate,
  authorize(...staffRoles),
  communicationController.searchMessages,
);

router.get(
  "/communication/conversations",
  authenticate,
  authorize(...staffRoles),
  communicationController.listConversations,
);

router.post(
  "/communication/conversations",
  authenticate,
  authorize(...staffRoles),
  communicationController.startConversationStaff,
);

router.post(
  "/communication/upload",
  authenticate,
  authorize(...staffRoles),
  messageFileUpload,
  communicationController.uploadFile,
);

router.get(
  "/communication/conversations/:conversationId",
  authenticate,
  authorize(...staffRoles),
  communicationController.getThread,
);

router.post(
  "/communication/conversations/:conversationId/messages",
  authenticate,
  authorize(...staffRoles),
  communicationController.sendMessage,
);

router.delete(
  "/communication/messages/:messageId",
  authenticate,
  authorize(...staffRoles),
  communicationController.deleteMessage,
);

router.patch(
  "/communication/conversations/:conversationId/archive",
  authenticate,
  authorize(...staffRoles),
  communicationController.archiveConversation,
);

// Khảo sát đánh giá giáo viên (HS → GV, ẩn danh) — quản lý tạo + xem tổng hợp
router.get(
  "/surveys",
  authenticate,
  authorize(...staffRoles),
  staffController.listTeacherSurveys,
);

router.post(
  "/surveys",
  authenticate,
  authorize(...staffRoles),
  staffController.createTeacherSurvey,
);

router.post(
  "/surveys/:id/close",
  authenticate,
  authorize(...staffRoles),
  staffController.closeTeacherSurvey,
);

router.get(
  "/surveys/:id/aggregate",
  authenticate,
  authorize(...staffRoles),
  staffController.getTeacherSurveyAggregate,
);

router.get(
  "/fees",
  authenticate,
  authorize(...staffRoles),
  staffController.getFeePlans,
);

router.post(
  "/fees",
  authenticate,
  authorize(...staffRoles),
  staffController.createFeePlan,
);

router.get(
  "/fees/:id",
  authenticate,
  authorize(...staffRoles),
  staffController.getFeePlanById,
);

router.put(
  "/fees/:id/status",
  authenticate,
  authorize(...staffRoles),
  staffController.updateFeePlanStatus,
);

router.post(
  "/fees/:id/assignments/:assignmentId/payments",
  authenticate,
  authorize(...staffRoles),
  staffController.recordFeePayment,
);

router.get(
  "/students",
  authenticate,
  authorize(...staffRoles),
  staffController.getStudents,
);

router.get(
  "/students/:id",
  authenticate,
  authorize(...staffRoles),
  staffController.getStudentById,
);

router.post(
  "/students",
  authenticate,
  authorize(...staffRoles),
  staffController.createStudent,
);

router.put(
  "/students/:id",
  authenticate,
  authorize(...staffRoles),
  staffController.updateStudent,
);

router.post(
  "/students/:id/avatar",
  authenticate,
  authorize(...staffRoles),
  profileAvatarUpload,
  staffController.uploadStudentAvatar,
);

router.get(
  "/parents",
  authenticate,
  authorize(...staffRoles),
  staffController.getParents,
);

router.get(
  "/parents/:id",
  authenticate,
  authorize(...staffRoles),
  staffController.getParentById,
);

router.post(
  "/parents",
  authenticate,
  authorize(...staffRoles),
  staffController.createParent,
);

router.put(
  "/parents/:id",
  authenticate,
  authorize(...staffRoles),
  staffController.updateParent,
);

router.get(
  "/teachers",
  authenticate,
  authorize(...staffRoles),
  staffController.getTeachers,
);

router.get(
  "/teachers/:id",
  authenticate,
  authorize(...staffRoles),
  staffController.getTeacherById,
);

router.post(
  "/teachers",
  authenticate,
  authorize(...staffRoles),
  staffController.createTeacher,
);

router.put(
  "/teachers/:id",
  authenticate,
  authorize(...staffRoles),
  staffController.updateTeacher,
);

router.get(
  "/school-years",
  authenticate,
  authorize(...staffRoles),
  staffController.getSchoolYears,
);

router.post(
  "/school-years",
  authenticate,
  authorize(...staffRoles),
  staffController.createSchoolYear,
);

router.put(
  "/school-years/:id",
  authenticate,
  authorize(...staffRoles),
  staffController.updateSchoolYear,
);

router.post(
  "/school-years/:id/initialize",
  authenticate,
  authorize(...staffRoles),
  staffController.initializeSchoolYearData,
);

router.get(
  "/classes",
  authenticate,
  authorize(...staffRoles),
  staffController.getClasses,
);

router.get(
  "/classes/:id",
  authenticate,
  authorize(...staffRoles),
  staffController.getClassById,
);

router.post(
  "/classes",
  authenticate,
  authorize(...staffRoles),
  staffController.createClass,
);

router.put(
  "/classes/:id",
  authenticate,
  authorize(...staffRoles),
  staffController.updateClass,
);

router.delete(
  "/classes/:id",
  authenticate,
  authorize(...staffRoles),
  staffController.deleteClass,
);

router.post(
  "/classes/:id/students",
  authenticate,
  authorize(...staffRoles),
  staffController.enrollStudent,
);

router.delete(
  "/classes/:id/students/:studentId",
  authenticate,
  authorize(...staffRoles),
  staffController.removeStudentFromClass,
);

router.post(
  "/classes/:id/teachers",
  authenticate,
  authorize(...staffRoles),
  staffController.assignTeacher,
);

router.delete(
  "/classes/:classId/teachers/:teacherClassId",
  authenticate,
  authorize(...staffRoles),
  staffController.removeTeacher,
);

router.get(
  "/classes/:id/timetable",
  authenticate,
  authorize(...staffRoles),
  staffController.getClassTimetable,
);

router.post(
  "/timetable",
  authenticate,
  authorize(...staffRoles),
  staffController.createTimetableLessons,
);

router.post(
  "/classes/:id/timetable",
  authenticate,
  authorize(...staffRoles),
  staffController.createClassTimetableLesson,
);

router.put(
  "/classes/:id/timetable/:timetableId",
  authenticate,
  authorize(...staffRoles),
  staffController.updateClassTimetableLesson,
);

router.delete(
  "/classes/:id/timetable/:timetableId",
  authenticate,
  authorize(...staffRoles),
  staffController.deleteClassTimetableLesson,
);

router.get(
  "/curriculum",
  authenticate,
  authorize(...staffRoles),
  staffController.getCurriculum,
);

router.get(
  "/curriculum/:id",
  authenticate,
  authorize(...staffRoles),
  staffController.getCurriculumById,
);

router.post(
  "/curriculum",
  authenticate,
  authorize(...staffRoles),
  staffController.createCurriculumItem,
);

router.put(
  "/curriculum/:id",
  authenticate,
  authorize(...staffRoles),
  staffController.updateCurriculumItem,
);

router.delete(
  "/curriculum/:id",
  authenticate,
  authorize(...staffRoles),
  staffController.deleteCurriculumItem,
);

router.put(
  "/curriculum/sessions/:sessionId",
  authenticate,
  authorize(...staffRoles),
  staffController.updateStudySession,
);

// ── Thông báo của tài khoản staff (bảng notification chung, is_read thật) ────
// Chỉ STAFF (không mở cho ADMIN) vì đây là hộp thư của chính người đăng nhập —
// admin đã có /admin/me/notifications riêng.
router.get(
  "/me/notifications",
  authenticate,
  authorize("STAFF"),
  staffController.getMyNotifications,
);

router.patch(
  "/me/notifications/read-all",
  authenticate,
  authorize("STAFF"),
  staffController.markAllMyNotificationsRead,
);

router.patch(
  "/me/notifications/:notificationId/read",
  authenticate,
  authorize("STAFF"),
  staffController.markMyNotificationRead,
);

module.exports = router;
