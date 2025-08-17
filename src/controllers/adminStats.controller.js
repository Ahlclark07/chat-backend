const { Message } = require("../../models");
const { Op } = require("sequelize");

function getHourRange(date) {
  const h = date.getHours();
  const start = Math.floor(h / 4) * 4;
  const end = start + 4;
  return `${start.toString().padStart(2, "0")}-${end
    .toString()
    .padStart(2, "0")}`;
}

async function getAdminStats(req, res) {
  const adminId = req.params.adminId;

  const now = new Date();
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(now.getDate() - 3);

  // Récupère tous les messages de l'admin des 3 derniers jours
  const messages = await Message.findAll({
    where: {
      sender_type: "girl",
      sender_id: adminId,
      createdAt: {
        [Op.gte]: threeDaysAgo,
      },
    },
    attributes: ["createdAt"],
    raw: true,
  });

  // Regroupement des stats par jour et tranche horaire
  const stats = {};

  for (const msg of messages) {
    const date = new Date(msg.createdAt);
    const day = date.toISOString().split("T")[0]; // yyyy-mm-dd
    const range = getHourRange(date);

    if (!stats[day]) stats[day] = {};
    if (!stats[day][range]) stats[day][range] = 0;

    stats[day][range]++;
  }

  // Récupère le total de messages envoyés (tous temps confondus)
  const total = await Message.count({
    where: {
      sender_type: "girl",
      sender_id: adminId,
    },
  });

  return res.json({
    totalMessagesSent: total,
    statsByHourRange: stats,
  });
}

module.exports = {
  getAdminStats,
};
