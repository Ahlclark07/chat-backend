const parseOptionalInt = (value) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === "number") {
    return Number.isNaN(value) ? null : value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = parseInt(trimmed, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
};
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
  return raw
    .map((value) => {
      const id = parseInt(value, 10);
      return Number.isInteger(id) ? id : null;
    })
    .filter((id) => id !== null);
};

const parseBooleanFlag = (input) => {
  if (typeof input === "string") {
    const normalized = input.trim().toLowerCase();
    if (!normalized) return false;
    return ["true", "1", "yes", "on"].includes(normalized);
  }
  return input === true || input === 1;
};
const deleteGirlFileIfExists = (filename) => {
  if (!filename) return;
  const filePath = path.join(
    __dirname,
    "..",
    "..",
    "uploads",
    "girls",
    filename
  );
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.warn("Suppression fichier échouée:", filePath);
  }
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
  // Créer un profil
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
        const existingPseudo = await Girl.findOne({
          where: { pseudo: normalizedPseudo },
        });
        if (existingPseudo) {
          return res.status(400).json({ message: "Pseudo deja utiliée." });
        }
      }

      const parsedPaysId = parseOptionalInt(pays_id);
      const parsedVilleId = parseOptionalInt(ville_id);
      const parsedAdminId = parseOptionalInt(admin_id);
      const normalizedSexe = normalizeOptionalString(sexe);
      const allowedSexes = new Set(["homme", "femme"]);
      const finalSexe = allowedSexes.has(normalizedSexe)
        ? normalizedSexe
        : null;

      const girl = await Girl.create({
        nom,
        prenom,
        date_naissance,
        description,
        pays_id: parsedPaysId ?? null,
        ville_id: parsedVilleId ?? null,
        sexe: finalSexe,
        telephone: normalizeOptionalString(telephone),
        pseudo: normalizedPseudo,
        photo_profil: req.files?.photo_profil?.[0]?.filename || null,
        created_by: req.admin.id, // superadmin ou god createur
        admin_id: parsedAdminId ?? null, // admin assigne
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
        .json({ message: "Erreur lors de la creation du profil." });
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
      if (!girl) return res.status(404).json({ message: "Profil non trouvé" });

      // Mise à jour des champs basiques
      girl.nom = nom ?? girl.nom;
      girl.prenom = prenom ?? girl.prenom;
      girl.date_naissance = date_naissance ?? girl.date_naissance;
      girl.description = description ?? girl.description;
      const parsedPaysId = parseOptionalInt(pays_id);
      if (parsedPaysId !== undefined) {
        girl.pays_id = parsedPaysId;
      }
      const parsedVilleId = parseOptionalInt(ville_id);
      if (parsedVilleId !== undefined) {
        girl.ville_id = parsedVilleId;
      }
      const parsedAdminId = parseOptionalInt(admin_id);
      if (parsedAdminId !== undefined) {
        girl.admin_id = parsedAdminId;
      }
      if (typeof sexe !== "undefined") {
        const normalizedSexeUpdate = normalizeOptionalString(sexe);
        const allowedSexes = new Set(["homme", "femme"]);
        if (normalizedSexeUpdate && !allowedSexes.has(normalizedSexeUpdate)) {
          return res.status(400).json({ message: "Valeur de sexe invalide." });
        }
        girl.sexe = normalizedSexeUpdate;
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

      // Gestion de la photo de profil
      const newProfileFile = req.files?.photo_profil?.[0]?.filename;
      if (newProfileFile) {
        const previousProfile = girl.photo_profil;
        girl.photo_profil = newProfileFile;
        if (previousProfile && previousProfile !== newProfileFile) {
          deleteGirlFileIfExists(previousProfile);
        }
      }

      await girl.save();

      const clearGallery =
        parseBooleanFlag(req.body.clear_gallery) ||
        parseBooleanFlag(req.body.clearGallery);

      if (clearGallery) {
        const existingPhotos = await GirlPhoto.findAll({
          where: { girl_id: girlId },
        });
        for (const photo of existingPhotos) {
          deleteGirlFileIfExists(photo.url);
        }
        await GirlPhoto.destroy({ where: { girl_id: girlId } });
      } else {
        const idsToDelete = new Set([
          ...parseIdList(req.body.photos_to_delete),
          ...parseIdList(req.body.photosToDelete),
          ...parseIdList(req.body.remove_photo_ids),
        ]);

        if (idsToDelete.size > 0) {
          const idArray = Array.from(idsToDelete);
          const photoRows = await GirlPhoto.findAll({
            where: { id: idArray, girl_id: girlId },
          });
          for (const photo of photoRows) {
            deleteGirlFileIfExists(photo.url);
          }
          await GirlPhoto.destroy({
            where: { id: idArray, girl_id: girlId },
          });
        }
      }

      // Ajout de nouvelles photos de galerie
      if (Array.isArray(req.files?.photos) && req.files.photos.length) {
        const photoData = req.files.photos.map((file) => ({
          girl_id: girl.id,
          url: file.filename,
        }));
        await GirlPhoto.bulkCreate(photoData);
      }
      await logAdminAction({
        adminId: req.admin.id,
        action: "UPDATE_GIRL",
        targetId: girl.id,
        details: "nom: " + girl.nom + ", prenom: " + girl.prenom,
      });

      await girl.reload({
        include: [
          { model: City, as: "ville", attributes: ["id", "name"] },
          { model: Admin, as: "admin", attributes: ["id", "nom", "prenom"] },
          { model: Admin, as: "creator", attributes: ["id", "nom", "prenom"] },
          { model: GirlPhoto, as: "photos", attributes: ["id", "url"] },
        ],
      });

      res.status(200).json(girl);
    } catch (err) {
      console.error(err);
      res
        .status(500)
        .json({ message: "Erreur lors de la mise à jour du profil." });
    }
  },

  getGirlById: async (req, res) => {
    try {
      const girlId = parseInt(req.params.id, 10);
      if (!Number.isInteger(girlId)) {
        return res.status(400).json({ message: "Identifiant invalide" });
      }

      const girl = await Girl.findByPk(girlId, {
        include: [
          { model: City, as: "ville", attributes: ["id", "name"] },
          { model: Admin, as: "admin", attributes: ["id", "nom", "prenom"] },
          { model: Admin, as: "creator", attributes: ["id", "nom", "prenom"] },
          { model: GirlPhoto, as: "photos", attributes: ["id", "url"] },
        ],
      });

      if (!girl) {
        return res.status(404).json({ message: "Profil non trouvé" });
      }

      return res.json(girl);
    } catch (err) {
      console.error(err);
      return res
        .status(500)
        .json({ message: "Erreur lors de la récupération du profil." });
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
          { model: GirlPhoto, as: "photos", attributes: ["id", "url"] },
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
        .json({ message: "Erreur lors de la récupération des profils." });
    }
  },
  deleteGirl: async (req, res) => {
    try {
      const admin = req.admin;
      const girlId = req.params.id;

      if (admin.role !== "god") {
        return res.status(403).json({
          message: "Accès refusé. Seul le god peut supprimer un profil.",
        });
      }

      const girl = await Girl.findByPk(girlId);
      if (!girl) {
        return res.status(404).json({ message: "Profil non trouvé." });
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
      res.status(200).json({ message: "Profil supprimé avec succès." });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ message: "Erreur lors de la suppression du profil." });
    }
  },
};
