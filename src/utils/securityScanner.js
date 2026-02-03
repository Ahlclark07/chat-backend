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

function normalizeAlertDetails(raw) {
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return raw;
}

async function checkRepeatedAdminMessage({
  adminId,
  clientId,
  conversationId,
  messageBody,
}) {
  try {
    const normalizedBody = String(messageBody || "");
    if (!adminId || !clientId || !normalizedBody) return;
    if (!normalizedBody.trim()) return;

    const count = await Message.count({
      where: {
        sender_type: "girl",
        sender_id: adminId,
        receiver_id: clientId,
        body: normalizedBody,
      },
    });

    if (count < 3) return; // Need 2 previous messages + this one

    const existingAlerts = await SystemAlert.findAll({
      where: { type: "REPEATED_ADMIN_MESSAGE", admin_id: adminId },
      order: [["createdAt", "DESC"]],
    });

    const alreadyExists = existingAlerts.some((alert) => {
      const details = normalizeAlertDetails(alert.details);
      if (!details) return false;
      const detailClientId =
        details.clientId ?? details.client_id ?? details.senderClientId ?? null;
      const detailBody =
        details.messageBody ?? details.body ?? details.message ?? null;
      return (
        Number(detailClientId) === Number(clientId) &&
        String(detailBody || "") === normalizedBody
      );
    });

    if (alreadyExists) return;

    await createSystemAlert({
      type: "REPEATED_ADMIN_MESSAGE",
      severity: "MEDIUM",
      status: "OPEN",
      admin_id: adminId,
      details: {
        messageBody: normalizedBody,
        conversationId,
        clientId,
        repeatCount: count,
      },
    });
  } catch (err) {
    console.error("Error checking repeated admin message:", err);
  }
}

module.exports = {
  checkSuspiciousContent,
  checkRepeatedAdminMessage,
  createSystemAlert,
};
