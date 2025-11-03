const {
  Setting,
  HomepageGirl,
  Girl,
  sequelize,
} = require("../../models");

const parseIdList = (input) => {
  if (input === undefined || input === null) return [];
  let raw = input;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      raw = JSON.parse(trimmed);
    } catch (_) {
      raw = trimmed
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }
  if (!Array.isArray(raw)) {
    raw = [raw];
  }
  const seen = new Set();
  const result = [];
  for (const value of raw) {
    const parsed = parseInt(value, 10);
    if (Number.isInteger(parsed) && !seen.has(parsed)) {
      seen.add(parsed);
      result.push(parsed);
    }
  }
  return result;
};

async function getCoinCost() {
  const s = await Setting.findOne({ where: { key: "coin_cost_per_message" } });
  return s ? parseInt(s.value, 10) || 1 : 1;
}

module.exports = {
  async getSettings(req, res) {
    try {
      const keys = [
        "coin_cost_per_message",
        "auto_messages_enabled",
        "auto_messages_interval_seconds",
        "auto_messages_max_conversations",
      ];
      const rows = await Setting.findAll({ where: { key: keys } });
      const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
      res.json({
        coin_cost_per_message: parseInt(map.coin_cost_per_message || "1", 10),
        auto_messages_enabled:
          (map.auto_messages_enabled || "false") === "true",
        auto_messages_interval_seconds: parseInt(
          map.auto_messages_interval_seconds || "20",
          10
        ),
        auto_messages_max_conversations: parseInt(
          map.auto_messages_max_conversations || "3",
          10
        ),
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Erreur chargement parametres." });
    }
  },

  async updateCoinCost(req, res) {
    try {
      const role = req.admin?.role;
      if (role !== "god") {
        return res
          .status(403)
          .json({ message: "Seul le superadmin peut modifier." });
      }
      const { value } = req.body;
      const v = parseInt(value, 10);
      if (!Number.isFinite(v) || v <= 0 || v > 1000) {
        return res.status(400).json({ message: "Valeur invalide (1..1000)." });
      }
      const [setting, created] = await Setting.findOrCreate({
        where: { key: "coin_cost_per_message" },
        defaults: { value: String(v) },
      });
      if (!created) await setting.update({ value: String(v) });
      res.json({ coin_cost_per_message: v });
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Erreur mise a jour parametre." });
    }
  },

  async updateAutoMessages(req, res) {
    try {
      const role = req.admin?.role;
      if (!["superadmin", "god"].includes(role)) {
        return res.status(403).json({ message: "Role non autorise." });
      }
      const { enabled, interval_seconds, max_conversations } = req.body;

      const updates = [];
      if (typeof enabled !== "undefined") {
        const val = enabled === true || enabled === "true" ? "true" : "false";
        updates.push({ key: "auto_messages_enabled", value: val });
      }
      if (typeof interval_seconds !== "undefined") {
        const v = parseInt(interval_seconds, 10);
        if (!Number.isFinite(v) || v < 5 || v > 3600)
          return res
            .status(400)
            .json({ message: "interval_seconds doit etre 5..3600" });
        updates.push({
          key: "auto_messages_interval_seconds",
          value: String(v),
        });
      }
      if (typeof max_conversations !== "undefined") {
        const v = parseInt(max_conversations, 10);
        if (!Number.isFinite(v) || v < 1 || v > 10)
          return res
            .status(400)
            .json({ message: "max_conversations doit etre 1..10" });
        updates.push({
          key: "auto_messages_max_conversations",
          value: String(v),
        });
      }

      for (const u of updates) {
        const [setting, created] = await Setting.findOrCreate({
          where: { key: u.key },
          defaults: { value: u.value },
        });
        if (!created) await setting.update({ value: u.value });
      }

      try {
        const keys = [
          "coin_cost_per_message",
          "auto_messages_enabled",
          "auto_messages_interval_seconds",
          "auto_messages_max_conversations",
        ];
        const rows = await Setting.findAll({ where: { key: keys } });
        const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
        return res.json({
          coin_cost_per_message: parseInt(map.coin_cost_per_message || "1", 10),
          auto_messages_enabled:
            (map.auto_messages_enabled || "false") === "true",
          auto_messages_interval_seconds: parseInt(
            map.auto_messages_interval_seconds || "20",
            10
          ),
          auto_messages_max_conversations: parseInt(
            map.auto_messages_max_conversations || "3",
            10
          ),
        });
      } catch (e) {
        return res.json({ success: true });
      }
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Erreur mise a jour auto-messages." });
    }
  },

  async getHomepageGirls(req, res) {
    try {
      const rows = await HomepageGirl.findAll({
        order: [
          ["position", "ASC"],
          ["createdAt", "ASC"],
        ],
        include: [
          {
            model: Girl,
            as: "girl",
            attributes: [
              "id",
              "nom",
              "prenom",
              "pseudo",
              "photo_profil",
              "pays_id",
              "ville_id",
            ],
          },
        ],
      });

      res.json(
        rows.map((row) => ({
          id: row.id,
          girl_id: row.girl_id,
          position: row.position,
          girl: row.girl,
        }))
      );
    } catch (e) {
      console.error(e);
      res
        .status(500)
        .json({ message: "Erreur chargement filles page accueil." });
    }
  },

  async updateHomepageGirls(req, res) {
    const role = req.admin?.role;
    if (!["superadmin", "god"].includes(role)) {
      return res.status(403).json({
        message: "Seuls le superadmin ou le god peuvent modifier la selection.",
      });
    }

    try {
      const rawIds =
        typeof req.body.girl_ids === "undefined" ? [] : req.body.girl_ids;

      if (
        typeof rawIds !== "undefined" &&
        !Array.isArray(rawIds) &&
        typeof rawIds !== "string"
      ) {
        return res.status(400).json({
          message: "girl_ids doit etre un tableau d'identifiants.",
        });
      }

      const girlIds = parseIdList(rawIds);

      if (girlIds.length > 30) {
        return res
          .status(400)
          .json({ message: "Selection limitee a 30 profils maximum." });
      }

      if (girlIds.length > 0) {
        const existingGirls = await Girl.findAll({
          where: { id: girlIds },
          attributes: ["id"],
        });
        const existingIds = new Set(existingGirls.map((g) => g.id));
        const missing = girlIds.filter((id) => !existingIds.has(id));
        if (missing.length > 0) {
          return res.status(400).json({
            message: "Certaines girls sont introuvables.",
            missing_ids: missing,
          });
        }
      }

      const t = await sequelize.transaction();
      try {
        await HomepageGirl.destroy({ where: {}, transaction: t });

        if (girlIds.length > 0) {
          const rows = girlIds.map((id, index) => ({
            girl_id: id,
            added_by: req.admin?.id ?? null,
            position: index,
          }));
          await HomepageGirl.bulkCreate(rows, { transaction: t });
        }

        await t.commit();
      } catch (err) {
        await t.rollback();
        throw err;
      }

      res.json({ girl_ids: girlIds });
    } catch (e) {
      console.error(e);
      res.status(500).json({
        message: "Erreur mise a jour filles page accueil.",
      });
    }
  },
};
