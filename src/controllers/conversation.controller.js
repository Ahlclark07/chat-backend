const { Conversation, Message, Client, Girl } = require("../../models");
const { Op } = require("sequelize");
const path = require("path");
const fs = require("fs");
const {
  incrementAdminParticipation,
} = require("../services/conversationAssignment.service");
const { clientIdToSocketId } = require("../sockets/index");

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

// 1. Recuperer les conversations d'une girl
exports.getConversationsForGirl = async (req, res) => {
  const { girl_id } = req.params;
  try {
    const conversations = await Conversation.findAll({
      where: { girl_id },
      include: [
        { model: Client, as: "client" },
        {
          association: "messages",
          separate: true,
          order: [["createdAt", "ASC"]],
        },
      ],
      order: [["updatedAt", "DESC"]],
    });
    res.json(conversations);
  } catch (err) {
    console.log(err);
    res
      .status(500)
      .json({ message: "Erreur lors du chargement des conversations." });
  }
};

// 2. Recuperer les messages d'une conversation
exports.getMessagesForConversation = async (req, res) => {
  const { conversation_id } = req.params;
  try {
    const messages = await Message.findAll({
      where: { conversation_id },
      order: [["createdAt", "ASC"]],
    });
    res.json(messages);
  } catch (err) {
    console.log(err);
    res
      .status(500)
      .json({ message: "Erreur lors du chargement des messages." });
  }
};

// 3. Envoyer un message en se faisant passer pour la girl
exports.sendMessageAsGirl = async (req, res) => {
  const { conversation_id } = req.params;
  const { contenu, isFollowUp, is_follow_up } = req.body;
  const body = contenu;

  try {
    const conversation = await Conversation.findByPk(conversation_id, {
      include: { model: Girl, as: "girl" },
    });
    if (!conversation) {
      return res.status(404).json({ message: "Conversation introuvable." });
    }

    let mediaPath = null;
    if (req.file) {
      mediaPath = req.file.filename;
    }

    const message = await Message.create({
      conversation_id,
      body,
      sender_type: "girl",
      sender_id: req.admin.id,
      receiver_id: conversation.client_id,
      media_url: mediaPath,
      is_follow_up: parseBoolean(isFollowUp ?? is_follow_up, false),
    });

    await incrementAdminParticipation(conversation.id, req.admin.id);

    const io = req.app.get("io");
    if (io) {
      io.to(`conversation_${conversation.id}`).emit("ping_message", {
        girl_id: conversation.girl.id,
        nom: conversation.girl.nom,
        prenom: conversation.girl.prenom,
        photo_profil: conversation.girl.photo_profil,
        body: message.body,
      });
    }

    res.status(201).json(message);
  } catch (err) {
    console.log(err);
    res
      .status(500)
      .json({ message: "Erreur lors de l'envoi du message." });
  }
};

// 4. Recuperer les clients disponibles pour une girl
exports.getAvailableClientsForGirl = async (req, res) => {
  const { girl_id } = req.params;
  try {
    const existingConversations = await Conversation.findAll({
      where: { girl_id },
      attributes: ["client_id"],
    });
    const clientIdsInConversation = existingConversations.map(
      (c) => c.client_id
    );

    const onlineClientIds = Array.from(clientIdToSocketId.keys()).map((id) =>
      parseInt(id, 10)
    );

    const availableIds = onlineClientIds.filter(
      (id) => !clientIdsInConversation.includes(id)
    );

    const clients = await Client.findAll({
      where: {
        id: { [Op.in]: availableIds },
      },
    });

    res.json(clients);
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({
        message: "Erreur lors du chargement des clients disponibles.",
      });
  }
};

// 5. Creer une conversation
exports.createConversation = async (req, res) => {
  const { girl_id, client_id } = req.body;

  try {
    const existing = await Conversation.findOne({
      where: { girl_id, client_id },
    });

    if (existing) {
      return res.status(200).json(existing);
    }

    const conversation = await Conversation.create({
      girl_id,
      client_id,
    });

    res.status(201).json(conversation);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Erreur lors de la creation de la conversation.",
    });
  }
};

// 6. Supprimer un message
exports.deleteMessage = async (req, res) => {
  const { id } = req.params;

  if (!["superadmin", "god"].includes(req.admin.role)) {
    return res.status(403).json({ error: "Acces refuse" });
  }

  try {
    const message = await Message.findByPk(id);
    if (!message) {
      console.log("introuvable");
      return res.status(404).json({ error: "Message introuvable" });
    }

    if (message.media_url) {
      const filePath = path.join(
        __dirname,
        "..",
        "..",
        "uploads",
        "messages",
        message.media_url
      );
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (e) {
        console.warn("Suppression media echouee:", filePath, e.message);
      }
    }

    await message.destroy();

    res.json({ success: true, message: "Message supprime avec succes." });
  } catch (err) {
    console.error("Erreur lors de la suppression :", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
};
