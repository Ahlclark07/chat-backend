const { Conversation, Message, Girl, Client } = require("../../models");
const { Op, Sequelize } = require("sequelize");
async function getConversationsForClient(clientId) {
  return await Conversation.findAll({
    where: { client_id: clientId },
    attributes: ["id"],
    include: [
      {
        model: Message,
        as: "messages",
        attributes: ["id"], // juste pour être sûr qu’il y a des messages
      },
      {
        model: Girl,
        as: "girl",
        attributes: ["id"], // optionnel ici, pas forcément nécessaire
      },
    ],
  });
}

async function getLastMessagesForConversation(conversationId, limit = 7) {
  const messages = await Message.findAll({
    where: { conversation_id: conversationId },
    order: [["createdAt", "DESC"]],
    limit,
  });

  // Les plus récents sont d'abord, on les inverse
  return messages.reverse();
}
async function getConversationWithClientAndGirl(conversationId) {
  console.log(conversationId);
  return await Conversation.findByPk(conversationId, {
    include: ["client", "girl", "messages"],
  });
}

async function getUnprocessedClientConversations() {
  // Sous-requête : trouver l'id du dernier message pour chaque conversation
  const lastMessages = await Message.findAll({
    attributes: [[Sequelize.fn("MAX", Sequelize.col("id")), "id"]],
    group: ["conversation_id"],
    raw: true,
  });

  const lastMessageIds = lastMessages.map((m) => m.id);

  // Charger ces derniers messages avec leur type et conversation liée
  const messages = await Message.findAll({
    where: {
      id: { [Op.in]: lastMessageIds },
      sender_type: "client", // Ne garder que ceux envoyés par un client
    },
    include: [
      {
        model: Conversation,
        as: "conversation",
        include: [
          { model: Client, as: "client" },
          { model: Girl, as: "girl" },
        ],
      },
    ],
  });
  console.log("////////////////////////////////////////////////////");
  const x = messages.map((m) => m.conversation);
  console.log("number : " + x.length);
  console.log("////////////////////////////////////////////////////");

  // Ne retourne que les conversations dont le dernier message est un client
  return x;
}
module.exports = {
  getUnprocessedClientConversations,
  getConversationsForClient,
  getLastMessagesForConversation,
  getConversationWithClientAndGirl,
};
