const express = require("express");

const teacherController           = require("../controllers/teacher.controller");
const teacherAttendanceController = require("../controllers/teacher.attendance.controller");
const leaveRequestController      = require("../controllers/leaveRequest.controller");
const homeworkController          = require("../controllers/homework.controller");
const academicController          = require("../controllers/academic.controller");
const behaviourController         = require("../controllers/behaviour.controller");
const studentProfileController    = require("../controllers/studentProfile.controller");
const goalController              = require("../controllers/goal.controller");
const reportController            = require("../controllers/report.controller");
const communicationController     = require("../controllers/communication.controller");
const announcementController      = require("../controllers/announcement.controller");
const meetingController           = require("../controllers/meeting.controller");
const eventController             = require("../controllers/event.controller");
const teacherTimetableController  = require("../controllers/teacherTimetable.controller");
const supportCaseController       = require("../controllers/supportCase.controller");
const { authenticate, authorize } = require("../middleware/auth.middleware");
const { homeworkFileUpload, messageFileUpload, eventFileUpload } = require("../middleware/upload.middleware");

const TEACHER_ROLES = [
  "HOMEROOM_TEACHER",
  "SUBJECT_TEACHER",
  "DORM_SUPERVISOR",
];

const router = express.Router();

// ── Profile & Dashboard ───────────────────────────────────────────────────────

router.get(
  "/me",
  authenticate,
  authorize(...TEACHER_ROLES),
  teacherController.getMyProfile,
);

router.get(
  "/me/dashboard",
  authenticate,
  authorize(...TEACHER_ROLES),
  teacherController.getDashboardSummary,
);

// ── Attendance: Roll Call ─────────────────────────────────────────────────────

router.get(
  "/classes/:classId/attendance",
  authenticate,
  authorize(...TEACHER_ROLES),
  teacherAttendanceController.getAttendanceSheet,
);

router.post(
  "/classes/:classId/attendance",
  authenticate,
  authorize(...TEACHER_ROLES),
  teacherAttendanceController.submitAttendance,
);

router.put(
  "/attendance/:attendanceId",
  authenticate,
  authorize(...TEACHER_ROLES),
  teacherAttendanceController.updateAttendanceRecord,
);

// ── Attendance: History & Analytics ──────────────────────────────────────────

router.get(
  "/classes/:classId/attendance/history",
  authenticate,
  authorize(...TEACHER_ROLES),
  teacherAttendanceController.getAttendanceHistory,
);

router.get(
  "/classes/:classId/attendance/analytics",
  authenticate,
  authorize(...TEACHER_ROLES),
  teacherAttendanceController.getAttendanceAnalytics,
);

// ── Leave Requests: review / approve / reject ─────────────────────────────────

router.get(
  "/leave-requests",
  authenticate,
  authorize(...TEACHER_ROLES),
  leaveRequestController.listLeaveRequests,
);

router.get(
  "/leave-requests/:leaveRequestId",
  authenticate,
  authorize(...TEACHER_ROLES),
  leaveRequestController.getLeaveRequestDetail,
);

router.put(
  "/leave-requests/:leaveRequestId/decision",
  authenticate,
  authorize(...TEACHER_ROLES),
  leaveRequestController.decideLeaveRequest,
);

// ── Homework Management ───────────────────────────────────────────────────────
// NOTE: static segments are declared before "/homework/:homeworkId" so Express
// does not match them as a homeworkId param.

router.get(
  "/homework/assignments",
  authenticate,
  authorize(...TEACHER_ROLES),
  homeworkController.getTeachingAssignments,
);

router.post(
  "/homework/attachments",
  authenticate,
  authorize(...TEACHER_ROLES),
  homeworkFileUpload,
  homeworkController.uploadAttachment,
);

router.get(
  "/homework/submissions/:submissionId/grade-log",
  authenticate,
  authorize(...TEACHER_ROLES),
  homeworkController.getGradeLog,
);

router.put(
  "/homework/submissions/:submissionId/grade",
  authenticate,
  authorize(...TEACHER_ROLES),
  homeworkController.gradeSubmission,
);

