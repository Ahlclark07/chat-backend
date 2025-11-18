const { Conversation, Message, Girl, Client, Admin } = require("../../models");
const { Op, Sequelize } = require("sequelize");
const { formatMessages } = require("../utils/messageFormatter");

function buildGirlWithPhotosInclude() {
  return {
    model: Girl,
    as: "girl",
    include: [
      {
        association: "photos",
        attributes: ["id", "url"],
      },
    ],
  };
}

async function getConversationsForClient(clientId) {
  return await Conversation.findAll({
    where: { client_id: clientId },
    attributes: ["id"],
    include: [
      {
        model: Message,
        as: "messages",
        attributes: ["id"],
      },
      {
        model: Girl,
        as: "girl",
        attributes: ["id"],
      },
    ],
  });
}

async function getLastMessagesForConversation(conversationId, limit = null) {
  const queryOptions = {
    where: { conversation_id: conversationId },
    order: [["createdAt", "DESC"]],
    include: [
      {
        model: Conversation,
        as: "conversation",
        attributes: ["id", "assigned_admin_id"],
        include: [
          {
            model: Admin,
            as: "assigned_admin",
            attributes: ["id", "nom", "prenom", "identifiant"],
          },
        ],
      },
      {
        model: Admin,
        as: "sender_admin",
        attributes: ["id", "nom", "prenom", "identifiant"],
      },
    ],
  };

  if (Number.isInteger(limit) && limit > 0) {
    queryOptions.limit = limit;
  }

  const messages = await Message.findAll(queryOptions);
  const orderedMessages = messages.reverse();
  return formatMessages(orderedMessages);
}

async function getConversationWithClientAndGirl(conversationId) {
  const conversationInstance = await Conversation.findByPk(conversationId, {
    include: [
      { model: Client, as: "client" },
      buildGirlWithPhotosInclude(),
      {
        model: Admin,
        as: "assigned_admin",
        attributes: ["id", "nom", "prenom", "identifiant"],
      },
      {
        model: Message,
        as: "messages",
        separate: true,
        order: [["createdAt", "ASC"]],
        include: [
          {
            model: Admin,
            as: "sender_admin",
            attributes: ["id", "nom", "prenom", "identifiant"],
          },
        ],
      },
    ],
  });

  if (!conversationInstance) {
    return null;
  }

  const jsonConversation = conversationInstance.toJSON();
  jsonConversation.messages = formatMessages(
    conversationInstance.messages || [],
    {
      assignedAdmin: jsonConversation.assigned_admin,
    }
  );

  return jsonConversation;
}

async function getUnprocessedClientConversations() {
  const lastMessages = await Message.findAll({
    attributes: [[Sequelize.fn("MAX", Sequelize.col("id")), "id"]],
    group: ["conversation_id"],
    raw: true,
  });

  const lastMessageIds = lastMessages.map((m) => m.id);

  const messages = await Message.findAll({
    where: {
      id: { [Op.in]: lastMessageIds },
      sender_type: "client",
    },
    include: [
      {
        model: Conversation,
        as: "conversation",
        include: [
          { model: Client, as: "client" },
          buildGirlWithPhotosInclude(),
        ],
      },
    ],
  });
  console.log("////////////////////////////////////////////////////");
  const x = messages.map((m) => m.conversation);
  console.log("number : " + x.length);
  console.log("////////////////////////////////////////////////////");

  return x;
}

async function getConversationsAwaitingClientReply(clientId) {
  const conversations = await Conversation.findAll({
    where: { client_id: clientId },
    attributes: ["id"],
    raw: true,
  });

  if (!conversations.length) {
    return [];
  }

  const conversationIds = conversations.map((c) => c.id);

  const lastMessages = await Message.findAll({
    attributes: [
      [Sequelize.fn("MAX", Sequelize.col("id")), "id"],
      "conversation_id",
    ],
    where: { conversation_id: { [Op.in]: conversationIds } },
    group: ["conversation_id"],
    raw: true,
  });

  const lastIds = lastMessages.map((m) => m.id);
  if (!lastIds.length) {
    return [];
  }

  const latestGirlMessages = await Message.findAll({
    where: {
      id: { [Op.in]: lastIds },
      sender_type: "girl",
    },
    attributes: ["conversation_id"],
    raw: true,
  });

  return latestGirlMessages.map((m) => m.conversation_id);
}
module.exports = {
  getUnprocessedClientConversations,
  getConversationsForClient,
  getLastMessagesForConversation,
  getConversationWithClientAndGirl,
  getConversationsAwaitingClientReply,
};
