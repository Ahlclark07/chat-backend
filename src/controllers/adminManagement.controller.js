const { Admin } = require("../../models");
const bcrypt = require("bcrypt");

module.exports = {
  // Créer un compte admin ou superadmin
  createGod: async (req, res) => {
    try {
      const { nom, prenom, email, mot_de_passe, telephone, role } = {
        nom: "Admin",
        prenom: "god",
        email: "admingod@gmail.com",
        mot_de_passe: "motdepasse",
        telephone: "+2290144444444",
        role: "god",
      };

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
  listAdmins: async (req, res) => {
    try {
      const requester = req.admin;
      const page = parseInt(req.query.page) || 1;
      const limit = 20;
      const offset = (page - 1) * limit;

      const whereClause = {};

      if (requester.role === "superadmin") {
        whereClause.role = "admin";
      } else if (requester.role !== "god") {
        return res.status(403).json({ message: "Accès refusé" });
      }

      const { rows, count } = await Admin.findAndCountAll({
        where: whereClause,
        attributes: ["id", "nom", "prenom", "email", "telephone", "role"],
        offset,
        limit,
        order: [["createdAt", "DESC"]],
      });

      return res.json({
        data: rows,
        page,
        totalPages: Math.ceil(count / limit),
      });
    } catch (err) {
      console.error(err);
      return res
        .status(500)
        .json({ message: "Erreur lors de la récupération des admins." });
    }
  },
  deleteAdmin: async (req, res) => {
    try {
      const requester = req.admin;
      const id = parseInt(req.params.id);
      const adminToDelete = await Admin.findByPk(id);

      if (!adminToDelete) {
        return res.status(404).json({ message: "Admin introuvable." });
      }

      if (adminToDelete.role === "god") {
        return res
          .status(403)
          .json({ message: "Impossible de supprimer un god." });
      }

      if (requester.role === "superadmin" && adminToDelete.role !== "admin") {
        return res
          .status(403)
          .json({ message: "Vous ne pouvez supprimer que des admins." });
      }

      if (requester.role !== "god" && requester.role !== "superadmin") {
        return res.status(403).json({ message: "Accès refusé." });
      }

      await adminToDelete.destroy();

      return res.json({ message: "Admin supprimé avec succès." });
    } catch (err) {
      console.error(err);
      return res
        .status(500)
        .json({ message: "Erreur lors de la suppression." });
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
