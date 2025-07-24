const { Conversation, Message, Client, Girl } = require("../../models");
const { Op } = require("sequelize");

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

    const message = await Message.create({
      conversation_id,
      body,
      sender_type: "girl",
      sender_id: conversation.girl_id,
      receiver_id: conversation.client_id,
    });

    await Conversation.update(
      { updatedAt: new Date() },
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

const { onlineClients } = require("../sockets/onlineClients"); // ← on importe ici

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
    const onlineClientIds = Array.from(onlineClients.keys()).map((id) =>
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
      limit: 10,
      attributes: ["id", "nom", "prenom"],
    });

    res.json(clients);
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ message: "Erreur lors du chargement des clients disponibles." });
  }
};
