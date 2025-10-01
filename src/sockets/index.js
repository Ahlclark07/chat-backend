const { getConversationsForClient } = require("../services/conversation.service");
const { initMessageDispatcher } = require("./messages-dispatcher");

const connectedClients = new Map(); // socket.id -> clientId
const clientIdToSocketId = new Map(); // clientId -> socket.id

function setupSocket(server) {
  const io = require("socket.io")(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["*"],
    },
  });

  // Branchement du dispatcher des messages admin
  initMessageDispatcher(io);

  io.on("connection", (socket) => {
    console.log("[socket] client connecté:", socket.id);

    socket.on("register", async (clientId) => {
      connectedClients.set(socket.id, clientId);
      clientIdToSocketId.set(clientId, socket.id);
      socket.clientId = clientId;

      const conversations = await getConversationsForClient(clientId);
      conversations.forEach((conv) => {
        socket.join("conversation_" + conv.id);
      });

      console.log("[socket] client", clientId, "enregistré avec ses rooms.");
    });

    socket.on("disconnect", () => {
      const clientId = connectedClients.get(socket.id);
      console.log("[socket] déconnexion de", socket.id, "(client", clientId, ")");
      connectedClients.delete(socket.id);
      if (clientId) {
        clientIdToSocketId.delete(clientId);
      }
    });
  });

  return io;
}

module.exports = {
  connectedClients,
  clientIdToSocketId,
  setupSocket,
};
