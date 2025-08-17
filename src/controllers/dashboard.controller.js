// controllers/admin/dashboard.controller.js (refonte)
const { Op, Sequelize } = require("sequelize");
const {
  Admin,
  Girl,
  Client,
  Message,
  CreditTransaction,
  Conversation,
  Favorite,
} = require("../../models");
const {
  parseISO,
  startOfDay,
  endOfDay,
  subDays,
} = require("date-fns");

function getRange(req) {
  const { from, to } = req.query;
  let end = to ? endOfDay(parseISO(to)) : new Date();
  let start = from ? startOfDay(parseISO(from)) : subDays(end, 29);
  return { start, end };
}

function periodFormat(granularity) {
  switch (granularity) {
    case "week":
      return "%x-%v"; // ISO year-week (MySQL)
    case "month":
      return "%Y-%m";
    default:
      return "%Y-%m-%d"; // day
  }
}

exports.getStats = async (req, res) => {
  try {
    if (req.admin.role !== "god") {
      return res.status(403).json({ message: "Accès réservé au god." });
    }

    const { start, end } = getRange(req);
    const granularity = ["day", "week", "month"].includes(req.query.granularity)
      ? req.query.granularity
      : "day";
    const fmt = periodFormat(granularity);

    // ---------- Summary ----------
    const [
      creditsTotalRaw,
      creditsPeriodRaw,
      clientsTotal,
      clientsNew,
      girlsTotal,
      favoritesTotal,
      conversationsNew,
    ] = await Promise.all([
      CreditTransaction.sum("amount", { where: { amount: { [Op.lt]: 0 } } }),
      CreditTransaction.sum("amount", {
        where: { amount: { [Op.lt]: 0 }, createdAt: { [Op.between]: [start, end] } },
      }),
      Client.count(),
      Client.count({ where: { createdAt: { [Op.between]: [start, end] } } }),
      Girl.count(),
      Favorite.count(),
      Conversation.count({ where: { createdAt: { [Op.between]: [start, end] } } }),
    ]);

    // girlsActiveDistinct via raw SQL (plus efficace)
    const [girlsActiveRows] = await Conversation.sequelize.query(
      `SELECT COUNT(DISTINCT c.girl_id) AS cnt
       FROM Messages m
       JOIN Conversations c ON c.id = m.conversation_id
       WHERE m.createdAt BETWEEN :start AND :end`,
      { replacements: { start, end } }
    );
    const girlsActive = girlsActiveRows?.[0]?.cnt || 0;

    // clientsActive via messages (sender_type=client)
    const clientsActive = await Message.count({
      col: "sender_id",
      distinct: true,
      where: {
        sender_type: "client",
        createdAt: { [Op.between]: [start, end] },
      },
    });

    const summary = {
      creditsTotal: Math.abs(creditsTotalRaw || 0),
      creditsPeriod: Math.abs(creditsPeriodRaw || 0),
      clientsTotal,
      clientsNew,
      clientsActive,
      girlsTotal,
      girlsActive,
      favoritesTotal,
      conversationsNew,
    };

    // ---------- Revenue series ----------
    const [revenueSeries] = await CreditTransaction.sequelize.query(
      `SELECT DATE_FORMAT(createdAt, :fmt) AS period,
              SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END) AS credits
       FROM CreditTransactions
       WHERE createdAt BETWEEN :start AND :end
       GROUP BY period
       ORDER BY period ASC`,
      { replacements: { start, end, fmt } }
    );

    // Top by Girl
    const [revenueByGirl] = await CreditTransaction.sequelize.query(
      `SELECT g.id AS girlId, g.nom, g.prenom, COALESCE(SUM(-ct.amount),0) AS credits
       FROM CreditTransactions ct
       JOIN Conversations c ON c.id = ct.conversation_id
       JOIN Girls g ON g.id = c.girl_id
       WHERE ct.amount < 0 AND ct.createdAt BETWEEN :start AND :end
       GROUP BY g.id, g.nom, g.prenom
       ORDER BY credits DESC
       LIMIT 10`,
      { replacements: { start, end } }
    );

    // Top by Admin (assigned)
    const [revenueByAdmin] = await CreditTransaction.sequelize.query(
      `SELECT a.id AS adminId, a.nom, a.prenom, COALESCE(SUM(-ct.amount),0) AS credits
       FROM CreditTransactions ct
       JOIN Conversations c ON c.id = ct.conversation_id
       JOIN Admins a ON a.id = c.assigned_admin_id
       WHERE ct.amount < 0 AND ct.createdAt BETWEEN :start AND :end AND c.assigned_admin_id IS NOT NULL
       GROUP BY a.id, a.nom, a.prenom
       ORDER BY credits DESC
       LIMIT 10`,
      { replacements: { start, end } }
    );

    // ---------- Admins leaderboard ----------
    const [leaderboardByMsgs] = await Message.sequelize.query(
      `SELECT a.id AS adminId, a.nom, a.prenom, COUNT(*) AS messages
       FROM Messages m
       JOIN Admins a ON a.id = m.sender_id
       WHERE m.sender_type = 'girl' AND m.createdAt BETWEEN :start AND :end
       GROUP BY a.id, a.nom, a.prenom
       ORDER BY messages DESC
       LIMIT 10`,
      { replacements: { start, end } }
    );

    // ---------- Conversations series ----------
    const [conversationsNewSeries] = await Conversation.sequelize.query(
      `SELECT DATE_FORMAT(createdAt, :fmt) AS period, COUNT(*) AS count
       FROM Conversations
       WHERE createdAt BETWEEN :start AND :end
       GROUP BY period
       ORDER BY period ASC`,
      { replacements: { start, end, fmt } }
    );

    const [conversationsActiveSeries] = await Message.sequelize.query(
      `SELECT DATE_FORMAT(createdAt, :fmt) AS period, COUNT(DISTINCT conversation_id) AS count
       FROM Messages
       WHERE createdAt BETWEEN :start AND :end
       GROUP BY period
       ORDER BY period ASC`,
      { replacements: { start, end, fmt } }
    );

    // Avg duration and length per conversation in period
    const [convDurations] = await Message.sequelize.query(
      `SELECT AVG(TIMESTAMPDIFF(SECOND, t.min_created, t.max_created)) AS avgDurationSec,
              AVG(t.msg_count) AS avgLength
       FROM (
         SELECT conversation_id,
                MIN(createdAt) AS min_created,
                MAX(createdAt) AS max_created,
                COUNT(*) AS msg_count
         FROM Messages
         WHERE createdAt BETWEEN :start AND :end
         GROUP BY conversation_id
       ) t`,
      { replacements: { start, end } }
    );

    // ---------- QoS: first response time (per admin) ----------
    const msgs = await Message.findAll({
      attributes: ["conversation_id", "sender_type", "createdAt", "sender_id"],
      where: { createdAt: { [Op.between]: [start, end] } },
      order: [["conversation_id", "ASC"], ["createdAt", "ASC"]],
      raw: true,
    });

    const firstResponseByAdmin = new Map(); // adminId -> {sum, count, sla60}
    const seenConv = new Set();
    const firstResponseAll = []; // for global avg/sla
    // Build quick lookup for assigned admin per conversation
    const convIds = [...new Set(msgs.map((m) => m.conversation_id))];
    const convAssign = new Map();
    if (convIds.length) {
      const convs = await Conversation.findAll({
        attributes: ["id", "assigned_admin_id"],
        where: { id: { [Op.in]: convIds } },
        raw: true,
      });
      convs.forEach((c) => convAssign.set(c.id, c.assigned_admin_id));
    }

    // For each conversation, compute first client msg then first girl msg after
    let i = 0;
    while (i < msgs.length) {
      const convId = msgs[i].conversation_id;
      // Collect messages for this conversation
      const convMsgs = [];
      while (i < msgs.length && msgs[i].conversation_id === convId) {
        convMsgs.push(msgs[i]);
        i++;
      }
      // Find first client msg and subsequent girl msg
      const firstClient = convMsgs.find((m) => m.sender_type === "client");
      if (!firstClient) continue;
      const firstGirl = convMsgs.find(
        (m) => m.sender_type === "girl" && m.createdAt >= firstClient.createdAt
      );
      if (!firstGirl) continue;
      const deltaSec =
        (new Date(firstGirl.createdAt) - new Date(firstClient.createdAt)) /
        1000;
      firstResponseAll.push(deltaSec);
      const adminId = firstGirl.sender_id || convAssign.get(convId) || null;
      if (adminId) {
        const cur = firstResponseByAdmin.get(adminId) || {
          sum: 0,
          count: 0,
          sla60: 0,
        };
        cur.sum += deltaSec;
        cur.count += 1;
        if (deltaSec <= 60) cur.sla60 += 1;
        firstResponseByAdmin.set(adminId, cur);
      }
    }

    // Build arrays for response time per admin
    let responseTimeByAdmin = [];
    if (firstResponseByAdmin.size) {
      const adminIds = [...firstResponseByAdmin.keys()];
      const admins = await Admin.findAll({
        attributes: ["id", "nom", "prenom"],
        where: { id: { [Op.in]: adminIds } },
        raw: true,
      });
      const meta = new Map(admins.map((a) => [a.id, a]));
      responseTimeByAdmin = adminIds.map((id) => {
        const r = firstResponseByAdmin.get(id);
        const a = meta.get(id) || { nom: "?", prenom: "?" };
        return {
          adminId: id,
          nom: a.nom,
          prenom: a.prenom,
          avgFirstResponseSec: r.count ? Math.round((r.sum / r.count) * 10) / 10 : null,
          sla60Rate: r.count ? Math.round((r.sla60 / r.count) * 1000) / 10 : 0,
          samples: r.count,
        };
      });
      responseTimeByAdmin.sort((a, b) => (a.avgFirstResponseSec ?? 1e12) - (b.avgFirstResponseSec ?? 1e12));
    }

    const globalAvgFirstResponseSec = firstResponseAll.length
      ? Math.round(
          (firstResponseAll.reduce((a, b) => a + b, 0) / firstResponseAll.length) *
            10
        ) / 10
      : null;
    const globalSla60Rate = firstResponseAll.length
      ? Math.round(
          (firstResponseAll.filter((s) => s <= 60).length / firstResponseAll.length) *
            1000
        ) / 10
      : 0;

    const response = {
      summary: {
        ...summary,
        globalAvgFirstResponseSec,
        globalSla60Rate,
      },
      revenue: {
        series: revenueSeries,
        byGirl: revenueByGirl,
        byAdmin: revenueByAdmin,
      },
      admins: {
        leaderboardByMsgs,
        responseTimeByAdmin,
      },
      conversations: {
        newSeries: conversationsNewSeries,
        activeSeries: conversationsActiveSeries,
        avgDurationSec: convDurations?.[0]?.avgDurationSec || 0,
        avgLength: convDurations?.[0]?.avgLength || 0,
      },
      period: { start, end, granularity },
    };

    res.json(response);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Erreur lors du chargement des statistiques" });
  }
};
