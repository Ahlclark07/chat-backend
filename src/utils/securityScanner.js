const { SystemAlert, Admin } = require("../../models");
const { sendMail } = require("../services/mail.service");
const { renderSystemAlert } = require("../services/mailTemplates");
const { findForbiddenWordsIn } = require("./forbiddenWords.util");

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

async function getGodAdminEmails() {
  const admins = await Admin.findAll({
    where: { role: "god" },
    attributes: ["email", "nom", "prenom"],
  });
  return admins.map((a) => a.email).filter(Boolean);
}

async function checkSuspiciousContent(
  messageBody,
  senderAdminId,
  conversationId,
  senderClientId = null
) {
  try {
    let suspicious = false;
    let details = {};

    // 1. Phone number detection
    const blockDigits = /\d{7,}/;

    if (blockDigits.test(messageBody.replace(/\s/g, ""))) {
      suspicious = true;
      details = { reason: "PHONE_NUMBER_PATTERN", match: messageBody };
    }

    // 2. Forbidden Words detection
    if (!suspicious) {
      const forbiddenMatches = await findForbiddenWordsIn(messageBody);
      if (forbiddenMatches.length > 0) {
        suspicious = true;
        details = {
          reason: "FORBIDDEN_WORD",
          match: forbiddenMatches.join(", "),
        };
      }
    }

    if (suspicious) {
      console.log("Suspicious content detected (Scanner)!", details);
      const alert = await createSystemAlert({
        type: "SUSPICIOUS_CONTENT",
        severity: "MEDIUM",
        status: "OPEN",
        admin_id: senderAdminId || null,
        details: {
          messageBody,
          conversationId,
          senderClientId,
          ...details,
        },
      });
      console.log("Alert created:", alert ? alert.id : "FAILED");
    }
  } catch (err) {
    console.error("Error/Scanner checking suspicious content:", err);
  }
}

module.exports = { checkSuspiciousContent, createSystemAlert };
