const fs = require("fs");
const path = require("path");

const LOG_FILE_PATH =
  process.env.ADMIN_AUTH_LOG_FILE ||
  path.resolve(__dirname, "../../admin-auth.log");

function safeStringify(payload) {
  try {
    return JSON.stringify(payload);
  } catch (err) {
    return JSON.stringify({
      error: "payload_not_serializable",
      fallback: String(payload),
    });
  }
}

function logAdminAuth(event, payload = {}) {
  const timestamp = new Date().toISOString();
  const line = `${timestamp} | ${event} | ${safeStringify(payload)}\n`;
  fs.appendFile(LOG_FILE_PATH, line, (err) => {
    if (err) {
      console.error(
        "[AdminAuthLogger] Failed to write log entry:",
        err.message
      );
    }
  });
}

module.exports = {
  logAdminAuth,
  LOG_FILE_PATH,
};
