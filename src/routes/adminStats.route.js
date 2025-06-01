const express = require("express");
const router = express.Router();
const controller = require("../controllers/adminStats.controller");
const {
  authenticateAdminJWT,
  authorizeRole,
} = require("../middlewares/admin.middleware");

router.get(
  "/stats",
  authenticateAdminJWT,
  authorizeRole("god", "superadmin"),
  controller.getGlobalStats
);

module.exports = router;
