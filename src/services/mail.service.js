// Reusable mail service using Nodemailer
// Configure via environment variables (see README notes / .env)

let _transporter = null;

function getBool(envVal, def = false) {
  if (envVal === undefined) return def;
  const v = String(envVal).trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

function getInt(envVal, def) {
  if (envVal === undefined) return def;
  const n = parseInt(envVal, 10);
  return Number.isNaN(n) ? def : n;
}

function createTransporter() {
  // Lazy require so the app doesn't crash until the module is actually used
  const nodemailer = require("nodemailer");

  const host = process.env.SMTP_HOST;
  const port = getInt(process.env.SMTP_PORT, 587);
  const secure = getBool(process.env.SMTP_SECURE, false); // true for 465, false for 587/25
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  const pool = getBool(process.env.SMTP_POOL, true);
  const maxConnections = getInt(process.env.SMTP_MAX_CONNECTIONS, 5);
  const maxMessages = getInt(process.env.SMTP_MAX_MESSAGES, 100);
  const rejectUnauthorized = getBool(
    process.env.SMTP_TLS_REJECT_UNAUTHORIZED,
    true
  );

  const base = {
    host,
    port,
    secure,
    pool,
    maxConnections,
    maxMessages,
    tls: { rejectUnauthorized },
  };

  if (user || pass) {
    base.auth = { user, pass };
  }

  return nodemailer.createTransport(base);
}

function getTransporter() {
  if (!_transporter) {
    _transporter = createTransporter();
  }
  return _transporter;
}

/**
 * Sends an email using the configured SMTP transporter.
 * @param {Object} options
 * @param {string|string[]} options.to - Recipient(s)
 * @param {string} options.subject - Email subject
 * @param {string} [options.html] - HTML body
 * @param {string} [options.text] - Plain text body
 * @param {string|string[]} [options.cc]
 * @param {string|string[]} [options.bcc]
 * @param {Array} [options.attachments]
 * @param {string} [options.from] - Overrides default from
 */
async function sendMail(options) {
  const transporter = getTransporter();
  const from = options.from || process.env.SMTP_FROM;
  if (!from) {
    throw new Error(
      "Missing SMTP_FROM in environment or 'from' in sendMail options"
    );
  }

  const mailOptions = {
    from,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html,
    cc: options.cc,
    bcc: options.bcc,
    attachments: options.attachments,
  };

  return transporter.sendMail(mailOptions);
}

/**
 * Verifies SMTP configuration/connection. Useful for health checks.
 * Returns true if verified, false otherwise.
 */
async function verifyTransporter() {
  try {
    const transporter = getTransporter();
    await transporter.verify();
    return true;
  } catch (err) {
    return false;
  }
}

module.exports = {
  sendMail,
  verifyTransporter,
  getTransporter,
};

