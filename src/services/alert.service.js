const {
  Admin,
  Conversation,
  Client,
  Girl,
  SystemAlert,
  AdminActivityLog,
} = require("../../models");
const { Op } = require("sequelize");
const { sendMail } = require("./mail.service");
const {
  renderForbiddenWordAlert,
  renderSystemAlert,
} = require("./mailTemplates");

// ... existing code ...

async function createSystemAlert(data) {
  try {
    const alert = await SystemAlert.create(data);

    // Notify God Admins
    const godEmails = await getGodAdminEmails();
    if (godEmails.length > 0 && data.status !== "IGNORED") {
      const admin = await Admin.findByPk(data.admin_id);
      const adminName = admin
        ? `${admin.prenom} ${admin.nom}`
        : "Admin Inconnu";

      const email = renderSystemAlert({
        type: data.type,
        severity: data.severity,
        adminName,
        details: data.details,
      });

      await sendMail({
        to: godEmails,
        subject: email.subject,
        html: email.html,
        text: email.text,
      });
    }
    return alert;
  } catch (err) {
    console.error("Failed to create system alert:", err);
  }
}

async function checkRepeatedLoginConflicts(adminId) {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const count = await AdminActivityLog.count({
      where: {
        admin_id: adminId,
        action: "LOGIN_CONFLICT_SESSION_NOTIFIED",
        createdAt: {
          [Op.gte]: oneHourAgo,
        },
      },
    });

    if (count >= 3) {
      // Check if we already alerted recently to avoid spam?
      // For now, let's just alert.
      await createSystemAlert({
        type: "MULTIPLE_CONNECTIONS",
        severity: "HIGH",
        status: "OPEN",
        admin_id: adminId,
        details: { conflictCount: count, timeWindow: "1h" },
      });
    }
  } catch (err) {
    console.error("Error checking repeated login conflicts:", err);
  }
}

async function checkSuspiciousContent(
  messageBody,
  senderAdminId,
  conversationId
) {
  try {
    let suspicious = false;
    let details = {};

    // 1. Phone number detection (sequence of > 6 digits, possibly separated)
    // Regex that looks for digit sequences.
    // Simplified: Look for 6 consecutive digits.
    const phoneRegex = /\d[\d\s-]{4,}\d/g;
    // Actually user said: "Plus de 6 chiffres par exemples en bloc" -> >6 digits.
    const blockDigits = /\d{7,}/;

    if (blockDigits.test(messageBody.replace(/\s/g, ""))) {
      suspicious = true;
      details = { reason: "PHONE_NUMBER_PATTERN", match: messageBody };
    }

    // 2. Forbidden words (handled by existing forbiddenWord logic usually, but user asked for alert here)
    // We can reuse or duplicate logic. Let's assume forbiddenWord controller handles "blocking",
    // but here we want to alert "God".

    if (suspicious) {
      console.log("Suspicious content detected! Creating alert...");
      const alert = await createSystemAlert({
        type: "SUSPICIOUS_CONTENT",
        severity: "MEDIUM",
        status: "OPEN",
        admin_id: senderAdminId || null, // Ensure null if undefined
        details: {
          messageBody,
          conversationId,
          ...details,
        },
      });
      console.log("Alert created:", alert ? alert.id : "FAILED");
    } else {
      console.log("Content passed suspicious check.");
    }
  } catch (err) {
    console.error("Error checking suspicious content:", err);
  }
}

async function getGodAdminEmails() {
  const admins = await Admin.findAll({
    where: { role: "god" },
    attributes: ["email", "nom", "prenom"],
  });
  return admins.map((a) => a.email).filter(Boolean);
}

/**
 * Notify god admins about a forbidden word occurrence.
 * context = { conversationId, senderType ('client'|'girl'), senderAdminId?, messageBody, matchedWords }
 */
async function notifyForbiddenWordAlert(context) {
  const {
    conversationId,
    senderType,
    senderAdminId,
    messageBody,
    matchedWords = [],
  } = context;

  // Load conversation participants
  const conv = await Conversation.findByPk(conversationId, {
    include: [
      { model: Client, as: "client", attributes: ["id", "nom", "prenom"] },
      { model: Girl, as: "girl", attributes: ["id", "nom"] },
    ],
  });
  if (!conv) return;

  let senderAdminName = undefined;
  if (senderType === "girl" && senderAdminId) {
    const admin = await Admin.findByPk(senderAdminId, {
      attributes: ["nom", "prenom"],
    });
    if (admin)
      senderAdminName = `${admin.prenom || ""} ${admin.nom || ""}`.trim();
  }

  const to = await getGodAdminEmails();
  if (!to.length) return; // no recipients

  const email = renderForbiddenWordAlert({
    conversationId,
    senderType,
    senderAdminName,
    clientName:
      `${conv.client?.prenom || ""} ${conv.client?.nom || ""}`.trim() ||
      `${conv.client?.id || "client"}`,
    girlName: conv.girl?.nom || `${conv.girl?.id || "girl"}`,
    messageBody,
    matchedWords,
  });

  try {
    await sendMail({
      to,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
  } catch (err) {
    // do not throw; logging only
    console.error("Failed to send forbidden word alert:", err?.message || err);
  }
}

module.exports = {
  notifyForbiddenWordAlert,
  createSystemAlert,
  checkRepeatedLoginConflicts,
};
