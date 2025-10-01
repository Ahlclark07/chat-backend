const { Signalement, Admin } = require("../../models");

const ALLOWED_STATUS = ["en_cours", "termine"];

module.exports = {
  async create(req, res) {
    try {
      const { message } = req.body;
      if (!message || typeof message !== "string" || !message.trim()) {
        return res.status(400).json({
          message: "Le message du signalement est obligatoire.",
        });
      }

      const signalement = await Signalement.create({
        admin_id: req.admin.id,
        message: message.trim(),
      });

      const signalementWithAuthor = await Signalement.findByPk(signalement.id, {
        include: [
          {
            model: Admin,
            as: "auteur",
            attributes: ["id", "nom", "prenom", "email", "role"],
          },
        ],
      });

      return res.status(201).json(signalementWithAuthor);
    } catch (error) {
      console.error(error);
      return res
        .status(500)
        .json({ message: "Erreur lors de la création du signalement." });
    }
  },

  async list(req, res) {
    try {
      const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
      const limit = Math.max(parseInt(req.query.limit, 10) || 10, 1);
      const { status } = req.query;

      const where = {};
      if (status) {
        if (!ALLOWED_STATUS.includes(status)) {
          return res.status(400).json({
            message: "Le statut demandé est invalide.",
          });
        }
        where.status = status;
      }

      const { rows, count } = await Signalement.findAndCountAll({
        where,
        include: [
          {
            model: Admin,
            as: "auteur",
            attributes: ["id", "nom", "prenom", "email", "role"],
          },
        ],
        order: [["createdAt", "DESC"]],
        limit,
        offset: (page - 1) * limit,
      });

      return res.json({
        total: count,
        page,
        pageSize: limit,
        totalPages: Math.ceil(count / limit),
        data: rows,
      });
    } catch (error) {
      console.error(error);
      return res
        .status(500)
        .json({ message: "Erreur lors de la récupération des signalements." });
    }
  },

  async getById(req, res) {
    try {
      const { id } = req.params;
      const signalement = await Signalement.findByPk(id, {
        include: [
          {
            model: Admin,
            as: "auteur",
            attributes: ["id", "nom", "prenom", "email", "role"],
          },
        ],
      });

      if (!signalement) {
        return res.status(404).json({ message: "Signalement introuvable." });
      }

      return res.json(signalement);
    } catch (error) {
      console.error(error);
      return res
        .status(500)
        .json({ message: "Erreur lors de la récupération du signalement." });
    }
  },

  async updateStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!ALLOWED_STATUS.includes(status)) {
        return res.status(400).json({
          message: "Le statut doit être 'en_cours' ou 'termine'.",
        });
      }

      const signalement = await Signalement.findByPk(id);
      if (!signalement) {
        return res.status(404).json({ message: "Signalement introuvable." });
      }

      const updates = { status };
      if (status === "termine") {
        updates.resolved_at =
          signalement.status === "termine" && signalement.resolved_at
            ? signalement.resolved_at
            : new Date();
      } else {
        updates.resolved_at = null;
      }

      await signalement.update(updates);

      const refreshed = await Signalement.findByPk(id, {
        include: [
          {
            model: Admin,
            as: "auteur",
            attributes: ["id", "nom", "prenom", "email", "role"],
          },
        ],
      });

      return res.json(refreshed);
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        message: "Erreur lors de la mise à jour du signalement.",
      });
    }
  },

  async remove(req, res) {
    try {
      const { id } = req.params;
      const signalement = await Signalement.findByPk(id);
      if (!signalement) {
        return res.status(404).json({ message: "Signalement introuvable." });
      }

      await signalement.destroy();
      return res.status(204).send();
    } catch (error) {
      console.error(error);
      return res
        .status(500)
        .json({ message: "Erreur lors de la suppression du signalement." });
    }
  },
};
