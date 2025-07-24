// sockets/index.js
const {
  getConversationsForClient,
} = require("../services/conversation.service");
const connectedClients = new Map(); // socket.id -> clientId
const clientIdToSocketId = new Map(); // clientId -> socket.id (utile pour le controller)

function setupSocket(server) {
  const io = require("socket.io")(server, { cors: { origin: "*" } });

  io.on("connection", (socket) => {
    console.log("🔌 Client connecté:", socket.id);

    socket.on("register", async (clientId) => {
      connectedClients.set(socket.id, clientId);
      clientIdToSocketId.set(clientId, socket.id);
      socket.clientId = clientId;

      const conversations = await getConversationsForClient(clientId);
      conversations.forEach((conv) => {
        socket.join(`conversation_${conv.id}`);
      });

      console.log(`✅ Client ${clientId} enregistré avec ses rooms.`);
    });

    socket.on("disconnect", () => {
      const clientId = connectedClients.get(socket.id);
      console.log(`❌ Déconnexion de ${socket.id} (client ${clientId})`);
      connectedClients.delete(socket.id);
      if (clientId) {
        clientIdToSocketId.delete(clientId);
      }
    });
  });

  // Exposer les maps pour y accéder dans les controllers io.connectedClients = connectedClients; io.clientIdToSocketId = clientIdToSocketId;

  return io;
}

module.exports = { setupSocket };
