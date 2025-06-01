const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const dotenv = require("dotenv");
const { sequelize } = require("../models");

dotenv.config();

const app = express();

// Middlewares globaux
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

// Routes
app.get("/ping", (req, res) => {
  res.json({ message: "pong" });
});

const authRoutes = require("./routes/auth.route");
app.use("/api/auth", authRoutes);
const clientRoutes = require("./routes/client.route");
app.use("/api/client", clientRoutes);
const chatRoutes = require("./routes/chat.route");
app.use("/api/chat", chatRoutes);
const adminAuthRoutes = require("./routes/adminAuth.route");
app.use("/api/admin", adminAuthRoutes);
const adminManagementRoutes = require("./routes/adminManagement.route");
app.use("/api/admin", adminManagementRoutes);
const adminStatsRoutes = require("./routes/adminStats.route");
app.use("/api/admin", adminStatsRoutes);
const adminLogRoutes = require("./routes/adminLog.route");
app.use("/api/admin", adminLogRoutes);

module.exports = app;
