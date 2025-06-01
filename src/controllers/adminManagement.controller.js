const { Admin } = require("../../models");
const bcrypt = require("bcrypt");

module.exports = {
  // Créer un compte admin ou superadmin
  createAdmin: async (req, res) => {
    try {
      const { nom, prenom, email, mot_de_passe, telephone, role } = req.body;
      const creatorRole = req.admin.role; // rôle du créateur

      // ❌ superadmin ne peut créer QUE des admin
      if (creatorRole === "superadmin" && role !== "admin") {
        return res
          .status(403)
          .json({ message: "Tu ne peux créer que des admins." });
      }

      // ❌ admin ne peut rien créer
      if (creatorRole === "admin") {
        return res
          .status(403)
          .json({ message: "Tu ne peux pas créer de compte." });
      }

      const hashed = await bcrypt.hash(mot_de_passe, 10);

      const newAdmin = await Admin.create({
        nom,
        prenom,
        email,
        mot_de_passe: hashed,
        telephone,
        role,
        is_active: true,
      });

      res.status(201).json(newAdmin);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Erreur lors de la création." });
    }
  },
  suspendAdmin: async (req, res) => {
    try {
      const { id } = req.params;
      const requestingRole = req.admin.role;

      const target = await Admin.findByPk(id);
      if (!target)
        return res.status(404).json({ message: "Admin introuvable." });

      if (target.role === "god") {
        return res
          .status(403)
          .json({ message: "Tu ne peux pas suspendre un god." });
      }

      // ❌ superadmin ne peut pas suspendre un autre superadmin
      if (requestingRole === "superadmin" && target.role !== "admin") {
        return res
          .status(403)
          .json({ message: "Tu ne peux suspendre que des admins." });
      }

      await Admin.update({ is_active: false }, { where: { id } });

      res.json({ message: "Compte suspendu." });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Erreur lors de la suspension." });
    }
  },
};
