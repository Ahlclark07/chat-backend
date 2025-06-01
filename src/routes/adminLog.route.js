const express = require("express");
const router = express.Router();
const controller = require("../controllers/adminLog.controller");
const {
  authenticateAdminJWT,
  authorizeRole,
} = require("../middlewares/admin.middleware");

router.get(
  "/logs",
  authenticateAdminJWT,
  authorizeRole("god", "superadmin"),
  controller.getLogs
);

module.exports = router;
