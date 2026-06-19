const express = require("express");

const parentController      = require("../controllers/parent.controller");
const attendanceController  = require("../controllers/attendance.controller");
const leaveRequestController = require("../controllers/leave-request.controller");

const {
  authenticate,
  authorize,
} = require("../middleware/auth.middleware");
const { handleUpload } = require("../middleware/upload.middleware");
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
  parentController.getStudentProfile,
);

router.get(
  "/me/students/:studentId/timetable",
  authenticate,
  authorize("PARENT"),
  parentController.getStudentTimetable,
);

router.get(
  "/me/students/:studentId/grades",
  authenticate,
  authorize("PARENT"),
  parentController.getStudentGrades,
);

router.get(
  "/me/students/:studentId/attendance/stats",
  authenticate,
  authorize("PARENT"),
  attendanceController.getStudentAttendanceStats,
);

router.get(
  "/me/students/:studentId/attendance/history",
  authenticate,
  authorize("PARENT"),
  attendanceController.getStudentAttendanceHistory,
);

router.post(
  "/me/students/:studentId/leave-requests",
  authenticate,
  authorize("PARENT"),
  handleUpload,
  leaveRequestController.createLeaveRequest,
);

router.get(
  "/me/students/:studentId/leave-requests",
  authenticate,
  authorize("PARENT"),
  leaveRequestController.getStudentLeaveRequests,
);

router.get(
  "/me/students/:studentId/leave-requests/:leaveRequestId",
  authenticate,
  authorize("PARENT"),
  leaveRequestController.getLeaveRequestDetail,
);

router.patch(
  "/me/students/:studentId/leave-requests/:leaveRequestId/cancel",
  authenticate,
  authorize("PARENT"),
  leaveRequestController.cancelLeaveRequest,
);

module.exports = router;
