// routes/admin.routes.js
const express = require("express");
const router = express.Router();
const dashboardController = require("../controllers/dashboard.controller");
const girlController = require("../controllers/adminGirl.controller");
const { authenticateAdminJWT } = require("../middlewares/admin.middleware");

// GET /api/admins/dashboard
router.get("/dashboard", authenticateAdminJWT, dashboardController.getStats);

// DELETE /api/admins/girls/:id
router.delete("/girls/:id", authenticateAdminJWT, girlController.deleteGirl);

// GET /api/admins/girls-summary?page=1
router.get(
  "/girls-summary",
  authenticateAdminJWT,
  girlController.getPaginatedSummary
);

module.exports = router;
