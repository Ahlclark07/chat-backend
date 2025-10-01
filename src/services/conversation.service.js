const { Conversation, Message, Girl, Client, Admin } = require("../../models");
const { Op, Sequelize } = require("sequelize");

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

async function getLastMessagesForConversation(conversationId, limit = 7) {
  const messages = await Message.findAll({
    where: { conversation_id: conversationId },
    order: [["createdAt", "DESC"]],
    limit,
    include: [
      {
        model: Conversation,
        as: "conversation",
        attributes: ["id", "assigned_admin_id"],
        include: [
          {
            model: Admin,
            as: "assigned_admin",
            attributes: ["id", "identifiant"],
          },
        ],
      },
    ],
  });

  return messages.reverse().map((messageInstance) => {
    const message = messageInstance.toJSON();

    if (message.sender_type === "girl") {
      const adminIdentifiant =
        message.conversation?.assigned_admin?.identifiant || null;
      if (adminIdentifiant) {
        message.assigned_admin_identifiant = adminIdentifiant;
      }
    }

    delete message.conversation;
    return message;
  });
}

async function getConversationWithClientAndGirl(conversationId) {
  console.log(conversationId);
  return await Conversation.findByPk(conversationId, {
    include: [
      { model: Client, as: "client" },
      buildGirlWithPhotosInclude(),
      { model: Message, as: "messages" },
    ],
  });
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
module.exports = {
  getUnprocessedClientConversations,
  getConversationsForClient,
  getLastMessagesForConversation,
  getConversationWithClientAndGirl,
};
