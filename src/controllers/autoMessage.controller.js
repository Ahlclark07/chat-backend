const { AutoMessage } = require("../../models");

module.exports = {
  async create(req, res) {
    try {
      const role = req.admin?.role;
      if (!["superadmin", "god"].includes(role)) {
        return res.status(403).json({ message: "Rôle non autorisé." });
      }
      const { content, active = true } = req.body;
      if (!content || typeof content !== "string") {
        return res.status(400).json({ message: "Contenu requis." });
      }
      const msg = await AutoMessage.create({
        content,
        active: !!active,
        created_by: req.admin.id,
      });
      res.status(201).json(msg);
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Erreur création message auto." });
    }
  },
  async list(req, res) {
    try {
      const { active } = req.query;
      const where = {};
      if (typeof active !== "undefined") where.active = active === "true";
      const rows = await AutoMessage.findAll({ where, order: [["createdAt", "DESC"]] });
      res.json(rows);
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Erreur chargement messages." });
    }
  },
  async update(req, res) {
    try {
      const role = req.admin?.role;
      if (!["superadmin", "god"].includes(role)) {
        return res.status(403).json({ message: "Rôle non autorisé." });
      }
      const id = parseInt(req.params.id, 10);
      const msg = await AutoMessage.findByPk(id);
      if (!msg) return res.status(404).json({ message: "Introuvable" });
      const { content, active } = req.body;
      await msg.update({
        ...(typeof content === "string" ? { content } : {}),
        ...(typeof active !== "undefined" ? { active: !!active } : {}),
      });
      res.json(msg);
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Erreur mise à jour." });
    }
  },
  async remove(req, res) {
    try {
      const role = req.admin?.role;
      if (!["superadmin", "god"].includes(role)) {
        return res.status(403).json({ message: "Rôle non autorisé." });
      }
      const id = parseInt(req.params.id, 10);
      const msg = await AutoMessage.findByPk(id);
      if (!msg) return res.status(404).json({ message: "Introuvable" });
      await msg.destroy();
      res.json({ success: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Erreur suppression." });
    }
  },
};

