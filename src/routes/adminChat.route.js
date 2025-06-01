const express = require("express");
const router = express.Router();
const controller = require("../controllers/adminChat.controller");
const { authenticateAdminJWT } = require("../middlewares/admin.middleware");

// Girls assignées à cet admin
router.get("/girls", authenticateAdminJWT, controller.getAssignedGirls);

// Conversations d’une girl
router.get(
  "/girls/:id/conversations",
  authenticateAdminJWT,
  controller.getConversationsByGirl
);

// Messages d’une conversation
router.get(
  "/conversations/:id/messages",
  authenticateAdminJWT,
  controller.getMessages
);

// Répondre en tant que girl
router.post(
  "/conversations/:id/messages",
  authenticateAdminJWT,
  controller.replyAsGirl
);
router.delete("/messages/:id", authenticateAdminJWT, controller.deleteMessage);

module.exports = router;
