const { SystemAlert, Admin } = require("../../models");
const { createSystemAlert } = require("../services/alert.service");

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
    const normalized = alerts.map((alert) => {
      const json = alert?.toJSON ? alert.toJSON() : alert;
      if (json && typeof json.details === "string") {
        try {
          json.details = JSON.parse(json.details);
        } catch {
          json.details = null;
        }
      }
      if (
        json?.details &&
        json.details.conversation_id &&
        !json.details.conversationId
      ) {
        json.details.conversationId = json.details.conversation_id;
      }
      return json;
    });
    res.json(normalized);
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ message: "Erreur lors de la récupération des alertes." });
  }
};

exports.createAlert = async (req, res) => {
  try {
    const { type, severity, details } = req.body || {};
    const allowedTypes = new Set(["MULTIPLE_CONNECTIONS"]);
    if (!allowedTypes.has(type)) {
      return res.status(400).json({ message: "Type d'alerte invalide." });
    }

    const payload = {
      type,
      severity: severity || "HIGH",
      status: "OPEN",
      admin_id: req.admin?.id || null,
      details: {
        ...(details && typeof details === "object" ? details : {}),
        triggered_by: "manual",
        ip: req.ip,
        userAgent: req.headers["user-agent"] || null,
      },
    };

    const alert = await createSystemAlert(payload);
    if (!alert) {
      return res
        .status(500)
        .json({ message: "Erreur lors de la creation de l'alerte." });
    }
    return res.status(201).json(alert);
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ message: "Erreur lors de la creation de l'alerte." });
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
