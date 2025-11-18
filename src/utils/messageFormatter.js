function toPlain(instance) {
  if (!instance) {
    return null;
  }
  if (typeof instance.toJSON === "function") {
    return instance.toJSON();
  }
  if (typeof instance === "object") {
    return { ...instance };
  }
  return instance;
}

function buildAdminDisplayName(admin) {
  if (!admin) {
    return null;
  }
  const { prenom, nom, identifiant, id } = admin;
  const parts = [prenom, nom].filter(
    (value) => typeof value === "string" && value.trim().length
  );
  if (parts.length) {
    return parts.join(" ").trim();
  }
  if (identifiant && identifiant.trim().length) {
    return identifiant.trim();
  }
  if (typeof id !== "undefined" && id !== null) {
    return `Admin #${id}`;
  }
  return null;
}

function scrubIdentifiant(admin, expose = false) {
  const plain = toPlain(admin);
  if (!plain) {
    return plain;
  }
  if (!expose && typeof plain.identifiant !== "undefined") {
    delete plain.identifiant;
  }
  return plain;
}

function formatMessageRecord(messageInstance, options = {}) {
  const message = toPlain(messageInstance);
  if (!message) {
    return message;
  }
  const exposeIdentifiant = Boolean(options.exposeAdminIdentifiers);
  const assignedAdminRaw =
    message.conversation?.assigned_admin || options.assignedAdmin || null;
  const assignedAdmin = scrubIdentifiant(assignedAdminRaw, exposeIdentifiant);

  if (message.sender_type === "girl" && message.sender_id) {
    message.sender_admin_id = message.sender_id;
  }

  if (message.sender_admin) {
    const senderAdmin = scrubIdentifiant(
      message.sender_admin,
      exposeIdentifiant
    );
    message.sender_admin_display_name = buildAdminDisplayName(senderAdmin);
    if (exposeIdentifiant) {
      message.sender_admin_identifiant = senderAdmin?.identifiant || null;
    } else if (typeof message.sender_admin_identifiant !== "undefined") {
      delete message.sender_admin_identifiant;
    }
  }

  if (assignedAdmin) {
    if (exposeIdentifiant) {
      message.assigned_admin_identifiant =
        assignedAdmin.identifiant || message.assigned_admin_identifiant || null;
    } else if (typeof message.assigned_admin_identifiant !== "undefined") {
      delete message.assigned_admin_identifiant;
    }
    message.assigned_admin_display_name =
      buildAdminDisplayName(assignedAdmin) ||
      message.assigned_admin_display_name ||
      null;
  }

  if (
    !message.assigned_admin_display_name &&
    message.sender_admin_display_name
  ) {
    message.assigned_admin_display_name =
      message.sender_admin_display_name;
  }

  delete message.conversation;
  delete message.sender_admin;
  return message;
}

function formatMessages(messages, options = {}) {
  if (!Array.isArray(messages)) {
    return [];
  }
  return messages.map((message) => formatMessageRecord(message, options));
}

module.exports = {
  buildAdminDisplayName,
  formatMessageRecord,
  formatMessages,
  scrubIdentifiant,
};
