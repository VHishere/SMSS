const express = require("express");

const studentController = require(
  "../controllers/student.controller",
);

const {
  authenticate,
  authorize,
} = require("../middleware/auth.middleware");

const router = express.Router();

router.get(
  "/me",
  authenticate,
  authorize("STUDENT"),
  studentController.getMyProfile,
);

module.exports = router;