const {
  Girl,
  AdminGirl,
  City,
  Admin,
  GirlPhoto,
  AdminActivityLog,
} = require("../../models");
const path = require("path");
const fs = require("fs");
const { Op } = require("sequelize");

const normalizeOptionalString = (value) => {
  if (typeof value !== "string") {
    return value ?? null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const logAdminAction = async ({ adminId, action, targetId, details }) => {
  try {
    await AdminActivityLog.create({
      admin_id: adminId,
      adminId,
      action,
      target_type: "Girl",
      targetType: "Girl",
      target_id: targetId,
      targetId,
      details,
    });
  } catch (_) {}
};

module.exports = {
  // Créer un profil Girl
  createGirl: async (req, res) => {
    try {
      const {
        nom,
        prenom,
        date_naissance,
        description,
        pays_id,
        ville_id,
        sexe,
        telephone,
        pseudo,
        admin_id, // maintenant autorisé dans le body
      } = req.body;
      console.log(req.files);

      const normalizedPseudo = normalizeOptionalString(pseudo);
      if (normalizedPseudo) {
        const existingPseudo = await Girl.findOne({ where: { pseudo: normalizedPseudo } });
        if (existingPseudo) {
          return res.status(400).json({ message: "Pseudo deja utilise." });
        }
      }

      const girl = await Girl.create({
        nom,
        prenom,
        date_naissance,
        description,
        pays_id,
        ville_id,
        sexe,
        telephone: normalizeOptionalString(telephone),
        pseudo: normalizedPseudo,
        photo_profil: req.files?.photo_profil?.[0]?.filename || null,
        created_by: req.admin.id, // superadmin ou god créateur
        admin_id: admin_id || null, // admin assigné
      });

      if (req.files?.photos?.length) {
        const galleryPhotos = req.files.photos;
        const photoData = galleryPhotos.map((file) => ({
          girl_id: girl.id,
          url: file.filename,
        }));
        await GirlPhoto.bulkCreate(photoData);
      }

      await logAdminAction({
        adminId: req.admin.id,
        action: "CREATE_GIRL",
        targetId: girl.id,
        details: "nom: " + girl.nom + ", prenom: " + girl.prenom,
      });

      res.status(201).json(girl);
    } catch (err) {
      console.error(err);
      res
        .status(500)
        .json({ message: "Erreur lors de la creation de la Girl." });
    }
  },

  updateGirl: async (req, res) => {
    try {
      const girlId = parseInt(req.params.id, 10);
      if (!Number.isInteger(girlId)) {
        return res.status(400).json({ message: "Identifiant invalide" });
      }
      const {
        nom,
        prenom,
        date_naissance,
        description,
        pays_id,
        ville_id,
        admin_id,
        sexe,
        telephone,
        pseudo,
      } = req.body;

      const girl = await Girl.findByPk(girlId);
      if (!girl) return res.status(404).json({ message: "Girl non trouvée" });

      // Mise à jour des champs
      girl.nom = nom ?? girl.nom;
      girl.prenom = prenom ?? girl.prenom;
      girl.date_naissance = date_naissance ?? girl.date_naissance;
      girl.description = description ?? girl.description;
      girl.pays_id = pays_id ?? girl.pays_id;
      girl.ville_id = ville_id ?? girl.ville_id;
      girl.admin_id = admin_id ?? girl.admin_id;
      if (typeof sexe !== "undefined") {
        girl.sexe = sexe;
      }
      if (typeof pseudo !== "undefined") {
        const normalizedPseudoUpdate = normalizeOptionalString(pseudo);
        if (normalizedPseudoUpdate) {
          const existingPseudo = await Girl.findOne({
            where: { pseudo: normalizedPseudoUpdate, id: { [Op.ne]: girlId } },
          });
          if (existingPseudo) {
            return res.status(400).json({ message: "Pseudo deja utilise." });
          }
        }
        girl.pseudo = normalizedPseudoUpdate;
      }
      if (typeof telephone !== "undefined") {
        girl.telephone = normalizeOptionalString(telephone);
      }

      // Photo de profil (si nouvelle image)
      if (req.files?.photo_profil) {
        girl.photo_profil = req.files.photo_profil[0].filename;
      }

      await girl.save();

      await logAdminAction({
        adminId: req.admin.id,
        action: "UPDATE_GIRL",
        targetId: girl.id,
        details: "nom: " + girl.nom + ", prenom: " + girl.prenom,
      });

      res.status(200).json(girl);
    } catch (err) {
      console.error(err);
      res
        .status(500)
        .json({ message: "Erreur lors de la mise à jour de la girl." });
    }
  },

  // Assigner une girl à un admin
  assignGirlToAdmin: async (req, res) => {
    try {
      const { id: girl_id } = req.params;
      const { admin_id } = req.body;

      if (!admin_id) {
        return res.status(400).json({ message: "admin_id requis." });
      }

      const existing = await AdminGirl.findOne({
        where: { girl_id, admin_id },
      });

      if (existing) {
        return res.status(200).json({ message: "Déjà assignée." });
      }

      const link = await AdminGirl.create({ girl_id, admin_id });

      res.status(201).json(link);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Erreur lors de l’assignation." });
    }
  },
  getPaginatedSummary: async (req, res) => {
    try {
      const girls = await Girl.findAndCountAll({
        order: [["createdAt", "DESC"]],
        include: [
          { model: City, as: "ville", attributes: ["name"] },
          { model: Admin, as: "admin", attributes: ["nom", "prenom"] },
          { model: Admin, as: "creator", attributes: ["nom", "prenom"] },
        ],
      });

      res.json({
        total: girls.count,
        data: girls.rows,
      });
    } catch (err) {
      console.error(err);
      res
        .status(500)
        .json({ message: "Erreur lors de la récupération des girls." });
    }
  },
  deleteGirl: async (req, res) => {
    try {
      const admin = req.admin;
      const girlId = req.params.id;

      if (admin.role !== "god") {
        return res.status(403).json({
          message: "Accès refusé. Seul le god peut supprimer une girl.",
        });
      }

      const girl = await Girl.findByPk(girlId);
      if (!girl) {
        return res.status(404).json({ message: "Girl non trouvée." });
      }

      // Supprimer les photos de galerie sur le disque
      const photos = await GirlPhoto.findAll({ where: { girl_id: girlId } });
      for (const p of photos) {
        const filePath = path.join(
          __dirname,
          "..",
          "..",
          "uploads",
          "girls",
          p.url
        );
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } catch (e) {
          console.warn("Suppression photo galerie échouée:", filePath);
        }
      }
      // Supprimer la photo de profil si présente
      if (girl.photo_profil) {
        const pp = path.join(
          __dirname,
          "..",
          "..",
          "uploads",
          "girls",
          girl.photo_profil
        );
        try {
          if (fs.existsSync(pp)) {
            fs.unlinkSync(pp);
          }
        } catch (e) {
          console.warn("Suppression photo profil échouée:", pp);
        }
      }

      // Nettoyage DB des entrées de galerie (au cas où les FK ne sont pas en cascade)
      await GirlPhoto.destroy({ where: { girl_id: girlId } });

      await girl.destroy();

      await logAdminAction({
        adminId: req.admin.id,
        action: "DELETE_GIRL",
        targetId: girl.id,
        details: "nom: " + girl.nom + ", prenom: " + girl.prenom,
      });
      res.status(200).json({ message: "Girl supprimée avec succès." });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ message: "Erreur lors de la suppression de la girl." });
    }
  },
};
