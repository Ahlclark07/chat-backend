const express = require("express");
const morgan = require("morgan");
const dotenv = require("dotenv");
const cors = require("cors");
const { sequelize } = require("../models");
const path = require("path");

dotenv.config();

const app = express();

const corsOptions = {
  origin: "*",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Origin",
    "X-Requested-With",
    "Content-Type",
    "Accept",
    "Authorization",
  ],
};

app.use(cors());
app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  return next();
});

// =========================
// Middlewares globaux
// =========================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

// =========================
// Routes
// =========================
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
const adminClientRoutes = require("./routes/adminClient.route");
app.use("/api/admin", girlRoutes);
app.use("/api/admin", adminClientRoutes);

const adminManagementRoutes = require("./routes/adminManagement.route");
app.use("/api/admin-management", adminManagementRoutes);

const adminStatsRoutes = require("./routes/adminStats.route");
app.use("/api/admin", adminStatsRoutes);

const adminLogRoutes = require("./routes/adminLog.route");
app.use("/api/admin", adminLogRoutes);

app.use("/api/admin", require("./routes/settings.route"));
app.use("/api/admin", require("./routes/autoMessage.route"));
app.use("/api/admin", require("./routes/forbiddenWord.route"));
app.use("/api/admin", require("./routes/signalement.route"));

const locationsRoute = require("./routes/location.route");
app.use("/api/locations", locationsRoute);

const creditRoutes = require("./routes/credit.route");
app.use("/api/credits", creditRoutes);

app.use("/api/filters", require("./routes/filter.route"));
app.use("/api/conversations", require("./routes/conversationNote.route"));
app.use("/api/conversations", require("./routes/conversation.route"));
app.use("/api/favorites", require("./routes/favorite.route"));

// Test routes
app.use("/api/test", require("./routes/test.route"));

// CORS headers also on errors
app.use((err, req, res, next) => {
  try {
    if (!res.headersSent) {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader(
        "Access-Control-Allow-Methods",
        "GET,POST,PUT,PATCH,DELETE,OPTIONS"
      );
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Origin, X-Requested-With, Content-Type, Accept, Authorization"
      );
    }
  } catch (_) {}
  next(err);
});

module.exports = app;
