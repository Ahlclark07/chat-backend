const { ForbiddenWord, sequelize } = require("../../models");

function normalizeWord(w) {
  return (w || "").toString().trim().toLowerCase();
}

module.exports = {
  // Public: GET /api/filters/words
  async getPublicWords(req, res) {
    try {
      const rows = await ForbiddenWord.findAll({
        attributes: ["word"],
        order: [["word", "ASC"]],
      });
      return res.json({ words: rows.map((r) => r.word) });
    } catch (e) {
      console.error(e);
      return res
        .status(500)
        .json({ message: "Erreur lors du chargement des mots." });
    }
  },

  // Admin: GET /api/admin/forbidden-words/_debug
  async debug(req, res) {
    try {
      const qi = sequelize.getQueryInterface();
      let tableExists = true;
      try {
        await qi.describeTable("ForbiddenWords");
      } catch (e) {
        tableExists = false;
      }
      const count = tableExists ? await ForbiddenWord.count() : null;
      const cfg = sequelize?.config || {};
      return res.json({
        database: cfg.database || null,
        host: cfg.host || null,
        dialect: sequelize.getDialect(),
        tableExists,
        count,
      });
    } catch (e) {
      console.error(e);
      return res
        .status(500)
        .json({ message: "Debug error", error: e?.message });
    }
  },

  // Admin: GET /api/admin/forbidden-words
  async list(req, res) {
    try {
      const rows = await ForbiddenWord.findAll({
        order: [["createdAt", "DESC"]],
      });
      return res.json(rows);
    } catch (e) {
      console.error(e);
      return res
        .status(500)
        .json({ message: "Erreur lors du chargement des mots." });
    }
  },

  // Admin: POST /api/admin/forbidden-words
  async create(req, res) {
    try {
      const { word, words } = req.body || {};
      console.log(req.body);
      const createdBy = req.admin?.id || null;

      let toAdd = [];
      if (Array.isArray(words)) toAdd = words;
      else if (typeof word === "string") toAdd = [word];

      toAdd = Array.from(new Set(toAdd.map(normalizeWord))).filter(
        (w) => w.length > 0
      );
      if (toAdd.length === 0) {
        return res.status(400).json({ message: "Aucun mot valide fourni." });
      }

      const results = [];
      const errors = [];
      for (const w of toAdd) {
        try {
          const [row] = await ForbiddenWord.findOrCreate({
            where: { word: w },
            defaults: { word: w, created_by: createdBy },
          });
          const created = Boolean(row?._options?.isNewRecord);
          results.push({ word: row.word, id: row.id, created });
        } catch (err) {
          errors.push({ word: w, message: err?.message || "insert failed" });
        }
      }

      if (results.length === 0 && errors.length > 0) {
        return res.status(500).json({
          message: "Erreur lors de l'ajout des mots (vérifiez les migrations).",
          errors,
        });
      }

      return res.status(201).json({ added: results, errors });
    } catch (e) {
      console.error(e);
      return res
        .status(500)
        .json({ message: "Erreur lors de l'ajout des mots." });
    }
  },

  // Admin: DELETE /api/admin/forbidden-words/:id
  async remove(req, res) {
    try {
      const { id } = req.params;
      const row = await ForbiddenWord.findByPk(id);
      if (!row) return res.status(404).json({ message: "Mot introuvable." });
      await row.destroy();
      return res.json({ success: true });
    } catch (e) {
      console.error(e);
      return res
        .status(500)
        .json({ message: "Erreur lors de la suppression." });
    }
  },
};
