const express = require("express");
const router = express.Router();

const testController = require("../controllers/test.controller");

// Example: GET /api/test/mail/welcome?to=user@example.com
router.get("/mail/welcome", testController.sendWelcomeTest);
router.get("/mail/logs", testController.getMailLogs);

module.exports = router;
