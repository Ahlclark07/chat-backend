const { AdminGirl, Girl, Conversation, Message } = require("../../models");
const { Op } = require("sequelize");

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
      const { body } = req.body;

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
        body,
      });

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
