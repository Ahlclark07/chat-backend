const { AdminActivityLog, Admin } = require("../../models");

module.exports = {
  getLogs: async (req, res) => {
    try {
      const logs = await AdminActivityLog.findAll({
        include: [
          { model: Admin, attributes: ["id", "nom", "prenom", "role"] },
        ],
        order: [["createdAt", "DESC"]],
        limit: 100,
      });
      res.json(logs);
    } catch (err) {
      console.error(err);
      res
        .status(500)
        .json({ message: "Erreur lors de la récupération des logs." });
    }
  },
};
