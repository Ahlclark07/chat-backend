const express = require("express");
const router = express.Router();
const chatController = require("../controllers/chat.controller");
const {
  uploadMessageFile,
} = require("../middlewares/uploadChatMedia.middleware");
const { authenticateJWT } = require("../middlewares/auth.middleware");
router.get(
  "/conversations",
  authenticateJWT,
  chatController.getClientConversations
);

router.post(
  "/:girl_id/message",
  authenticateJWT,
  uploadMessageFile,
  chatController.sendMessage
);

module.exports = router;
