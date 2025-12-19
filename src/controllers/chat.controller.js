const {
  Conversation,
  Message,
  CreditTransaction,
  Girl,
  Client,
  Setting,
  sequelize,
} = require("../../models");
const { handleClientMessage } = require("../sockets/messages-dispatcher");
const { findForbiddenWordsIn } = require("../utils/forbiddenWords.util");
const { notifyForbiddenWordAlert } = require("../services/alert.service");

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
  let transaction;
  try {
    const clientId = req.user.id;
    const girlId = parseInt(req.params.girl_id, 10); // girl_id passe dans l'URL
    const { body } = req.body;

    if (!body && !req.file) {
      return res.status(400).json({ message: "Message vide." });
    }

    let mediaPath = null;
    if (req.file) {
      mediaPath = req.file.filename;
    }

    transaction = await sequelize.transaction();

    const [client, costSetting] = await Promise.all([
      Client.findByPk(clientId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      }),
      Setting.findOne({
        where: { key: "coin_cost_per_message" },
        transaction,
      }),
    ]);

    if (!client) {
      await transaction.rollback();
      return res.status(404).json({ message: "Client introuvable." });
    }

    const parsedCost = parseInt(costSetting?.value, 10);
    const cost = Number.isFinite(parsedCost) && parsedCost > 0 ? parsedCost : 1;

    if ((client.credit_balance ?? 0) < cost) {
      await transaction.rollback();
      return res
        .status(402)
        .json({ message: "Solde insuffisant pour envoyer ce message." });
    }

    // Verifier ou creer la conversation
    let conversation = await Conversation.findOne({
      where: {
        client_id: clientId,
        girl_id: girlId,
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!conversation) {
      conversation = await Conversation.create(
        {
          client_id: clientId,
          girl_id: girlId,
        },
        { transaction }
      );
    }

    const message = await Message.create(
      {
        conversation_id: conversation.id,
        sender_type: "client",
        sender_id: clientId,
        receiver_id: girlId,
        body,
        media_url: mediaPath,
        is_follow_up: false,
      },
      { transaction }
    );

    await client.update(
      { credit_balance: client.credit_balance - cost },
      { transaction }
    );

    await CreditTransaction.create(
      {
        client_id: clientId,
        conversation_id: conversation.id,
        message_id: message.id,
        amount: -cost,
      },
      { transaction }
    );

    await transaction.commit();

    if (body) {
      try {
        const matched = await findForbiddenWordsIn(body);
        if (matched.length > 0) {
          notifyForbiddenWordAlert({
            conversationId: conversation.id,
            senderType: "client",
            messageBody: body,
            matchedWords: matched,
          }).catch(() => {});
        }
      } catch (_) {}
    }

    // User requested it tested from "compte client".
    const { checkSuspiciousContent } = require("../utils/securityScanner");
    checkSuspiciousContent(body, null, conversation.id, clientId).catch((err) =>
      console.error(err)
    );

    const io = req.app.get("io");
    await handleClientMessage(io, {
      conversationId: conversation.id,
    });
    return res.status(201).json({ message });
  } catch (err) {
    if (transaction && !transaction.finished) {
      try {
        await transaction.rollback();
      } catch (rollbackErr) {
        console.error("Rollback error:", rollbackErr);
      }
    }
    console.error(err);
    return res
      .status(500)
      .json({ message: "Erreur lors de l'envoi du message." });
  }
};

module.exports.markAsRead = async (req, res) => {
  try {
    const clientId = req.user.id;
    const girlId = parseInt(req.params.girl_id, 10);

    const conversation = await Conversation.findOne({
      where: { client_id: clientId, girl_id: girlId },
    });

    if (!conversation) {
      return res.status(404).json({ message: "Conversation introuvable." });
    }

    await Message.update(
      { is_read: true },
      {
        where: {
          conversation_id: conversation.id,
          sender_type: "girl",
          is_read: false,
        },
      }
    );

    return res.status(200).json({ message: "Messages marqués comme lus." });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erreur serveur." });
  }
};
