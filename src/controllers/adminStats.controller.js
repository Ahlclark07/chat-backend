const { Message } = require("../../models");
const { Op } = require("sequelize");
const {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subWeeks,
  subMonths,
  startOfYear,
  endOfYear,
} = require("date-fns");

function getHourRange(date) {
  const h = date.getHours();
  const start = Math.floor(h / 4) * 4;
  const end = start + 4;
  return `${start.toString().padStart(2, "0")}-${end
    .toString()
    .padStart(2, "0")}`;
}

async function getAdminStats(req, res) {
  const adminId = parseInt(req.params.adminId, 10);

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

  // Comptes par périodes
  try {
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const lastWeekDate = subWeeks(now, 1);
    const lastWeekStart = startOfWeek(lastWeekDate, { weekStartsOn: 1 });
    const lastWeekEnd = endOfWeek(lastWeekDate, { weekStartsOn: 1 });

    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const lastMonthDate = subMonths(now, 1);
    const lastMonthStart = startOfMonth(lastMonthDate);
    const lastMonthEnd = endOfMonth(lastMonthDate);

    const yearStart = startOfYear(now);
    const yearEnd = endOfYear(now);

    const countInRange = (start, end) =>
      Message.count({
        where: {
          sender_type: "girl",
          sender_id: adminId,
          createdAt: { [Op.between]: [start, end] },
        },
      });

    const [currentWeek, lastWeek, currentMonth, lastMonth, currentYear] =
      await Promise.all([
        countInRange(weekStart, weekEnd),
        countInRange(lastWeekStart, lastWeekEnd),
        countInRange(monthStart, monthEnd),
        countInRange(lastMonthStart, lastMonthEnd),
        countInRange(yearStart, yearEnd),
      ]);

    return res.json({
      totalMessagesSent: total,
      statsByHourRange: stats,
      periodCounts: {
        currentWeek,
        lastWeek,
        currentMonth,
        lastMonth,
        currentYear,
      },
    });
  } catch (e) {
    console.error("Erreur calcul des périodes:", e);
    return res.json({
      totalMessagesSent: total,
      statsByHourRange: stats,
      periodCounts: {
        currentWeek: 0,
        lastWeek: 0,
        currentMonth: 0,
        lastMonth: 0,
        currentYear: 0,
      },
    });
  }
}

module.exports = {
  getAdminStats,
};
