const { Conversation, ConversationAdminStat } = require("../../models");

/**
 * Returns admins ranked by participation for a conversation.
 * @param {number} conversationId
 * @returns {Promise<Array<{ adminId: number, messageCount: number, lastMessageAt: Date | null }>>}
 */
async function getAdminPriorityList(conversationId) {
  if (!conversationId) {
    return [];
  }

  const stats = await ConversationAdminStat.findAll({
    where: { conversation_id: conversationId },
    order: [
      ["message_count", "DESC"],
      ["last_message_at", "DESC"],
      ["admin_id", "ASC"],
    ],
    raw: true,
  });

  return stats.map((row) => ({
    adminId: row.admin_id,
    messageCount: row.message_count || 0,
    lastMessageAt: row.last_message_at || null,
  }));
}

/**
 * Increments participation count for an admin inside a conversation.
 * Cares about both total messages and last interaction timestamp.
 */
async function incrementAdminParticipation(conversationId, adminId, options = {}) {
  if (!conversationId || !adminId) {
    return null;
  }

  const tx = options.transaction;
  const now = new Date();

  const [stat, created] = await ConversationAdminStat.findOrCreate({
    where: { conversation_id: conversationId, admin_id: adminId },
    defaults: {
      message_count: 1,
      last_message_at: now,
    },
    transaction: tx,
  });

  if (!created) {
    stat.message_count += 1;
    stat.last_message_at = now;
    await stat.save({ transaction: tx });
  }

  await Conversation.update(
    { assigned_admin_id: adminId, updatedAt: now },
    { where: { id: conversationId }, transaction: tx }
  );

  return stat;
}

async function setConversationAssignedAdmin(conversationId, adminId, options = {}) {
  if (!conversationId) {
    return;
  }

  await Conversation.update(
    { assigned_admin_id: adminId ?? null, updatedAt: new Date() },
    { where: { id: conversationId }, transaction: options.transaction }
  );
}

module.exports = {
  getAdminPriorityList,
  incrementAdminParticipation,
  setConversationAssignedAdmin,
};
