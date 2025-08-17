const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const dotenv = require("dotenv");
const { sequelize } = require("../models");
const path = require("path");

dotenv.config();

const app = express();

// Middlewares globaux
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));
console.log(path.join(__dirname, "uploads"));
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));
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
const adminDashRoutes = require("./routes/admin.route");
app.use("/api/admin", adminDashRoutes);
const girlRoutes = require("./routes/adminGirl.route");
app.use("/api/admin", girlRoutes);
const adminManagementRoutes = require("./routes/adminManagement.route");
app.use("/api/admin-management", adminManagementRoutes);
const adminStatsRoutes = require("./routes/adminStats.route");
app.use("/api/admin", adminStatsRoutes);
const adminLogRoutes = require("./routes/adminLog.route");
app.use("/api/admin", adminLogRoutes);
app.use("/api/admin", require("./routes/settings.route"));
app.use("/api/admin", require("./routes/autoMessage.route"));
const locationsRoute = require("./routes/location.route");
app.use("/api/locations", locationsRoute);
const creditRoutes = require("./routes/credit.route");
app.use("/api/credits", creditRoutes);
app.use("/api/conversations", require("./routes/conversationNote.route"));
app.use("/api/conversations", require("./routes/conversation.route"));
app.use("/api/favorites", require("./routes/favorite.route"));

module.exports = app;
