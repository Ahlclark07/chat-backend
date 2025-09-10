const { Setting } = require("../../models");

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
      res.status(500).json({ message: "Erreur chargement paramètres." });
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
      res.status(500).json({ message: "Erreur mise à jour paramètre." });
    }
  },

  async updateAutoMessages(req, res) {
    try {
      const role = req.admin?.role;
      if (!["superadmin", "god"].includes(role)) {
        return res.status(403).json({ message: "Rôle non autorisé." });
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
            .json({ message: "interval_seconds doit être 5..3600" });
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
            .json({ message: "max_conversations doit être 1..10" });
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

      // Renvoie la configuration complète actualisée
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
      res.status(500).json({ message: "Erreur mise à jour auto-messages." });
    }
  },
};
