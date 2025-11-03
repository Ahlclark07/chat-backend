const { AdminGirl, Girl, Conversation, Message } = require("../../models");
const { Op } = require("sequelize");
const {
  incrementAdminParticipation,
} = require("../services/conversationAssignment.service");

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) {
      return true;
    }
    if (["false", "0", "no", "off", ""].includes(normalized)) {
      return false;
    }
  }
  return fallback;
}

module.exports = {
  // 1️⃣ Voir les girls assignées
  getAssignedGirls: async (req, res) => {
    try {
      const adminId = req.admin.id;

      const girls = await Girl.findAll({
        include: {
          model: AdminGirl,
          as: "AdminGirl",
          where: { admin_id: adminId },
          attributes: [],
        },
      });

      res.json(girls);
    } catch (err) {
      console.error(err);
      res
        .status(500)
        .json({ message: "Erreur lors de la récupération des girls." });
    }
  },

  // 2️⃣ Voir les conversations d'une girl
  getConversationsByGirl: async (req, res) => {
    try {
      const { id: girlId } = req.params;
      const { page = 1, limit = 10, search = "" } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);

      const isLinked = await AdminGirl.findOne({
        where: { admin_id: req.admin.id, girl_id: girlId },
      });

      if (!isLinked) return res.status(403).json({ message: "Non autorisé." });

      // Recherche sur le client
      const whereClause = { girl_id: girlId };
      if (search) {
        whereClause["$Client.nom$"] = { [Op.like]: `%${search}%` }; // ou prénom
      }

      const { rows: conversations, count } = await Conversation.findAndCountAll(
        {
          where: whereClause,
          include: [
            {
              model: require("../../models").Client,
              attributes: ["id", "nom", "prenom", "photo_profil"],
            },
          ],
          order: [["updatedAt", "DESC"]],
          limit: parseInt(limit),
          offset,
        }
      );

      res.json({
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / limit),
        totalConversations: count,
        conversations,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  },
  // 3️⃣ Voir les messages d'une conversation
  getMessages: async (req, res) => {
    try {
      const { id: conversationId } = req.params;
      const { page = 1, limit = 20 } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);

      const conv = await Conversation.findByPk(conversationId);
      if (!conv)
        return res.status(404).json({ message: "Conversation introuvable." });

      const isLinked = await AdminGirl.findOne({
        where: { admin_id: req.admin.id, girl_id: conv.girl_id },
      });

      if (!isLinked) return res.status(403).json({ message: "Non autorisé." });

      const { count, rows: messages } = await Message.findAndCountAll({
        where: { conversation_id: conversationId },
        order: [["createdAt", "DESC"]],
        limit: parseInt(limit),
        offset,
      });

      res.json({
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / limit),
        totalMessages: count,
        messages: messages.reverse(), // pour affichage chronologique croissant
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  },
  // 4️⃣ Répondre dans une conversation en tant que girl
  replyAsGirl: async (req, res) => {
    try {
      const { id: conversationId } = req.params;
      const { body, isFollowUp, is_follow_up } = req.body;

      const conv = await Conversation.findByPk(conversationId);
      if (!conv)
        return res.status(404).json({ message: "Conversation introuvable." });

      const isLinked = await AdminGirl.findOne({
        where: { admin_id: req.admin.id, girl_id: conv.girl_id },
      });

      if (!isLinked) return res.status(403).json({ message: "Non autorisé." });

      const message = await Message.create({
        conversation_id: conversationId,
        sender_type: "girl",
        sender_id: req.admin.id,
        receiver_id: conv.client_id,
        body,
        is_follow_up: parseBoolean(isFollowUp ?? is_follow_up, false),
      });

      await incrementAdminParticipation(conversationId, req.admin.id);

      // Forbidden words alert when admin (as girl) sends a message
      if (body) {
        try {
          const { findForbiddenWordsIn } = require("../utils/forbiddenWords.util");
          const { notifyForbiddenWordAlert } = require("../services/alert.service");
          const matched = await findForbiddenWordsIn(body);
          if (matched.length > 0) {
            notifyForbiddenWordAlert({
              conversationId: parseInt(conversationId, 10),
              senderType: "girl",
              senderAdminId: req.admin.id,
              messageBody: body,
              matchedWords: matched,
            }).catch(() => {});
          }
        } catch (_) {}
      }

      res.status(201).json(message);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Erreur lors de l’envoi." });
    }
  },
  deleteMessage: async (req, res) => {
    try {
      const { id } = req.params;

      const message = await Message.findByPk(id);
      if (!message)
        return res.status(404).json({ message: "Message introuvable." });

      if (message.sender_type === "client") {
        return res
          .status(403)
          .json({ message: "Tu ne peux pas supprimer les messages client." });
      }

      const conversation = await Conversation.findByPk(message.conversation_id);
      if (!conversation)
        return res.status(404).json({ message: "Conversation non trouvée." });

      const isLinked = await AdminGirl.findOne({
        where: { admin_id: req.admin.id, girl_id: conversation.girl_id },
      });

      if (!isLinked) return res.status(403).json({ message: "Non autorisé." });

      await message.destroy();
      res.json({ message: "Message supprimé avec succès." });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Erreur lors de la suppression." });
    }
  },
};
