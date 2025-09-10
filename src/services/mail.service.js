// Reusable mail service using Nodemailer
// Configure via environment variables (see README notes / .env)

let _transporter = null;

function normalizeFrom(explicitFrom) {
  const envFrom = explicitFrom || process.env.SMTP_FROM;
  if (envFrom && /@/.test(envFrom)) return envFrom;
  const user = process.env.SMTP_USER;
  if (user && /@/.test(user)) return user;
  return null;
}

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
  const debug = getBool(process.env.SMTP_DEBUG, false);

  const base = {
    host,
    port,
    secure,
    pool,
    maxConnections,
    maxMessages,
    tls: { rejectUnauthorized },
    logger: debug,
    debug,
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

async function logEmail({
  from,
  to,
  cc,
  bcc,
  subject,
  template,
  success,
  info,
  error,
  envelope,
}) {
  try {
    const { EmailLog } = require("../../models");
    if (!EmailLog) return;
    await EmailLog.create({
      from,
      to: Array.isArray(to) ? to.join(",") : String(to || ""),
      cc: Array.isArray(cc) ? cc.join(",") : cc || null,
      bcc: Array.isArray(bcc) ? bcc.join(",") : bcc || null,
      subject,
      template: template || null,
      message_id: info?.messageId || null,
      provider_accepted: info?.accepted ? JSON.stringify(info.accepted) : null,
      provider_rejected: info?.rejected ? JSON.stringify(info.rejected) : null,
      provider_envelope: envelope ? JSON.stringify(envelope) : info?.envelope ? JSON.stringify(info.envelope) : null,
      provider_response: info?.response || null,
      success: !!success,
      error_name: error?.name || null,
      error_code: error?.code || null,
      error_message: error?.message || null,
    });
  } catch (e) {
    // Do not crash on logging failure
    console.error("Email log write failed:", e?.message || e);
  }
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
  const from = normalizeFrom(options.from);
  if (!from) {
    throw new Error(
      "Missing 'from' address. Set SMTP_FROM or provide options.from (a valid email)."
    );
  }

  const recipients = options.to;

  const mailOptions = {
    from,
    to: recipients,
    subject: options.subject,
    text: options.text,
    html: options.html,
    cc: options.cc,
    bcc: options.bcc,
    attachments: options.attachments,
    headers: {
      "X-Mailer-App": "c-backend",
      "X-Mailer-TS": new Date().toISOString(),
    },
  };

  // Force a clean SMTP envelope (helps with some MTAs)
  const emailOnly = (addr) => {
    if (!addr) return undefined;
    const m = String(addr).match(/<([^>]+)>/);
    return m ? m[1] : String(addr);
  };
  // Flatten recipients for envelope if arrays
  const toList = Array.isArray(recipients) ? recipients : [recipients].filter(Boolean);
  const envelope = {
    from: emailOnly(from),
    to: toList.map(emailOnly),
  };
  mailOptions.envelope = envelope;
  try {
    const info = await transporter.sendMail(mailOptions);
    await logEmail({
      from,
      to: recipients,
      cc: options.cc,
      bcc: options.bcc,
      subject: options.subject,
      template: options.template,
      success: true,
      info,
      envelope,
    });
    return info;
  } catch (err) {
    await logEmail({
      from,
      to: recipients,
      cc: options.cc,
      bcc: options.bcc,
      subject: options.subject,
      template: options.template,
      success: false,
      error: err,
      envelope,
    });
    throw err;
  }
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
