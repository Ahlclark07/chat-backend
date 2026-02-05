const {
  Conversation,
  Message,
  Girl,
  Client,
  Admin,
  ClientBlock,
} = require("../../models");
const { Op, Sequelize } = require("sequelize");
const { formatMessages } = require("../utils/messageFormatter");

function buildBlockKey(clientId, girlId) {
  return `${clientId || "0"}:${girlId || "0"}`;
}

async function getBlockedPairsForConversations(conversations = []) {
  const pairs = conversations
    .map((conv) => ({
      client_id: conv.client_id ?? conv.client?.id,
      girl_id: conv.girl_id ?? conv.girl?.id,
    }))
    .filter((pair) => pair.client_id && pair.girl_id);

  if (!pairs.length) {
    return new Set();
  }

  const clientIds = [...new Set(pairs.map((p) => p.client_id))];
  const girlIds = [...new Set(pairs.map((p) => p.girl_id))];

  const blocks = await ClientBlock.findAll({
    where: {
      client_id: { [Op.in]: clientIds },
      girl_id: { [Op.in]: girlIds },
    },
    attributes: ["client_id", "girl_id"],
    raw: true,
  });

  return new Set(
    blocks.map((row) => buildBlockKey(row.client_id, row.girl_id))
  );
}

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
  const conversations = messages.map((m) => m.conversation).filter(Boolean);
  const blockedPairs = await getBlockedPairsForConversations(conversations);
  return conversations.filter(
    (conv) =>
      !blockedPairs.has(buildBlockKey(conv.client_id, conv.girl_id))
  );
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
  const latestConversationIds = latestGirlMessages.map((m) => m.conversation_id);
  if (!latestConversationIds.length) {
    return [];
  }

  const conversationRows = await Conversation.findAll({
    where: { id: { [Op.in]: latestConversationIds } },
    attributes: ["id", "client_id", "girl_id"],
    raw: true,
  });

  const blockedPairs = await getBlockedPairsForConversations(conversationRows);
  return conversationRows
    .filter(
      (conv) =>
        !blockedPairs.has(buildBlockKey(conv.client_id, conv.girl_id))
    )
    .map((conv) => conv.id);
}
module.exports = {
  getUnprocessedClientConversations,
  getConversationsForClient,
  getLastMessagesForConversation,
  getConversationWithClientAndGirl,
  getConversationsAwaitingClientReply,
};
