const express = require("express");
const router = express.Router();
const controller = require("../controllers/signalement.controller");
const {
  authenticateAdminJWT,
  authorizeRole,
} = require("../middlewares/admin.middleware");

router.post(
  "/signalements",
  authenticateAdminJWT,
  authorizeRole("admin", "superadmin", "god"),
  controller.create
);

router.get(
  "/signalements",
  authenticateAdminJWT,
  authorizeRole("superadmin", "god"),
  controller.list
);

router.get(
  "/signalements/:id",
  authenticateAdminJWT,
  authorizeRole("superadmin", "god"),
  controller.getById
);

router.patch(
  "/signalements/:id/status",
  authenticateAdminJWT,
  authorizeRole("god"),
  controller.updateStatus
);

router.delete(
  "/signalements/:id",
  authenticateAdminJWT,
  authorizeRole("god"),
  controller.remove
);

module.exports = router;
