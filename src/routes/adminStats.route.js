const express = require("express");
const router = express.Router();
const controller = require("../controllers/adminStats.controller");
const {
  authenticateAdminJWT,
  authorizeRole,
} = require("../middlewares/admin.middleware");

router.get(
  "/:adminId/stats",
  authenticateAdminJWT,

  controller.getAdminStats
);

module.exports = router;
