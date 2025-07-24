require("dotenv").config();
const app = require("./app");
const { sequelize } = require("../models");
const http = require("http");

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

const { setupSocket } = require("./sockets");
const io = setupSocket(server);
app.set("io", io);
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
