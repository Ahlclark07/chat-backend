const {
  Girl,
  AdminGirl,
  City,
  Admin,
  GirlPhoto,
  AdminActivityLog,
} = require("../../models");

module.exports = {
  // 1️⃣ Créer un profil Girl
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
        admin_id, // 👈 maintenant autorisé dans le body
      } = req.body;
      console.log(req.files);
      const girl = await Girl.create({
        nom,
        prenom,
        date_naissance,
        description,
        pays_id,
        ville_id,
        sexe,
        telephone,
        photo_profil: req.files.photo_profil[0]
          ? req.files.photo_profil[0].filename
          : null,
        created_by: req.admin.id, // 👈 superadmin ou god créateur
        admin_id: admin_id || null, // 👈 admin assigné
      });

      if (req.files?.photos?.length) {
        const galleryPhotos = req.files.photos;
        const photoData = galleryPhotos.map((file) => ({
          girl_id: girl.id,
          url: file.filename,
        }));
        await GirlPhoto.bulkCreate(photoData);
      }

      await AdminActivityLog.create({
        adminId: req.admin.id,
        action: "CREATE_GIRL",
        targetType: "Girl",
        targetId: girl.id,
        details: `nom: ${girl.nom},
          prenom: ${girl.prenom}`,
      });

      res.status(201).json(girl);
    } catch (err) {
      console.error(err);
      res
        .status(500)
        .json({ message: "Erreur lors de la création de la Girl." });
    }
  },

  updateGirl: async (req, res) => {
    try {
      const girlId = req.params.id;
      const {
        nom,
        prenom,
        date_naissance,
        description,
        pays_id,
        ville_id,
        admin_id,
        sexe,
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
      console.log(req.body);
      // Photo de profil (si nouvelle image)
      if (req.files.photo_profil) {
        girl.photo_profil = req.files.photo_profil[0].filename;
      }

      await girl.save();

      await AdminActivityLog.create({
        adminId: req.admin.id,
        action: "UPDATE_GIRL",
        targetType: "Girl",
        targetId: girl.id,
        details: `nom: ${girl.nom},
          prenom: ${girl.prenom}`,
      });

      res.status(200).json(girl);
    } catch (err) {
      console.error(err);
      res
        .status(500)
        .json({ message: "Erreur lors de la mise à jour de la girl." });
    }
  },

  // 2️⃣ Assigner une girl à un admin
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
      const page = parseInt(req.query.page, 10) || 1;
      const limit = 20;
      const offset = (page - 1) * limit;

      const girls = await Girl.findAndCountAll({
        limit,
        offset,
        order: [["createdAt", "DESC"]],
        include: [
          { model: City, as: "ville", attributes: ["name"] },
          { model: Admin, as: "admin", attributes: ["nom", "prenom"] },
          { model: Admin, as: "creator", attributes: ["nom", "prenom"] },
        ],
      });

      res.json({
        total: girls.count,
        page,
        totalPages: Math.ceil(girls.count / limit),
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

      await girl.destroy();

      await AdminActivityLog.create({
        adminId: req.admin.id,
        action: "DELETE_GIRL",
        targetType: "Girl",
        targetId: girl.id,
        details: `nom: ${girl.nom},
          prenom: ${girl.prenom}`,
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
