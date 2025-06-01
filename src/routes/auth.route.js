const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");
const { uploadClientPhoto } = require("../middlewares/upload.middleware"); // prêt à brancher si on ajoute l'upload

// Authentification client
router.post("/register", uploadClientPhoto, authController.register);
router.post("/login", authController.login);
router.post("/refresh", authController.refresh);
router.post("/logout", authController.logout);

module.exports = router;
