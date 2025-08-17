const {
  Conversation,
  Message,
  CreditTransaction,
  Girl,
  Client,
} = require("../../models");
const { handleClientMessage } = require("../sockets/messages-dispatcher");

const { Op } = require("sequelize");
const path = require("path");
const fs = require("fs");
// GET /chat/conversations
module.exports.getClientConversations = async (req, res) => {
  try {
    const conversations = await Conversation.findAll({
      where: { client_id: req.user.id },
      include: [
        {
          association: "girl",
        },
        {
          association: "messages",
          separate: true,
          order: [["createdAt", "ASC"]],
        },
      ],
      order: [["updatedAt", "DESC"]],
    });

    res.status(200).json(conversations);
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ message: "Erreur lors du chargement des conversations." });
  }
};

module.exports.sendMessage = async (req, res) => {
  try {
    const clientId = req.user.id;
    const girlId = parseInt(req.params.girl_id); // girl_id passé dans l'URL
    const { body } = req.body;

    if (!body && !req.files?.media) {
      return res.status(400).json({ message: "Message vide." });
    }

    // Vérifier ou créer la conversation
    let conversation = await Conversation.findOne({
      where: {
        client_id: clientId,
        girl_id: girlId,
      },
    });

    if (!conversation) {
      conversation = await Conversation.create({
        client_id: clientId,
        girl_id: girlId,
      });
    }

    // Gestion du média
    let mediaPath = null;
    if (req.file) {
      mediaPath = req.file.filename;
    }

    // Créer le message
    const message = await Message.create({
      conversation_id: conversation.id,
      sender_type: "client",
      sender_id: clientId,
      receiver_id: girlId,
      body,
      media_url: mediaPath,
    });
    const client = await Client.findByPk(clientId);
    // Débiter 1 coin
    await client.update({ credit_balance: client.credit_balance - 1 });
    await CreditTransaction.create({
      client_id: clientId,
      conversation_id: conversation.id,
      message_id: message.id,
      amount: -1,
    });

    const io = req.app.get("io");
    // 🚨 Si c’est bien un client qui envoie
    await handleClientMessage(io, {
      conversationId: conversation.id,
    });
    return res.status(201).json({ message });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ message: "Erreur lors de l'envoi du message." });
  }
};
