const {
  Conversation,
  Message,
  CreditTransaction,
  Girl,
} = require("../../models");
const { Op } = require("sequelize");

module.exports = {
  createConversation: async (req, res) => {
    try {
      const { girl_id } = req.body;

      if (!girl_id) {
        return res.status(400).json({ message: "girl_id manquant." });
      }

      // Vérifier si une conversation déjà active existe
      const existing = await Conversation.findOne({
        where: {
          client_id: req.user.id,
          girl_id,
          closed_at: { [Op.is]: null },
        },
      });

      if (existing) {
        return res.status(200).json(existing); // déjà existante
      }

      const newConv = await Conversation.create({
        client_id: req.user.id,
        girl_id,
        opened_at: new Date(),
      });

      return res.status(201).json(newConv);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  },
  // Liste des conversations du client
  getConversations: async (req, res) => {
    try {
      const conversations = await Conversation.findAll({
        where: { client_id: req.user.id },
        include: {
          model: Girl,
          as: "girl",
          attributes: ["id", "nom", "prenom", "photo_profil"],
        },
      });
      res.json(conversations);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  },

  // Récupérer les messages d’une conversation
  getMessages: async (req, res) => {
    try {
      const { id } = req.params;
      const conversation = await Conversation.findOne({
        where: {
          id,
          client_id: req.user.id,
        },
      });

      if (!conversation) {
        return res.status(404).json({ message: "Conversation non trouvée." });
      }

      const messages = await Message.findAll({
        where: { conversation_id: id },
        order: [["createdAt", "ASC"]],
      });

      res.json(messages);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  },

  // Envoyer un message
  sendMessage: async (req, res) => {
    try {
      const { id } = req.params;
      const { body } = req.body;
      const conversation = await Conversation.findOne({
        where: { id, client_id: req.user.id },
      });

      if (!conversation) {
        return res.status(404).json({ message: "Conversation introuvable." });
      }

      // Vérification crédit
      const client = req.user;
      const mediaPath = req.file ? req.file.path : null;

      const message = await Message.create({
        conversation_id: id,
        sender_type: "client",
        body,
        media_url: mediaPath, // ← ajoute ce champ à ton modèle si besoin
      });

      await CreditTransaction.create({
        client_id: client.id,
        conversation_id: id,
        message_id: message.id,
        amount: -1,
      });

      // 💡 Plus tard : broadcast via socket.io
      res.status(201).json(message);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Erreur lors de l’envoi du message." });
    }
  },
};
