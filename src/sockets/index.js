// src/sockets/index.js
const { Server } = require("socket.io");
const Conversation = require("../../models/conversation");
const onlineClients = new Map();

function setupSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    const userId = socket.handshake.query.client_id;
    console.log(`✅ Client connecté : ${userId}`);

    if (userId) {
      onlineClients.set(userId, socket.id);
      io.emit("presence:update", { userId, status: "online" });
    }
    socket.on("chat:message", async (payload) => {
      const { conversation_id, content } = payload;

      const conversation = await Conversation.findByPk(conversation_id);

      if (!conversation) return;

      const { client_id, girl_id } = conversation;

      const sender_id = socket.handshake.query.client_id;
      const receiver_id = sender_id == client_id ? girl_id : client_id; // qui est l’autre partie ?

      const receiverSocketId = onlineClients.get(receiver_id);

      // envoyer au destinataire uniquement
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("new_message", {
          conversation_id,
          sender_id,
          content,
        });
      }

      // accusé de réception côté émetteur
      socket.emit("chat:message:ack", {
        conversation_id,
        sender_id,
        content,
      });
    });

    socket.on("disconnect", () => {
      console.log(`❌ Client déconnecté : ${userId}`);
      if (userId) {
        onlineClients.delete(userId);
        io.emit("presence:update", { userId, status: "offline" });
      }
    });
  });

  return io;
}

module.exports = { setupSocket };
