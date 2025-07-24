const express = require("express");
const router = express.Router();
const controller = require("../controllers/conversationNote.controller");
const { authenticateAdminJWT } = require("../middlewares/admin.middleware");

router.get(
  "/:conversation_id/notes",
  authenticateAdminJWT,
  controller.getNotes
);
router.post(
  "/:conversation_id/notes",
  authenticateAdminJWT,
  controller.createNote
);

module.exports = router;
