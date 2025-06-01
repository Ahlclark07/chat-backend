const { Girl, AdminGirl } = require("../../models");

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
        telephone,
      } = req.body;

      const girl = await Girl.create({
        nom,
        prenom,
        date_naissance,
        description,
        pays_id,
        ville_id,
        telephone,
        photo_profil: req.file ? req.file.path : null,
      });
      await logAdminAction({
        adminId: req.admin.id,
        action: "CREATE_GIRL",
        targetType: "Girl",
        targetId: girl.id,
        details: {
          nom: girl.nom,
          prenom: girl.prenom,
        },
      });

      res.status(201).json(girl);
    } catch (err) {
      console.error(err);
      res
        .status(500)
        .json({ message: "Erreur lors de la création de la Girl." });
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
};
