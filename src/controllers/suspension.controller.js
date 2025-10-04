const db = require("../../models");
const { SuspensionReason } = db;

function normalizeType(typeRaw) {
  const value = String(typeRaw || "").trim().toLowerCase();
  if (value === "client") return "Client";
  if (value === "admin") return "Admin";
  return null;
}

module.exports = {
  async getLast(req, res) {
    try {
      const type = normalizeType(req.query.type);
      const id = parseInt(req.query.id, 10);
      if (!type || !Number.isInteger(id)) {
        return res.status(400).json({ message: "Paramètres invalides." });
      }

      const row = await SuspensionReason.findOne({
        where: { user_type: type, user_id: id },
        order: [["createdAt", "DESC"]],
        attributes: ["id", "user_type", "user_id", "suspended_by_id", "reason", "createdAt"],
      });
      if (!row) return res.status(404).json({ message: "Aucune suspension." });
      return res.status(200).json(row);
    } catch (err) {
      return res.status(500).json({ message: "Erreur récupération suspension." });
    }
  },

  async listAll(req, res) {
    try {
      const type = normalizeType(req.query.type);
      const id = parseInt(req.query.id, 10);
      if (!type || !Number.isInteger(id)) {
        return res.status(400).json({ message: "Paramètres invalides." });
      }

      const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
      const limitRaw = parseInt(req.query.limit, 10);
      const limit = limitRaw && limitRaw > 0 ? Math.min(limitRaw, 100) : 20;
      const offset = (page - 1) * limit;

      const { rows, count } = await SuspensionReason.findAndCountAll({
        where: { user_type: type, user_id: id },
        order: [["createdAt", "DESC"]],
        limit,
        offset,
        attributes: ["id", "user_type", "user_id", "suspended_by_id", "reason", "createdAt"],
      });

      return res.status(200).json({
        total: count,
        page,
        pageSize: limit,
        totalPages: Math.ceil(count / limit),
        data: rows,
      });
    } catch (err) {
      return res.status(500).json({ message: "Erreur récupération historique." });
    }
  },
};
