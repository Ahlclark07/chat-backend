const express = require("express");
const router = express.Router();
const controller = require("../controllers/systemAlert.controller");
const {
  authenticateAdminJWT,
  authorizeRole,
} = require("../middlewares/admin.middleware");

// Routes accessibles uniquement aux SuperAdmins et Gods
router.get(
  "/",
  authenticateAdminJWT,
  authorizeRole("god", "superadmin"),
  controller.getAlerts
);

router.patch(
  "/:id/status",
  authenticateAdminJWT,
  authorizeRole("god", "superadmin"),
  controller.updateAlertStatus
);

module.exports = router;
