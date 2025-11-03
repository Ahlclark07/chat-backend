const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");
const { authenticateJWT } = require("../middlewares/auth.middleware");
const { uploadClientPhoto } = require("../middlewares/upload.middleware"); // Pret a brancher si on ajoute l'upload

// Authentification client
router.post("/register", uploadClientPhoto, authController.register);
router.post("/login", authController.login);
router.get("/profile", authenticateJWT, authController.profile);
router.post("/refresh", authController.refresh);
router.post("/logout", authController.logout);
router.get("/activate", authController.activateAccount);

module.exports = router;

