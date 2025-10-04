const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require("uuid");
const db = require("../../models");
const { Client, RefreshToken, ClientActivationToken, sequelize } = db;
const { generateAccessToken, generateRefreshToken } = require("../utils/token");
const { Op } = require("sequelize");
const { sendMail } = require("../services/mail.service");
const {
  renderWelcomeClient,
  renderClientActivationMail,
} = require("../services/mailTemplates");

// Token expiration settings (see utils/token.js for durations)
const REFRESH_EXPIRES_DAYS = 7;
const ACTIVATION_TTL_HOURS =
  parseInt(process.env.CLIENT_ACTIVATION_TTL_HOURS || "48", 10) || 48;

const parseOptionalInt = (value) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const parsed = Number.parseInt(String(value).trim(), 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const buildActivationLink = (req, token) => {
  const base = process.env.CLIENT_ACTIVATION_BASE_URL || "";
  if (base) {
    if (base.includes("{token}")) {
      return base.replace("{token}", token);
    }
    const separator = base.includes("?") ? "&" : "?";
    return `${base}${separator}token=${token}`;
  }
  const protocol = (req && req.protocol) || "https";
  const host =
    (req && req.get && req.get("host")) ||
    process.env.API_PUBLIC_HOST ||
    "localhost";
  return `${protocol}://${host}/api/auth/activate?token=${token}`;
};

module.exports = {
  // POST /auth/register
  register: async (req, res) => {
    try {
      const {
        nom,
        prenom,
        pseudo,
        email,
        mot_de_passe,
        date_naissance,
        pays_id,
        ville_id,
        sexe,
        attirance,
        description,
        telephone,
      } = req.body;

      const photo_profil = req.files?.photo_profil?.[0]?.filename || null;

      const existing = await Client.findOne({ where: { email } });
      if (existing) {
        return res.status(400).json({ message: "Email déjà utilisé." });
      }

      const hashedPassword = await bcrypt.hash(mot_de_passe, 10);

      const normalizedPseudo =
        typeof pseudo === "string" ? pseudo.trim() : null;

      if (normalizedPseudo) {
        const existingPseudoClient = await Client.findOne({
          where: { pseudo: normalizedPseudo },
        });
        if (existingPseudoClient) {
          return res.status(400).json({ message: "Pseudo deja utilisé." });
        }
      }

      const allowedAttirance = ["femme", "homme", "tous"];
      const normalizedAttirance =
        attirance && allowedAttirance.includes(attirance) ? attirance : "tous";

      const parsedPaysId = parseOptionalInt(pays_id);
      const parsedVilleId = parseOptionalInt(ville_id);

      const client = await Client.create({
        nom,
        prenom,
        pseudo: normalizedPseudo,
        email,
        mot_de_passe: hashedPassword,
        date_naissance,
        photo_profil,
        description,
        pays_id: parsedPaysId ?? null,
        ville_id: parsedVilleId ?? null,
        sexe,
        attirance: normalizedAttirance,
        telephone,
        credit_balance: 100,
        is_active: false,
      });

      const activationToken = uuidv4();
      const expiresAt = new Date(
        Date.now() + ACTIVATION_TTL_HOURS * 60 * 60 * 1000
      );
      await ClientActivationToken.create({
        client_id: client.id,
        token: activationToken,
        expires_at: expiresAt,
      });

      if (email) {
        try {
          const activationLink = buildActivationLink(req, activationToken);
          const emailTpl = renderClientActivationMail({
            client: { prenom, nom },
            activationLink,
            expiresAt,
          });
          const from = process.env.SMTP_FROM || process.env.SMTP_USER;
          if (from) {
            sendMail({
              to: email,
              subject: emailTpl.subject,
              html: emailTpl.html,
              text: emailTpl.text,
              from,
              template: "CLIENT_ACTIVATION",
            }).catch(() => {});
          }
        } catch (mailErr) {
          console.error("Activation email error:", mailErr?.message || mailErr);
        }
      }

      const fullClient = await Client.findByPk(client.id, {
        attributes: { exclude: ["mot_de_passe"] },
        include: [
          { association: "pays", attributes: ["id", "name"] },
          { association: "ville", attributes: ["id", "name"] },
        ],
      });

      return res.status(201).json({
        message: "Compte créé. Consultez votre email pour l'activer.",
        activationExpiresAt: expiresAt,
        client: fullClient,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Erreur lors de l'inscription." });
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

      if (!client.is_active) {
        return res.status(403).json({
          message: "Compte non activé. Consultez votre email pour l'activer.",
        });
      }

      const accessToken = generateAccessToken(client);
      const refreshToken = generateRefreshToken();

      await RefreshToken.create({
        client_id: client.id,
        token: refreshToken,
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
        expires_at: new Date(
          Date.now() + REFRESH_EXPIRES_DAYS * 24 * 60 * 60 * 1000
        ),
      });

      // Récupérer client avec associations et sans mot de passe
      const fullClient = await Client.findByPk(client.id, {
        attributes: { exclude: ["mot_de_passe"] },
        include: [
          { association: "pays", attributes: ["id", "name"] },
          { association: "ville", attributes: ["id", "name"] },
        ],
      });

      return res.status(200).json({
        accessToken,
        refreshToken,
        client: fullClient,
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

  activateAccount: async (req, res) => {
    try {
      const token = (req.query?.token || req.body?.token || "").trim();
      if (!token) {
        return res.status(400).json({ message: "Token requis." });
      }

      const activationRecord = await ClientActivationToken.findOne({
        where: {
          token,
          consumed_at: null,
          expires_at: { [Op.gt]: new Date() },
        },
        include: [{ model: Client, as: "client" }],
      });

      if (!activationRecord || !activationRecord.client) {
        return res.status(400).json({ message: "Token invalide ou expiré." });
      }

      if (activationRecord.client.is_active) {
        return res.status(200).json({ message: "Compte déjà activé." });
      }

      const now = new Date();
      await sequelize.transaction(async (transaction) => {
        await Client.update(
          { is_active: true },
          { where: { id: activationRecord.client_id }, transaction }
        );
        await ClientActivationToken.update(
          { consumed_at: now },
          {
            where: { client_id: activationRecord.client_id, consumed_at: null },
            transaction,
          }
        );
      });

      const client = await Client.findByPk(activationRecord.client_id, {
        attributes: { exclude: ["mot_de_passe"] },
        include: [
          { association: "pays", attributes: ["id", "name"] },
          { association: "ville", attributes: ["id", "name"] },
        ],
      });

      if (client?.email) {
        try {
          const tpl = renderWelcomeClient({ client });
          const from = process.env.SMTP_FROM || process.env.SMTP_USER;
          if (from) {
            sendMail({
              to: client.email,
              subject: tpl.subject,
              html: tpl.html,
              text: tpl.text,
              from,
              template: "CLIENT_WELCOME",
            }).catch(() => {});
          }
        } catch (mailErr) {
          console.error("Welcome email error:", mailErr?.message || mailErr);
        }
      }

      return res.status(200).json({
        message: "Compte activé avec succés.",
        client,
      });
    } catch (error) {
      console.error(error);
      return res
        .status(500)
        .json({ message: "Erreur lors de l'activation du compte." });
    }
  },
  // --- CONTROLLER --- // controllers/client.controller.js

  updateProfile: async (req, res) => {
    try {
      const clientId = req.user.id; // Auth middleware needed
      const {
        nom,
        prenom,
        pseudo,
        date_naissance,
        pays_id,
        ville_id,
        description,
        attirance,
        telephone,
      } = req.body;
      console.log(req.user);
      const photo_profil = req.files?.photo_profil?.[0]?.filename;

      const client = await Client.findByPk(clientId);
      if (!client) {
        return res.status(404).json({ message: "Client introuvable." });
      }

      const updates = {
        nom,
        prenom,
        date_naissance,
        pays_id,
        ville_id,
        description,
        telephone,
        ...(photo_profil && { photo_profil }),
      };

      if (typeof pseudo !== "undefined") {
        const normalizedPseudoUpdate =
          typeof pseudo === "string" ? pseudo.trim() : null;
        if (normalizedPseudoUpdate) {
          const existingPseudoClient = await Client.findOne({
            where: {
              pseudo: normalizedPseudoUpdate,
              id: { [Op.ne]: clientId },
            },
          });
          if (existingPseudoClient) {
            return res.status(400).json({ message: "Pseudo deja utilisé." });
          }
        }
        updates.pseudo =
          normalizedPseudoUpdate && normalizedPseudoUpdate.length > 0
            ? normalizedPseudoUpdate
            : null;
      }

      if (typeof attirance !== "undefined") {
        const allowed = ["femme", "homme", "tous"];
        if (!allowed.includes(attirance)) {
          return res
            .status(400)
            .json({ message: "Valeur d'attirance invalide." });
        }
        updates.attirance = attirance;
      }

      await client.update(updates);

      const updatedClient = await Client.findByPk(client.id, {
        attributes: { exclude: ["mot_de_passe"] },
        include: [
          { association: "pays", attributes: ["id", "name"] },
          { association: "ville", attributes: ["id", "name"] },
        ],
      });

      return res.json({ client: updatedClient });
    } catch (error) {
      console.error(error);
      return res
        .status(500)
        .json({ message: "Erreur lors de la mise à jour." });
    }
  },
};
