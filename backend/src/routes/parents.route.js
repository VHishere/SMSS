const express = require("express");

const parentController = require(
  "../controllers/parent.controller",
);

const {
  authenticate,
  authorize,
} = require("../middleware/auth.middleware");

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

module.exports = router;