router.get(
  "/homework",
  authenticate,
  authorize(...TEACHER_ROLES),
  homeworkController.listHomework,
);

router.post(
  "/homework",
  authenticate,
  authorize(...TEACHER_ROLES),
  homeworkController.createHomework,
);

router.get(
  "/homework/:homeworkId",
  authenticate,
  authorize(...TEACHER_ROLES),
  homeworkController.getHomeworkDetail,
);

router.put(
  "/homework/:homeworkId",
  authenticate,
  authorize(...TEACHER_ROLES),
  homeworkController.updateHomework,
);

router.patch(
  "/homework/:homeworkId/status",
  authenticate,
  authorize(...TEACHER_ROLES),
  homeworkController.changeStatus,
);

router.get(
  "/homework/:homeworkId/submissions",
  authenticate,
  authorize(...TEACHER_ROLES),
  homeworkController.getSubmissions,
);

router.get(
  "/homework/:homeworkId/analytics",
  authenticate,
  authorize(...TEACHER_ROLES),
  homeworkController.getAnalytics,
);

router.delete(
  "/homework/:homeworkId/attachments/:attachmentId",
  authenticate,
  authorize(...TEACHER_ROLES),
  homeworkController.deleteAttachment,
);

// ── Academic Result Management ────────────────────────────────────────────────
// Static segments declared before "/academic/students/:studentId" etc.

router.get(
  "/academic/meta",
  authenticate, authorize(...TEACHER_ROLES),
  academicController.getMeta,
);

router.get(
  "/academic/scoresheet",
  authenticate, authorize(...TEACHER_ROLES),
  academicController.getScoreSheet,
);

router.post(
  "/academic/scores",
  authenticate, authorize(...TEACHER_ROLES),
  academicController.submitScores,
);

router.get(
  "/academic/scores/log",
  authenticate, authorize(...TEACHER_ROLES),
  academicController.getScoreLog,
);

router.put(
  "/academic/scores/:resultId",
  authenticate, authorize(...TEACHER_ROLES),
  academicController.updateScore,
);

router.delete(
  "/academic/scores/:resultId",
  authenticate, authorize(...TEACHER_ROLES),
  academicController.deleteScore,
);

router.get(
  "/academic/analytics/trend",
  authenticate, authorize(...TEACHER_ROLES),
  academicController.getTrend,
);

router.get(
  "/academic/analytics",
  authenticate, authorize(...TEACHER_ROLES),
  academicController.getAnalytics,
);

router.get(
  "/academic/warnings",
  authenticate, authorize(...TEACHER_ROLES),
  academicController.getWarnings,
);

router.post(
  "/academic/warnings/generate",
  authenticate, authorize(...TEACHER_ROLES),
  academicController.generateWarnings,
);

router.put(
  "/academic/warnings/:warningId",
  authenticate, authorize(...TEACHER_ROLES),
  academicController.updateWarning,
);

router.get(
  "/academic/students/:studentId",
  authenticate, authorize(...TEACHER_ROLES),
  academicController.getStudentAcademic,
);

// ── Behaviour Management ──────────────────────────────────────────────────────
// Static segments declared before "/behaviour/.../:param" routes.

router.get(
  "/behaviour/meta",
  authenticate, authorize(...TEACHER_ROLES),
  behaviourController.getMeta,
);

router.get(
  "/behaviour/records",
  authenticate, authorize(...TEACHER_ROLES),
  behaviourController.listRecords,
);

router.post(
  "/behaviour/records",
  authenticate, authorize(...TEACHER_ROLES),
  behaviourController.createRecord,
);

router.put(
  "/behaviour/records/:behaviorId",
  authenticate, authorize(...TEACHER_ROLES),
  behaviourController.updateRecord,
);

router.post(
  "/behaviour/records/:behaviorId/archive",
  authenticate, authorize(...TEACHER_ROLES),
  behaviourController.archiveRecord,
);

router.get(
  "/behaviour/records/:behaviorId/log",
  authenticate, authorize(...TEACHER_ROLES),
  behaviourController.getRecordLog,
);

