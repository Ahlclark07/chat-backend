const express = require("express");
const router = express.Router();
const chatController = require("../controllers/chat.controller");
const {
  uploadMessageFile,
} = require("../middlewares/uploadChatMedia.middleware");
const { authenticateJWT } = require("../middlewares/auth.middleware");

router.get("/conversations", authenticateJWT, chatController.getConversations);
router.get(
  "/conversations/:id/messages",
  authenticateJWT,
  chatController.getMessages
);
router.post(
  "/conversations/:id/messages",
  authenticateJWT,
  chatController.sendMessage
);
router.post(
  "/conversations",
  authenticateJWT,
  chatController.createConversation
);
router.post(
  "/conversations/:id/messages",
  authenticateJWT,
  uploadMessageFile,
  chatController.sendMessage
);

module.exports = router;
