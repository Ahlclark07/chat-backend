const { SystemAlert, Admin, Conversation, Message } = require("../../models");
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

async function resolveAdminId(senderAdminId, conversationId) {
  if (senderAdminId) return senderAdminId;
  if (!conversationId) return null;
  try {
    const conversation = await Conversation.findByPk(conversationId, {
      attributes: ["assigned_admin_id"],
    });
    if (conversation?.assigned_admin_id) {
      return conversation.assigned_admin_id;
    }
  } catch {
    return null;
  }
  try {
    const lastAdminMessage = await Message.findOne({
      where: { conversation_id: conversationId, sender_type: "girl" },
      order: [["createdAt", "DESC"]],
      attributes: ["sender_id"],
    });
    return lastAdminMessage?.sender_id ?? null;
  } catch {
    return null;
  }
}

async function checkSuspiciousContent(
  messageBody,
  senderAdminId,
  conversationId,
  senderClientId = null
) {
  try {
    const normalizedBody = String(messageBody || "");
    if (!normalizedBody.trim()) {
      return;
    }
    let suspicious = false;
    let details = {};

    // 1. Phone number detection
    const blockDigits = /\d{7,}/;

    if (blockDigits.test(normalizedBody.replace(/\s/g, ""))) {
      suspicious = true;
      details = { reason: "PHONE_NUMBER_PATTERN", match: normalizedBody };
    }

    // 2. Email detection
    if (!suspicious) {
      const emailRegex = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
      if (emailRegex.test(normalizedBody) || normalizedBody.includes("@")) {
        suspicious = true;
        details = { reason: "EMAIL_PATTERN", match: normalizedBody };
      }
    }

    // 3. Forbidden Words detection
    if (!suspicious) {
      const forbiddenMatches = await findForbiddenWordsIn(normalizedBody);
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
      const resolvedAdminId = await resolveAdminId(
        senderAdminId,
        conversationId
      );
      const senderType = senderAdminId ? "girl" : "client";
      const alert = await createSystemAlert({
        type: "SUSPICIOUS_CONTENT",
        severity: "MEDIUM",
        status: "OPEN",
        admin_id: resolvedAdminId,
        details: {
          messageBody: normalizedBody,
          conversationId,
          senderType,
          senderAdminId: senderAdminId || null,
          assignedAdminId:
            !senderAdminId && resolvedAdminId ? resolvedAdminId : null,
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
