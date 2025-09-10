const { Conversation, Message, Client, Girl } = require("../../models");
const { Op } = require("sequelize");
const path = require("path");
const fs = require("fs");

// 1. Récupérer les conversations d'une girl
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

// 2. Récupérer les messages d'une conversation
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
exports.sendMessageAsGirl = async (req, res) => {
  console.log(req.body);
  const { conversation_id } = req.params;
  const { contenu } = req.body;
  const body = contenu;

  try {
    const conversation = await Conversation.findByPk(conversation_id, {
      include: { model: Girl, as: "girl" },
    });
    if (!conversation) {
      return res.status(404).json({ message: "Conversation introuvable." });
    }
    // Gestion du média
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
    });

    // Mettre à jour la conversation: date et admin assigné
    await Conversation.update(
      { updatedAt: new Date(), assigned_admin_id: req.admin.id },
      { where: { id: conversation_id } }
    );
    const io = req.app.get("io"); // assure-toi que tu fais `app.set('io', io)` dans server.js
    io.to(`conversation_${conversation.id}`).emit("ping_message", {
      girl_id: conversation.girl.id,
      nom: conversation.girl.nom,
      prenom: conversation.girl.prenom,
      photo_profil: conversation.girl.photo_profil,
      body: message.body,
    });

    res.status(201).json(message);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Erreur lors de l'envoi du message." });
  }
};

const { connectedClients, clientIdToSocketId } = require("../sockets/index"); // ← on importe ici

exports.getAvailableClientsForGirl = async (req, res) => {
  const { girl_id } = req.params;
  try {
    // 1️⃣ Récupérer les clients déjà en conversation avec cette girl
    const existingConversations = await Conversation.findAll({
      where: { girl_id },
      attributes: ["client_id"],
    });
    const clientIdsInConversation = existingConversations.map(
      (c) => c.client_id
    );

    // 2️⃣ Extraire les IDs de clients connectés depuis la Map
    const onlineClientIds = Array.from(clientIdToSocketId.keys()).map((id) =>
      parseInt(id)
    );

    // 3️⃣ Filtrer : en ligne ET pas déjà en conversation
    const availableIds = onlineClientIds.filter(
      (id) => !clientIdsInConversation.includes(id)
    );

    // 4️⃣ Charger les données des 10 clients disponibles
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
      .json({ message: "Erreur lors du chargement des clients disponibles." });
  }
};
exports.createConversation = async (req, res) => {
  const { girl_id, client_id } = req.body;

  try {
    // Vérifier si la conversation existe déjà
    const existing = await Conversation.findOne({
      where: { girl_id, client_id },
    });

    if (existing) {
      return res.status(200).json(existing);
    }

    // Créer la conversation vide
    const conversation = await Conversation.create({
      girl_id,
      client_id,
    });

    res.status(201).json(conversation);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Erreur lors de la création de la conversation.",
    });
  }
};

exports.deleteMessage = async (req, res) => {
  const { id } = req.params;

  if (!["superadmin", "god"].includes(req.admin.role)) {
    return res.status(403).json({ error: "Accès refusé" });
  }

  try {
    const message = await Message.findByPk(id);
    if (!message) {
      console.log("introuvable");
      return res.status(404).json({ error: "Message introuvable" });
    }

    // Supprimer le média associé si présent
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
        console.warn("Suppression média échouée:", filePath, e.message);
      }
    }

    await message.destroy();

    res.json({ success: true, message: "Message supprimé avec succès." });
  } catch (err) {
    console.error("Erreur lors de la suppression :", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
};