router.get(
  "/behaviour/conduct",
  authenticate, authorize(...TEACHER_ROLES),
  behaviourController.getConductPreview,
);

router.post(
  "/behaviour/conduct",
  authenticate, authorize(...TEACHER_ROLES),
  behaviourController.evaluateConduct,
);

router.get(
  "/behaviour/analytics",
  authenticate, authorize(...TEACHER_ROLES),
  behaviourController.getAnalytics,
);

router.get(
  "/behaviour/warnings",
  authenticate, authorize(...TEACHER_ROLES),
  behaviourController.getWarnings,
);

router.post(
  "/behaviour/warnings/generate",
  authenticate, authorize(...TEACHER_ROLES),
  behaviourController.generateWarnings,
);

router.put(
  "/behaviour/warnings/:warningId",
  authenticate, authorize(...TEACHER_ROLES),
  behaviourController.updateWarning,
);

router.get(
  "/behaviour/students/:studentId",
  authenticate, authorize(...TEACHER_ROLES),
  behaviourController.getStudentBehaviour,
);

// ── Student Profile & Goal Management ─────────────────────────────────────────
// Static segments declared before ":studentId" / ":goalId" params.

router.get(
  "/students/meta",
  authenticate, authorize(...TEACHER_ROLES),
  studentProfileController.getMeta,
);

router.get(
  "/students/overview",
  authenticate, authorize(...TEACHER_ROLES),
  studentProfileController.getClassOverview,
);

router.get(
  "/goals/types",
  authenticate, authorize(...TEACHER_ROLES),
  goalController.getGoalTypes,
);

router.get(
  "/goals",
  authenticate, authorize(...TEACHER_ROLES),
  goalController.listClassGoals,
);

router.get(
  "/goals/:goalId/log",
  authenticate, authorize(...TEACHER_ROLES),
  goalController.getGoalLog,
);

router.put(
  "/goals/:goalId",
  authenticate, authorize(...TEACHER_ROLES),
  goalController.updateGoal,
);

router.patch(
  "/goals/:goalId/progress",
  authenticate, authorize(...TEACHER_ROLES),
  goalController.updateProgress,
);

router.post(
  "/goals/:goalId/evaluate",
  authenticate, authorize(...TEACHER_ROLES),
  goalController.evaluateGoal,
);

router.post(
  "/goals/:goalId/archive",
  authenticate, authorize(...TEACHER_ROLES),
  goalController.archiveGoal,
);

router.get(
  "/students/:studentId/profile",
  authenticate, authorize(...TEACHER_ROLES),
  studentProfileController.getProfile,
);

router.get(
  "/students/:studentId/attendance",
  authenticate, authorize(...TEACHER_ROLES),
  studentProfileController.getAttendanceHistory,
);

router.get(
  "/students/:studentId/goals",
  authenticate, authorize(...TEACHER_ROLES),
  goalController.listStudentGoals,
);

router.post(
  "/students/:studentId/goals",
  authenticate, authorize(...TEACHER_ROLES),
  goalController.createGoal,
);

// ── Reporting & Export ────────────────────────────────────────────────────────

router.get(
  "/reports/meta",
  authenticate, authorize(...TEACHER_ROLES),
  reportController.getMeta,
);

router.get(
  "/reports/history",
  authenticate, authorize(...TEACHER_ROLES),
  reportController.getHistory,
);

router.get(
  "/reports/templates",
  authenticate, authorize(...TEACHER_ROLES),
  reportController.listTemplates,
);

router.post(
  "/reports/templates",
  authenticate, authorize(...TEACHER_ROLES),
  reportController.createTemplate,
);

router.post(
  "/reports/templates/:templateId/run",
  authenticate, authorize(...TEACHER_ROLES),
  reportController.runTemplate,
);

router.delete(
  "/reports/templates/:templateId",
  authenticate, authorize(...TEACHER_ROLES),
  reportController.deleteTemplate,
);

router.post(
  "/reports/generate",
  authenticate, authorize(...TEACHER_ROLES),
  reportController.generate,
);

router.post(
  "/reports/export-excel",
  authenticate, authorize(...TEACHER_ROLES),
  reportController.exportExcel,
);

