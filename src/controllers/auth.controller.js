const bcrypt = require("bcrypt");
const { Client, RefreshToken } = require("../../models");
const { generateAccessToken, generateRefreshToken } = require("../utils/token");
const { Op } = require("sequelize");

// Durée d'expiration (à harmoniser avec utils/token.js si tu veux)
const REFRESH_EXPIRES_DAYS = 7;

module.exports = {
  // POST /auth/register
  register: async (req, res) => {
    try {
      const {
        nom,
        prenom,
        email,
        mot_de_passe,
        date_naissance,
        pays_id,
        ville_id,
        telephone,
      } = req.body;
      const photo_profil = req.file ? req.file.path : null;

      // Vérifier si l'email est déjà utilisé
      const existing = await Client.findOne({ where: { email } });
      if (existing) {
        return res.status(400).json({ message: "Email déjà utilisé." });
      }

      const hashedPassword = await bcrypt.hash(mot_de_passe, 10);

      const client = await Client.create({
        nom,
        prenom,
        email,
        mot_de_passe: hashedPassword,
        date_naissance,
        photo_profil,
        pays_id,
        ville_id,
        telephone,
        credit_balance: 0,
      });

      return res.status(201).json({ message: "Compte créé avec succès." });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Erreur lors de l’inscription." });
    }
  },

  // POST /auth/login
  login: async (req, res) => {
    try {
      const { email, mot_de_passe } = req.body;

      const client = await Client.findOne({ where: { email } });
      if (!client) {
        return res
          .status(400)
          .json({ message: "Email ou mot de passe incorrect." });
      }

      const isValid = await bcrypt.compare(mot_de_passe, client.mot_de_passe);
      if (!isValid) {
        return res
          .status(400)
          .json({ message: "Email ou mot de passe incorrect." });
      }

      const accessToken = generateAccessToken(client);
      const refreshToken = generateRefreshToken();

      // Enregistrer le refresh token
      await RefreshToken.create({
        client_id: client.id,
        token: refreshToken,
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
        expires_at: new Date(
          Date.now() + REFRESH_EXPIRES_DAYS * 24 * 60 * 60 * 1000
        ),
      });

      return res.status(200).json({
        accessToken,
        refreshToken,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Erreur lors de la connexion." });
    }
  },

  // POST /auth/refresh
  refresh: async (req, res) => {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken)
        return res.status(400).json({ message: "Token manquant." });

      const storedToken = await RefreshToken.findOne({
        where: {
          token: refreshToken,
          revoked: false,
          expires_at: { [Op.gt]: new Date() },
        },
        include: "client",
      });

      if (!storedToken || !storedToken.client) {
        return res.status(401).json({ message: "Token invalide ou expiré." });
      }

      const accessToken = generateAccessToken(storedToken.client);
      return res.status(200).json({ accessToken });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Erreur lors du refresh token." });
    }
  },

  // POST /auth/logout
  logout: async (req, res) => {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken)
        return res.status(400).json({ message: "Token manquant." });

      const token = await RefreshToken.findOne({
        where: { token: refreshToken },
      });

      if (token) {
        token.revoked = true;
        await token.save();
      }

      return res.status(200).json({ message: "Déconnexion réussie." });
    } catch (error) {
      console.error(error);
      return res
        .status(500)
        .json({ message: "Erreur lors de la déconnexion." });
    }
  },
};
