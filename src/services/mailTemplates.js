// Simple HTML email templates used across the app

function baseLayout({ title, bodyHtml }) {
  return `
  <div style="font-family:Arial,Helvetica,sans-serif; background:#f7f7f9; padding:24px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #eee;border-radius:8px;overflow:hidden;">
      <tr>
        <td style="background:#111827;color:#fff;padding:16px 20px;font-size:18px;font-weight:600;">${title}</td>
      </tr>
      <tr>
        <td style="padding:20px;color:#111827;line-height:1.6; font-size:14px;">
          ${bodyHtml}
        </td>
      </tr>
      <tr>
        <td style="padding:14px 20px;color:#6b7280;font-size:12px;border-top:1px solid #f1f5f9;">
          Ceci est un email automatique. Merci de ne pas répondre directement.
        </td>
      </tr>
    </table>
  </div>`;
}

function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Welcome email for a new client
function renderWelcomeClient({ client }) {
  const firstName = client?.prenom || client?.nom || "";
  const subject = `Bienvenue${firstName ? ", " + firstName : ""} !`;
  const body = baseLayout({
    title: "Bienvenue !",
    bodyHtml: `
      <p>Bonjour ${escapeHtml(firstName) || "cher client"},</p>
      <p>Votre compte a été créé avec succès. Nous sommes ravis de vous compter parmi nous.</p>
      <p>Vous disposez d'un solde de crédits initial pour démarrer vos conversations.</p>
      <p style="margin-top:16px;">Bonne expérience !</p>
    `,
  });
  const text = `Bonjour ${firstName || "cher client"},\n\nBienvenue ! Votre compte a été créé avec succès.\nBonne expérience !`;
  return { subject, html: body, text };
}

// Alert to god admins when a forbidden word is detected
function renderForbiddenWordAlert({
  conversationId,
  senderType, // 'client' | 'girl'
  senderAdminName, // only when senderType === 'girl'
  clientName,
  girlName,
  messageBody,
  matchedWords = [],
}) {
  const subject = `Alerte mot filtré – Conversation #${conversationId}`;
  const roleLabel = senderType === "girl" ? `ADMIN (${escapeHtml(senderAdminName || "inconnu")}) via GIRL` : "CLIENT";
  const words = matchedWords.map(escapeHtml).join(", ");
  const body = baseLayout({
    title: "Alerte mot filtré",
    bodyHtml: `
      <p><strong>Conversation:</strong> #${conversationId}</p>
      <p><strong>Expéditeur:</strong> ${roleLabel}</p>
      <p><strong>Girl:</strong> ${escapeHtml(girlName || "-")}</p>
      <p><strong>Client:</strong> ${escapeHtml(clientName || "-")}</p>
      <p><strong>Mots déclencheurs:</strong> ${escapeHtml(words || "(non précisé)")}</p>
      <div style="margin-top:12px; padding:12px; background:#f9fafb; border:1px solid #e5e7eb; border-radius:6px;">
        <div style="color:#6b7280; font-size:12px; margin-bottom:6px;">Contenu du message</div>
        <div style="white-space:pre-wrap;">${escapeHtml(messageBody || "")}</div>
      </div>
    `,
  });
  const text = `Alerte mot filtré\nConversation #${conversationId}\nExpéditeur: ${senderType === "girl" ? `ADMIN (${senderAdminName || "?"}) via GIRL` : "CLIENT"}\nGirl: ${girlName || "-"}\nClient: ${clientName || "-"}\nMots: ${matchedWords.join(", ")}\n\nMessage:\n${messageBody || ""}`;
  return { subject, html: body, text };
}

module.exports = {
  renderWelcomeClient,
  renderForbiddenWordAlert,
};