router.post(
  "/reports/log-export",
  authenticate, authorize(...TEACHER_ROLES),
  reportController.logExport,
);

// ── Communication: messaging ──────────────────────────────────────────────────

router.get(
  "/communication/dashboard",
  authenticate, authorize(...TEACHER_ROLES),
  communicationController.getDashboard,
);

router.get(
  "/communication/contacts",
  authenticate, authorize(...TEACHER_ROLES),
  communicationController.getContacts,
);

router.post(
  "/communication/upload",
  authenticate, authorize(...TEACHER_ROLES),
  messageFileUpload,
  communicationController.uploadFile,
);

router.get(
  "/communication/conversations",
  authenticate, authorize(...TEACHER_ROLES),
  communicationController.listConversations,
);

router.post(
  "/communication/conversations",
  authenticate, authorize(...TEACHER_ROLES),
  communicationController.startConversation,
);

router.post(
  "/communication/groups",
  authenticate, authorize(...TEACHER_ROLES),
  communicationController.createGroup,
);

router.get(
  "/communication/conversations/:conversationId",
  authenticate, authorize(...TEACHER_ROLES),
  communicationController.getThread,
);

router.post(
  "/communication/conversations/:conversationId/messages",
  authenticate, authorize(...TEACHER_ROLES),
  communicationController.sendMessage,
);

router.delete(
  "/communication/messages/:messageId",
  authenticate, authorize(...TEACHER_ROLES),
  communicationController.deleteMessage,
);

router.patch(
  "/communication/conversations/:conversationId/archive",
  authenticate, authorize(...TEACHER_ROLES),
  communicationController.archiveConversation,
);

// ── Communication: announcements ──────────────────────────────────────────────

router.get(
  "/announcements",
  authenticate, authorize(...TEACHER_ROLES),
  announcementController.list,
);

router.post(
  "/announcements",
  authenticate, authorize(...TEACHER_ROLES),
  announcementController.create,
);

router.put(
  "/announcements/:announcementId",
  authenticate, authorize(...TEACHER_ROLES),
  announcementController.update,
);

router.post(
  "/announcements/:announcementId/publish",
  authenticate, authorize(...TEACHER_ROLES),
  announcementController.publish,
);

router.patch(
  "/announcements/:announcementId/pin",
  authenticate, authorize(...TEACHER_ROLES),
  announcementController.pin,
);

router.post(
  "/announcements/:announcementId/archive",
  authenticate, authorize(...TEACHER_ROLES),
  announcementController.archive,
);

router.get(
  "/announcements/:announcementId/receipts",
  authenticate, authorize(...TEACHER_ROLES),
  announcementController.getReceipts,
);

// ── Parent Meetings ───────────────────────────────────────────────────────────
// Static segments before ":meetingId".

router.get(
  "/meetings/meta",
  authenticate, authorize(...TEACHER_ROLES),
  meetingController.getMeta,
);

router.get(
  "/meetings/dashboard",
  authenticate, authorize(...TEACHER_ROLES),
  meetingController.getDashboard,
);

router.get(
  "/meetings/classes/:classId/parents",
  authenticate, authorize(...TEACHER_ROLES),
  meetingController.getClassParents,
);

router.get(
  "/meetings",
  authenticate, authorize(...TEACHER_ROLES),
  meetingController.listMeetings,
);

router.post(
  "/meetings",
  authenticate, authorize(...TEACHER_ROLES),
  meetingController.createMeeting,
);

router.get(
  "/meetings/:meetingId",
  authenticate, authorize(...TEACHER_ROLES),
  meetingController.getDetail,
);

router.put(
  "/meetings/:meetingId",
  authenticate, authorize(...TEACHER_ROLES),
  meetingController.updateMeeting,
);

router.patch(
  "/meetings/:meetingId/status",
  authenticate, authorize(...TEACHER_ROLES),
  meetingController.changeStatus,
);

router.post(
  "/meetings/:meetingId/invitations",
  authenticate, authorize(...TEACHER_ROLES),
  meetingController.addInvitees,
);

