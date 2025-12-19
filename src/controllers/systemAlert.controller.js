const { SystemAlert, Admin } = require("../../models");

exports.getAlerts = async (req, res) => {
  try {
    const alerts = await SystemAlert.findAll({
      order: [["createdAt", "DESC"]],
      include: [
        {
          model: Admin,
          as: "admin",
          attributes: ["id", "nom", "prenom", "email", "identifiant"],
        },
      ],
    });
    res.json(alerts);
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ message: "Erreur lors de la récupération des alertes." });
  }
};

exports.updateAlertStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // OPEN, RESOLVED, IGNORED

    const alert = await SystemAlert.findByPk(id);
    if (!alert) {
      return res.status(404).json({ message: "Alerte introuvable." });
    }

    await alert.update({ status });
    res.json(alert);
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ message: "Erreur lors de la mise à jour de l'alerte." });
  }
};
