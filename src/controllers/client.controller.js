const { Client } = require("../../models");

module.exports = {
  // GET /me
  me: async (req, res) => {
    try {
      const client = await Client.findByPk(req.user.id, {
        attributes: { exclude: ["mot_de_passe"] },
      });

      if (!client) {
        return res.status(404).json({ message: "Client introuvable." });
      }

      return res.json(client);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Erreur serveur." });
    }
  },

  // PUT /me
  updateMe: async (req, res) => {
    try {
      const updates = req.body;
      const photoPath = req.file ? req.file.path : undefined;
      if (photoPath) updates.photo_profil = photoPath;

      const [updated] = await Client.update(updates, {
        where: { id: req.user.id },
      });

      if (!updated) {
        return res
          .status(404)
          .json({ message: "Client introuvable ou aucune modification." });
      }

      const client = await Client.findByPk(req.user.id, {
        attributes: { exclude: ["mot_de_passe"] },
      });

      return res.json(client);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Erreur serveur." });
    }
  },
};
