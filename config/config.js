require("dotenv").config();

module.exports = {
  development: {
    username: process.env.DB_USER || "root",
    password: process.env.DB_PASS || null,
    database: process.env.DB_NAME || "db_chat_dev",
    host: process.env.DB_HOST || "127.0.0.1",
    dialect: "mysql",
    logging: false,
  },
  test: {
    // même chose si tu veux tester un jour
  },
  production: {
    // à personnaliser si tu déploies plus tard
  },
};
