const {
  Conversation,
  Message,
  Client,
  Girl,
  Admin,
  ClientBlock,
} = require("../../models");
const { Op } = require("sequelize");
const path = require("path");
const fs = require("fs");
const {
  incrementAdminParticipation,
} = require("../services/conversationAssignment.service");
const { clientIdToSocketId } = require("../sockets/index");
const {
  formatMessages,
  scrubIdentifiant,
} = require("../utils/messageFormatter");

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
    const exposeIdentifiant = req.admin?.role === "god";

    // 1. Fetch conversations (lighter query)
    const conversations = await Conversation.findAll({
      where: { girl_id },
      include: [
        { model: Client, as: "client" },
        {
          model: Admin,
          as: "assigned_admin",
          attributes: ["id", "nom", "prenom", "identifiant"],
        },
      ],
      // We initially order by updatedAt, but we will re-sort by message date
      order: [["updatedAt", "DESC"]],
    });

    // 2. Hydrate with LAST message only (N+1 but limited scope is better than 10k messages)
    // Ideally we would use a lateral join or window function, but Sequelize is tricky there.
    const conversationsWithLastMessage = await Promise.all(
      conversations.map(async (conv) => {
        const json = conv.toJSON();

        // Fetch strictly the last message
        const lastMsg = await Message.findOne({
          where: { conversation_id: conv.id },
          order: [["createdAt", "DESC"]],
          include: [
            {
              model: Admin,
              as: "sender_admin",
              attributes: ["id", "nom", "prenom", "identifiant"],
            },
          ],
        });

        // Format as an array of 1 for compatibility with existing frontend logic (or change frontend)
        // User asked to mimic frontend which expects 'messages' array usually?
        // Actually, let's return a special 'last_message' field or a 'messages' array with 1 item.
        // The existing frontend expects `messages.at(-1)`.

        json.messages = lastMsg ? [lastMsg] : []; // Only the last message!

        // Scrub ID if needed
        if (lastMsg) {
          const formattedMsgs = formatMessages([lastMsg], {
            assignedAdmin: json.assigned_admin,
            exposeAdminIdentifiers: exposeIdentifiant,
          });
          json.messages = formattedMsgs;
        }

        if (!exposeIdentifiant && json.assigned_admin) {
          json.assigned_admin = scrubIdentifiant(json.assigned_admin, false);
        }

        return json;
      })
    );

    // 3. Sort Key: Last Message Date > Conversation UpdatedAt
    conversationsWithLastMessage.sort((a, b) => {
      const dateA = a.messages.length
        ? new Date(a.messages[0].createdAt).getTime()
        : new Date(a.updatedAt).getTime();
      const dateB = b.messages.length
        ? new Date(b.messages[0].createdAt).getTime()
        : new Date(b.updatedAt).getTime();
      return dateB - dateA;
    });

    res.json(conversationsWithLastMessage);
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
  const limit = parseInt(req.query.limit, 10) || 100; // Default 100
  const offset = parseInt(req.query.offset, 10) || 0;

  try {
    const exposeIdentifiant = req.admin?.role === "god";
    const conversation = await Conversation.findByPk(conversation_id, {
      include: [
        {
          model: Admin,
          as: "assigned_admin",
          attributes: ["id", "nom", "prenom", "identifiant"],
        },
      ],
    });

    if (!conversation) {
      return res.status(404).json({ message: "Conversation introuvable." });
    }

    const messages = await Message.findAll({
      where: { conversation_id },
      order: [["createdAt", "DESC"]], // Reverse order for pagination (newest first)
      limit,
      offset,
      include: [
        {
          model: Admin,
          as: "sender_admin",
          attributes: ["id", "nom", "prenom", "identifiant"],
        },
      ],
    });

    // We must reverse them back to ASC for display usually, or handle in frontend.
    // Frontend expects ASC usually (oldest at top).
    // If we paginate, we usually fetch "last 20".

    // For now, let's return them as is (DESC) and let frontend reverse, or reverse here.
    const sortedMessages = messages.sort((a, b) => a.id - b.id);

    res.json(
      formatMessages(sortedMessages, {
        assignedAdmin: conversation.assigned_admin?.toJSON
          ? conversation.assigned_admin.toJSON()
          : conversation.assigned_admin,
        exposeAdminIdentifiers: exposeIdentifiant,
      })
    );
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

    const blocked = await ClientBlock.findOne({
      where: {
        client_id: conversation.client_id,
        girl_id: conversation.girl_id,
      },
      attributes: ["id"],
    });
    if (blocked) {
      return res.status(403).json({
        message:
          "Le client a bloqué ce profil. Impossible d'envoyer un message.",
      });
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

    // Check for suspicious content (system alert)
    // Check for suspicious content (system alert)
    const {
      checkSuspiciousContent,
      checkRepeatedAdminMessage,
    } = require("../utils/securityScanner");
    checkSuspiciousContent(
      body,
      req.admin.id,
      conversation_id,
      conversation.client_id
    ).catch((err) => console.error("Suspicious check error:", err));

    checkRepeatedAdminMessage({
      adminId: req.admin.id,
      clientId: conversation.client_id,
      conversationId: conversation.id,
      messageBody: body,
    }).catch((err) => console.error("Repeated message check error:", err));

    res.status(201).json(message);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Erreur lors de l'envoi du message." });
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

    const blockedClients = await ClientBlock.findAll({
      where: { girl_id },
      attributes: ["client_id"],
      raw: true,
    });
    const blockedClientIds = blockedClients
      .map((b) => b.client_id)
      .filter(Boolean);

    const availableIds = onlineClientIds.filter(
      (id) =>
        !clientIdsInConversation.includes(id) &&
        !blockedClientIds.includes(id)
    );

    const clients = await Client.findAll({
      where: {
        id: { [Op.in]: availableIds },
      },
    });

    res.json(clients);
  } catch (err) {
    console.error(err);
    res.status(500).json({
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

// 7. Recuperer une conversation par ID (Metadata)
exports.getConversationDetails = async (req, res) => {
  const { id } = req.params;
  try {
    const conversation = await Conversation.findByPk(id, {
      include: [
        { model: Girl, as: "girl" },
        { model: Client, as: "client" },
        {
          model: Admin,
          as: "assigned_admin",
          attributes: ["id", "nom", "prenom", "identifiant"],
        },
      ],
    });

    if (!conversation) {
      return res.status(404).json({ message: "Conversation introuvable" });
    }

    res.json(conversation);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};
