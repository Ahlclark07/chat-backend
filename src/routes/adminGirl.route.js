const express = require("express");
const router = express.Router();
const controller = require("../controllers/adminGirl.controller");
const {
  authenticateAdminJWT,
  authorizeRole,
} = require("../middlewares/admin.middleware");
const { uploadGirlPhoto } = require("../middlewares/uploadGirl.middleware"); // utilisé aussi ici pour la photo

// Créer une girl
router.post(
  "/girls",
  authenticateAdminJWT,
  authorizeRole("superadmin", "god"),
  uploadGirlPhoto, // réutilisé ici
  controller.createGirl
);

// Assigner une girl à un admin
router.post(
  "/girls/:id/assign",
  authenticateAdminJWT,
  authorizeRole("superadmin", "god"),
  controller.assignGirlToAdmin
);
// Modifier une girl (profil, info...)
router.patch(
  "/girls/:id",
  authenticateAdminJWT,
  authorizeRole("superadmin", "god"),
  uploadGirlPhoto, // pour gérer l'envoi éventuel d'une nouvelle photo
  controller.updateGirl
);

module.exports = router;
