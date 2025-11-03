const db = require("../../models");
const { Message, Admin, sequelize } = db;
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

function parseDateValue(value) {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function resolveDateRange(query) {
  const now = new Date();
  let start = startOfMonth(now);
  let end = endOfMonth(now);

  const startCandidate = parseDateValue(query.startDate);
  if (startCandidate) {
    start = new Date(startCandidate);
  }

  const endCandidate = parseDateValue(query.endDate || query.finishDate);
  if (endCandidate) {
    end = new Date(endCandidate);
  }

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  if (start > end) {
    throw new Error("INVALID_RANGE");
  }

  return { start, end };
}

async function getAdminProductivity(req, res) {
  try {
    const { start, end } = resolveDateRange(req.query || {});
    const adminId = req.query?.adminId
      ? parseInt(req.query.adminId, 10)
      : null;

    const whereClause = {
      sender_type: "girl",
      is_follow_up: false,
      sender_id: { [Op.not]: null },
      createdAt: { [Op.between]: [start, end] },
    };

    if (adminId) {
      if (Number.isNaN(adminId)) {
        return res.status(400).json({ message: "adminId invalide." });
      }
      whereClause.sender_id = adminId;
    }

    const aggregates = await Message.findAll({
      attributes: [
        "sender_id",
        [
          sequelize.fn("COUNT", sequelize.col("Message.id")),
          "messageCount",
        ],
        [
          sequelize.fn(
            "COUNT",
            sequelize.fn(
              "DISTINCT",
              sequelize.col("Message.conversation_id")
            )
          ),
          "conversationCount",
        ],
      ],
      where: whereClause,
      group: ["sender_id"],
      raw: true,
    });

    if (!aggregates.length) {
      return res.json({
        range: {
          start: start.toISOString(),
          end: end.toISOString(),
        },
        stats: [],
      });
    }

    const adminIds = aggregates
      .map((row) => row.sender_id)
      .filter((id) => Number.isInteger(id));

    const admins = await Admin.findAll({
      where: { id: { [Op.in]: adminIds } },
      attributes: ["id", "identifiant", "prenom", "nom", "email"],
      raw: true,
    });

    const adminMap = new Map(admins.map((admin) => [admin.id, admin]));

    const stats = aggregates
      .map((row) => {
        const admin = adminMap.get(row.sender_id) || {};
        return {
          adminId: row.sender_id,
          identifiant: admin.identifiant || null,
          prenom: admin.prenom || null,
          nom: admin.nom || null,
          email: admin.email || null,
          conversationCount: Number(row.conversationCount) || 0,
          messageCount: Number(row.messageCount) || 0,
        };
      })
      .sort((a, b) => b.messageCount - a.messageCount);

    return res.json({
      range: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
      stats,
    });
  } catch (e) {
    if (e && e.message === "INVALID_RANGE") {
      return res
        .status(400)
        .json({
          message: "La date de debut doit etre anterieure a la date de fin.",
        });
    }

    console.error("Erreur stats productivite admin:", e);
    return res
      .status(500)
      .json({ message: "Erreur lors de la recuperation des statistiques." });
  }
}

module.exports = {
  getAdminStats,
  getAdminProductivity,
};
