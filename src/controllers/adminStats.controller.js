const {
  Admin,
  AdminGirl,
  Girl,
  Conversation,
  Message,
  CreditTransaction,
} = require("../../models");
const { Op, fn, col, literal } = require("sequelize");
const { startOfWeek, startOfDay } = require("date-fns");

module.exports = {
  getGlobalStats: async (req, res) => {
    try {
      const today = startOfDay(new Date());
      const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 }); // lundi

      // Bloc 1 : global
      const [
        total_messages,
        messages_today,
        messages_this_week,
        total_credits,
      ] = await Promise.all([
        Message.count(),
        Message.count({ where: { createdAt: { [Op.gte]: today } } }),
        Message.count({ where: { createdAt: { [Op.gte]: weekStart } } }),
        CreditTransaction.sum("amount"), // montant est négatif
      ]);

      // Bloc 2 : par admin
      const admins = await Admin.findAll({
        where: { role: "admin" },
        attributes: ["id", "nom", "prenom"],
        include: [
          {
            model: AdminGirl,
            include: [{ model: Girl }],
          },
        ],
      });

      const adminStats = [];

      for (const admin of admins) {
        const girlIds = admin.AdminGirls.map((ag) => ag.girl_id);

        const [envoyes, reçus, cette_semaine] = await Promise.all([
          Message.count({
            where: {
              sender_type: "girl",
              "$Conversation.girl_id$": { [Op.in]: girlIds },
            },
            include: [{ model: Conversation }],
          }),
          Message.count({
            where: {
              sender_type: "client",
              "$Conversation.girl_id$": { [Op.in]: girlIds },
            },
            include: [{ model: Conversation }],
          }),
          Message.count({
            where: {
              sender_type: "girl",
              createdAt: { [Op.gte]: weekStart },
              "$Conversation.girl_id$": { [Op.in]: girlIds },
            },
            include: [{ model: Conversation }],
          }),
        ]);

        adminStats.push({
          admin_id: admin.id,
          admin_nom: `${admin.prenom} ${admin.nom}`,
          messages_envoyes: envoyes,
          messages_recus: reçus,
          messages_cette_semaine: cette_semaine,
        });
      }

      res.json({
        global: {
          total_messages,
          messages_today,
          messages_this_week,
          total_credits_used: Math.abs(total_credits || 0),
        },
        per_admin: adminStats,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Erreur lors du calcul des stats." });
    }
  },
};
