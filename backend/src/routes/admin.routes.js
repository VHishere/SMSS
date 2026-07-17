const express = require("express");

const adminController = require("../controllers/admin.controller");

const {
  authenticate,
  authorize,
} = require("../middleware/auth.middleware");

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

module.exports = router;
