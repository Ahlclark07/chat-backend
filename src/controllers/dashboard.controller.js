// controllers/admin/dashboard.controller.js
const { Op, fn, col, literal, Sequelize } = require("sequelize");
const {
  Admin,
  Girl,
  Client,
  Message,
  CreditTransaction,
} = require("../../models");
const { startOfHour, subHours } = require("date-fns");

exports.getStats = async (req, res) => {
  try {
    const admin = req.admin;
    const now = new Date();
    const twentyHoursAgo = subHours(startOfHour(now), 19);

    // Commun : stats par heure
    const hourlyStats = await Message.findAll({
      attributes: [
        [fn("DATE_FORMAT", col("createdAt"), "%Y-%m-%d %H:00:00"), "period"],
        [
          fn("COUNT", literal(`CASE WHEN sender_id = ${admin.id} THEN 1 END`)),
          "sent",
        ],
        [
          fn(
            "COUNT",
            literal(`CASE WHEN receiver_id = ${admin.id} THEN 1 END`)
          ),
          "received",
        ],
        [fn("COUNT", literal("DISTINCT conversation_id")), "conversations"],
      ],
      where: {
        createdAt: { [Op.gte]: twentyHoursAgo },
        [Op.or]: [{ sender_id: admin.id }, { receiver_id: admin.id }],
      },
      group: [Sequelize.literal("period")],
      order: [[Sequelize.literal("period"), "DESC"]],
    });

    const response = { hourlyStats };

    // Superadmin & God : girls créées & infos
    if (admin.role === "superadmin" || admin.role === "god") {
      const girls = await Girl.findAll({
        attributes: [
          "id",
          "nom",
          "photo_profil",
          "ville_id",
          "admin_id",
          "created_by",
        ],
        where: admin.role === "superadmin" ? { created_by: admin.id } : {},
        limit: 20,
        order: [["createdAt", "DESC"]],
      });

      response.girlsSummary = girls;

      if (admin.role === "superadmin") {
        const totalGirlsCreated = await Girl.count({
          where: { created_by: admin.id },
        });
        response.totalGirlsCreated = totalGirlsCreated;
      }
    }

    // God uniquement : stats globales
    if (admin.role === "god") {
      const [totalClients, totalGirls, totalCredits] = await Promise.all([
        Client.count(),
        Girl.count(),
        CreditTransaction.sum("amount"),
      ]);
      response.allStats = { totalClients, totalGirls, totalCredits };
    }

    res.json(response);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Erreur lors du chargement des statistiques" });
  }
};
