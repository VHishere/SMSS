const express = require("express");

const staffController = require("../controllers/staff.controller");

const {
  authenticate,
  authorize,
} = require("../middleware/auth.middleware");

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
  "/school-years/:id/activate",
  authenticate,
  authorize(...staffRoles),
  staffController.activateSchoolYear,
);

router.put(
  "/school-years/:id",
  authenticate,
  authorize(...staffRoles),
  staffController.updateSchoolYear,
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
  "/activities",
  authenticate,
  authorize(...staffRoles),
  staffController.getStaffActivities,
);

router.post(
  "/activities",
  authenticate,
  authorize(...staffRoles),
  staffController.createStaffActivity,
);

router.delete(
  "/activities/:eventId",
  authenticate,
  authorize(...staffRoles),
  staffController.deleteStaffActivity,
);

router.get(
  "/promotion/candidates",
  authenticate,
  authorize(...staffRoles),
  staffController.getPromotionCandidates,
);

router.get(
  "/promotion/target-classes",
  authenticate,
  authorize(...staffRoles),
  staffController.getTargetClasses,
);

router.post(
  "/promotion",
  authenticate,
  authorize(...staffRoles),
  staffController.promoteStudents,
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

router.get(
  "/year-schedule",
  authenticate,
  authorize(...staffRoles),
  staffController.getYearSchedule,
);

router.post(
  "/year-schedule",
  authenticate,
  authorize(...staffRoles),
  staffController.createYearScheduleEntry,
);

router.put(
  "/year-schedule/:id",
  authenticate,
  authorize(...staffRoles),
  staffController.updateYearScheduleEntry,
);

router.delete(
  "/year-schedule/:id",
  authenticate,
  authorize(...staffRoles),
  staffController.deleteYearScheduleEntry,
);

router.post(
  "/school-years/:id/year-schedule/generate",
  authenticate,
  authorize(...staffRoles),
  staffController.generateYearSchedule,
);

module.exports = router;
