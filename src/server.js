require("dotenv").config();
const app = require("./app");
const { sequelize } = require("../models");
const http = require("http");
const { Server } = require("socket.io");

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*", // ⚠️ à restreindre en prod
    methods: ["GET", "POST"],
  },
});

// Stock temporaire des clients connectés (id + socket)
const onlineClients = new Map();

io.on("connection", (socket) => {
  const userId = socket.handshake.query.client_id;
  console.log(`✅ Client connecté : ${userId}`);

  if (userId) {
    onlineClients.set(userId, socket.id);
    io.emit("presence:update", { userId, status: "online" });
  }

  // Réception de message
  socket.on("chat:message", (payload) => {
    const { conversation_id, sender_id, content } = payload;
    socket.broadcast.emit("chat:message", {
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

(async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ Connexion à la base de données réussie !");

    server.listen(PORT, () => {
      console.log(`🚀 Serveur lancé sur http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("❌ Erreur de connexion à la base de données :", error);
    process.exit(1);
  }
})();
