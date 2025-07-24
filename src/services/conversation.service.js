const { Conversation, Message, Girl } = require("../../models");

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

module.exports = {
  getConversationsForClient,
};
