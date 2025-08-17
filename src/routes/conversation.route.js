const express = require("express");
const router = express.Router();
const controller = require("../controllers/conversation.controller");
const { authenticateAdminJWT } = require("../middlewares/admin.middleware");
const {
  uploadMessageFile,
} = require("../middlewares/uploadChatMedia.middleware");
// Récupérer toutes les conversations d'une girl
router.get(
  "/girl/:girl_id",
  authenticateAdminJWT,
  controller.getConversationsForGirl
);

// Récupérer les messages d'une conversation
router.get(
  "/:conversation_id/messages",
  authenticateAdminJWT,
  controller.getMessagesForConversation
);

// Envoyer un message dans une conversation
router.post(
  "/:conversation_id/messages",
  authenticateAdminJWT,
  uploadMessageFile,
  controller.sendMessageAsGirl
);

// Clients connectés sans conversation avec une girl
router.get(
  "/girl/:girl_id/available-clients",
  authenticateAdminJWT,
  controller.getAvailableClientsForGirl
);

router.delete("/messages/:id", authenticateAdminJWT, controller.deleteMessage);

router.post("/", controller.createConversation);
module.exports = router;
