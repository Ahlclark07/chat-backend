// routes/admin.routes.js
const express = require("express");
const router = express.Router();
const dashboardController = require("../controllers/admin/dashboard.controller");
const girlController = require("../controllers/admin/girl.controller");
const { authAdmin } = require("../middlewares/auth.middleware");

// GET /api/admins/dashboard
router.get("/dashboard", authAdmin, dashboardController.getStats);

// DELETE /api/admins/girls/:id
router.delete("/girls/:id", authAdmin, girlController.deleteGirl);

// GET /api/admins/girls-summary?page=1
router.get("/girls-summary", authAdmin, girlController.getPaginatedSummary);

module.exports = router;
