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

module.exports = router;