router.post(
  "/meetings/:meetingId/invitations/:invitationId/resend",
  authenticate, authorize(...TEACHER_ROLES),
  meetingController.resendInvitation,
);

router.put(
  "/meetings/:meetingId/minutes",
  authenticate, authorize(...TEACHER_ROLES),
  meetingController.saveMinutes,
);

router.post(
  "/meetings/:meetingId/actions",
  authenticate, authorize(...TEACHER_ROLES),
  meetingController.createAction,
);

router.patch(
  "/meetings/:meetingId/actions/:actionId",
  authenticate, authorize(...TEACHER_ROLES),
  meetingController.updateActionStatus,
);

// ── Events ────────────────────────────────────────────────────────────────────
// Static segments before ":eventId".

router.get("/events/meta",      authenticate, authorize(...TEACHER_ROLES), eventController.getMeta);
router.get("/events/dashboard", authenticate, authorize(...TEACHER_ROLES), eventController.getDashboard);
router.get("/events/analytics", authenticate, authorize(...TEACHER_ROLES), eventController.getAnalytics);
router.get("/events/classes/:classId/contacts", authenticate, authorize(...TEACHER_ROLES), eventController.getClassContacts);

router.get("/events",  authenticate, authorize(...TEACHER_ROLES), eventController.listEvents);
router.post("/events", authenticate, authorize(...TEACHER_ROLES), eventController.createEvent);

router.get("/events/:eventId",        authenticate, authorize(...TEACHER_ROLES), eventController.getDetail);
router.put("/events/:eventId",        authenticate, authorize(...TEACHER_ROLES), eventController.updateEvent);
router.patch("/events/:eventId/status", authenticate, authorize(...TEACHER_ROLES), eventController.changeStatus);
router.post("/events/:eventId/duplicate", authenticate, authorize(...TEACHER_ROLES), eventController.duplicateEvent);
router.post("/events/:eventId/reminder",  authenticate, authorize(...TEACHER_ROLES), eventController.sendReminder);
router.put("/events/:eventId/outcome",    authenticate, authorize(...TEACHER_ROLES), eventController.saveOutcome);

router.post("/events/:eventId/participants", authenticate, authorize(...TEACHER_ROLES), eventController.addParticipants);
router.delete("/events/:eventId/participants/:registrationId", authenticate, authorize(...TEACHER_ROLES), eventController.removeParticipant);
router.patch("/events/:eventId/participants/:registrationId/attendance", authenticate, authorize(...TEACHER_ROLES), eventController.markAttendance);

router.post("/events/:eventId/documents", authenticate, authorize(...TEACHER_ROLES), eventFileUpload, eventController.uploadDocument);
router.delete("/events/:eventId/documents/:attachmentId", authenticate, authorize(...TEACHER_ROLES), eventController.deleteDocument);

// ── Timetable & Period-Swap (UC-83 / UC-87) ───────────────────────────────────

router.get("/timetable", authenticate, authorize(...TEACHER_ROLES), teacherTimetableController.getMyTimetable);
router.get("/timetable/substitutions/meta", authenticate, authorize(...TEACHER_ROLES), teacherTimetableController.getSubstitutionMeta);
router.get("/timetable/substitutions", authenticate, authorize(...TEACHER_ROLES), teacherTimetableController.listSubstitutions);
router.post("/timetable/substitutions", authenticate, authorize(...TEACHER_ROLES), teacherTimetableController.createSubstitution);
router.post("/timetable/substitutions/:substitutionId/cancel", authenticate, authorize(...TEACHER_ROLES), teacherTimetableController.cancelSubstitution);

// ── Critical Support Cases (UC-42) ────────────────────────────────────────────

router.get("/support-cases", authenticate, authorize(...TEACHER_ROLES), supportCaseController.listCases);
router.post("/support-cases", authenticate, authorize(...TEACHER_ROLES), supportCaseController.createCase);
router.get("/support-cases/:caseId/updates", authenticate, authorize(...TEACHER_ROLES), supportCaseController.getUpdates);
router.post("/support-cases/:caseId/updates", authenticate, authorize(...TEACHER_ROLES), supportCaseController.addUpdate);

module.exports = router;
