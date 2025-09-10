const { Admin, Conversation, Client, Girl } = require("../../models");
const { sendMail } = require("./mail.service");
const { renderForbiddenWordAlert } = require("./mailTemplates");

async function getGodAdminEmails() {
  const admins = await Admin.findAll({ where: { role: "god" }, attributes: ["email", "nom", "prenom"] });
  return admins.map((a) => a.email).filter(Boolean);
}

/**
 * Notify god admins about a forbidden word occurrence.
 * context = { conversationId, senderType ('client'|'girl'), senderAdminId?, messageBody, matchedWords }
 */
async function notifyForbiddenWordAlert(context) {
  const { conversationId, senderType, senderAdminId, messageBody, matchedWords = [] } = context;

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
    const admin = await Admin.findByPk(senderAdminId, { attributes: ["nom", "prenom"] });
    if (admin) senderAdminName = `${admin.prenom || ""} ${admin.nom || ""}`.trim();
  }

  const to = await getGodAdminEmails();
  if (!to.length) return; // no recipients

  const email = renderForbiddenWordAlert({
    conversationId,
    senderType,
    senderAdminName,
    clientName: `${conv.client?.prenom || ""} ${conv.client?.nom || ""}`.trim() || `${conv.client?.id || "client"}`,
    girlName: conv.girl?.nom || `${conv.girl?.id || "girl"}`,
    messageBody,
    matchedWords,
  });

  try {
    await sendMail({ to, subject: email.subject, html: email.html, text: email.text });
  } catch (err) {
    // do not throw; logging only
    console.error("Failed to send forbidden word alert:", err?.message || err);
  }
}

module.exports = { notifyForbiddenWordAlert };

