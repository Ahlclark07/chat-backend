const { AutoMessage, Girl, Conversation, Message, Setting, AutoMessageDelivery } = require("../../models");
const { clientIdToSocketId } = require("../sockets");
const { Op } = require("sequelize");

async function pickAutoMessageForClient(clientId) {
  const delivered = await AutoMessageDelivery.findAll({
    where: { client_id: clientId },
    attributes: ["auto_message_id"],
    raw: true,
  });
  const deliveredIds = delivered.map((row) => row.auto_message_id);

  const where = deliveredIds.length
    ? { active: true, id: { [Op.notIn]: deliveredIds } }
    : { active: true };

  const count = await AutoMessage.count({ where });
  if (!count) return null;

  const offset = Math.floor(Math.random() * count);
  return AutoMessage.findOne({ where, offset, order: [["id", "ASC"]], raw: true });
}

async function pickGirlExcluding(girlIds = []) {
  const where = girlIds.length ? { id: { [Op.notIn]: girlIds } } : {};
  const count = await Girl.count({ where });
  if (!count) return null;
  const offset = Math.floor(Math.random() * count);
  return Girl.findOne({ where, offset, order: [["id", "ASC"]], raw: true });
}

async function processClient(io, clientId, maxConvs) {
  const convs = await Conversation.findAll({
    where: { client_id: clientId },
    attributes: ["id", "girl_id"],
    raw: true,
  });
  if (convs.length >= maxConvs) return; // stop if already threshold

  const autoMsg = await pickAutoMessageForClient(clientId);
  if (!autoMsg) return;

  const existingGirlIds = convs.map((c) => c.girl_id);
  const girl = await pickGirlExcluding(existingGirlIds);
  if (!girl) return;

  // Ensure conversation exists
  let conv = await Conversation.findOne({ where: { client_id: clientId, girl_id: girl.id } });
  if (!conv) {
    conv = await Conversation.create({ client_id: clientId, girl_id: girl.id });
  }

  // Create message from girl
  const message = await Message.create({
    conversation_id: conv.id,
    sender_type: "girl",
    sender_id: girl.admin_id || null,
    receiver_id: clientId,
    body: autoMsg.content,
  });

  await Conversation.update({ updatedAt: new Date() }, { where: { id: conv.id } });

  await AutoMessageDelivery.create({
    auto_message_id: autoMsg.id,
    client_id: clientId,
    conversation_id: conv.id,
    message_id: message.id,
  }).catch(() => {});

  const socketId = clientIdToSocketId.get(clientId);
  if (socketId) {
    const sock = io.sockets.sockets.get(socketId);
    if (sock) sock.join(`conversation_${conv.id}`);
    io.to(socketId).emit("ping_message", {
      girl_id: girl.id,
      nom: girl.nom,
      prenom: girl.prenom,
      photo_profil: girl.photo_profil,
      body: message.body,
    });
  }
}

async function loadConfig() {
  const keys = [
    "auto_messages_enabled",
    "auto_messages_interval_seconds",
    "auto_messages_max_conversations",
  ];
  const rows = await Setting.findAll({ where: { key: keys }, raw: true });
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    enabled: (map.auto_messages_enabled || "false") === "true",
    intervalMs: (parseInt(map.auto_messages_interval_seconds || "20", 10) || 20) * 1000,
    maxConvs: parseInt(map.auto_messages_max_conversations || "3", 10) || 3,
  };
}

function startAutoMessagesJob(io) {
  async function tick() {
    try {
      const cfg = await loadConfig();
      if (cfg.enabled) {
        const clientIds = Array.from(clientIdToSocketId.keys()).map((id) => parseInt(id, 10));
        for (const clientId of clientIds) {
          await processClient(io, clientId, cfg.maxConvs);
        }
      }
      setTimeout(tick, cfg.intervalMs);
    } catch (e) {
      console.error("AutoMessages job error:", e);
      setTimeout(tick, 20000);
    }
  }
  tick();
  console.log("AutoMessages job started (configurable)");
}

module.exports = { startAutoMessagesJob };

