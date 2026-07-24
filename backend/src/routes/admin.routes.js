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

router.get(
  "/roles",
  authenticate,
  authorize("ADMIN"),
  adminController.getRoles,
);

router.get(
  "/users/:id",
  authenticate,
  authorize("ADMIN"),
  adminController.getUserDetail,
);

router.put(
  "/users/:id/roles",
  authenticate,
  authorize("ADMIN"),
  adminController.updateUserRoles,
);

router.put(
  "/users/:id/children",
  authenticate,
  authorize("ADMIN"),
  adminController.updateUserChildren,
);

module.exports = router;
