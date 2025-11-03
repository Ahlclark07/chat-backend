"use strict";

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const { Admin, AdminActivityLog } = require("../../models");
const {
  parseAdminSessions,
  serializeAdminSessions,
  cleanupExpiredSessions,
  addSession,
  removeSession,
  getLastSessionDate,
  DEFAULT_SESSION_MAX_AGE_MS,
} = require("../utils/adminSession.util");
const {
  getAdminActiveSocketCount,
} = require("../sockets/messages-dispatcher");

const JWT_SECRET = process.env.JWT_SECRET;
const MAX_ADMIN_SESSION_MS = DEFAULT_SESSION_MAX_AGE_MS;
const MAX_CONCURRENT_ADMIN_SESSIONS = Math.max(
  1,
  parseInt(process.env.MAX_CONCURRENT_ADMIN_SESSIONS || "2", 10) || 2
);

const buildActivityDetails = (req) => {
  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0] ||
    req.socket?.remoteAddress ||
    null;
  const userAgent = req.headers["user-agent"] || "unknown";
  return { ip, userAgent };
};

module.exports = {
  async login(req, res) {
    try {
      const { email, mot_de_passe } = req.body;
      let admin = null;

      if (email.includes("@")) {
        admin = await Admin.findOne({ where: { email } });
      } else {
        admin = await Admin.findOne({ where: { identifiant: email } });
      }

      if (!admin) {
        return res
          .status(400)
          .json({ message: "Email ou mot de passe incorrect." });
      }

      const { ip, userAgent } = buildActivityDetails(req);

      const isValid = await bcrypt.compare(mot_de_passe, admin.mot_de_passe);
      if (!isValid) {
        await AdminActivityLog.create({
          adminId: admin.id,
          action: "LOGIN_FAILED",
          targetType: "Admin",
          targetId: admin.id,
          details: `IP: ${ip}, device: ${userAgent}`,
        });
        return res
          .status(400)
          .json({ message: "Email ou mot de passe incorrect." });
      }

      const now = new Date();
      const parsedSessions = parseAdminSessions(
        admin.current_session_token,
        admin.current_session_started_at
      );
      let { active: activeSessions, expired } = cleanupExpiredSessions(
        parsedSessions,
        MAX_ADMIN_SESSION_MS,
        now
      );

      let serializedActive = serializeAdminSessions(activeSessions);
      let latestActiveDate = getLastSessionDate(activeSessions);

      const storedSessionDate = admin.current_session_started_at
        ? new Date(admin.current_session_started_at)
        : null;
      const needsDateUpdate = (() => {
        if (latestActiveDate && !storedSessionDate) {
          return true;
        }
        if (!latestActiveDate && storedSessionDate) {
          return true;
        }
        if (latestActiveDate && storedSessionDate) {
          return latestActiveDate.getTime() !== storedSessionDate.getTime();
        }
        return false;
      })();

      if (
        expired.length > 0 ||
        serializedActive !== admin.current_session_token ||
        needsDateUpdate
      ) {
        await admin.update({
          current_session_token: serializedActive,
          current_session_started_at: latestActiveDate,
        });
        admin.current_session_token = serializedActive;
        admin.current_session_started_at = latestActiveDate;
      }

      const activeSocketCount = getAdminActiveSocketCount(admin.id);
      if (activeSocketCount === 0 && activeSessions.length > 0) {
        activeSessions = [];
        serializedActive = null;
        latestActiveDate = null;

        await admin.update({
          current_session_token: null,
          current_session_started_at: null,
        });
        admin.current_session_token = null;
        admin.current_session_started_at = null;
      }

      const allowedExistingSessions = Math.max(
        0,
        MAX_CONCURRENT_ADMIN_SESSIONS - 1
      );
      if (activeSessions.length > allowedExistingSessions) {
        const sortedByOldest = [...activeSessions].sort((a, b) => {
          const aDate = new Date(a.startedAt || a.started_at || 0).getTime();
          const bDate = new Date(b.startedAt || b.started_at || 0).getTime();
          return aDate - bDate;
        });
        const sessionsToRemove = sortedByOldest
          .slice(0, activeSessions.length - allowedExistingSessions)
          .map((session) => session.token);

        if (sessionsToRemove.length > 0) {
          activeSessions = activeSessions.filter(
            (session) => !sessionsToRemove.includes(session.token)
          );

          serializedActive = serializeAdminSessions(activeSessions);
          latestActiveDate = getLastSessionDate(activeSessions);

          await admin.update({
            current_session_token: serializedActive,
            current_session_started_at: latestActiveDate,
          });
          admin.current_session_token = serializedActive;
          admin.current_session_started_at = latestActiveDate;

          await Promise.all(
            sessionsToRemove.map((token) =>
              AdminActivityLog.create({
                adminId: admin.id,
                action: "LOGIN_SESSION_TERMINATED",
                targetType: "Admin",
                targetId: admin.id,
                details: `Session forcee a expirer (token=${token}) pour liberer un slot. Nouvel IP: ${ip}, device: ${userAgent}`,
              }).catch(() => {})
            )
          );
        }
      }

      const sessionId = uuidv4();
      const updatedSessions = addSession(activeSessions, sessionId, now);
      const serializedSessions = serializeAdminSessions(updatedSessions);

      await admin.update({
        current_session_token: serializedSessions,
        current_session_started_at: now,
      });
      admin.current_session_token = serializedSessions;
      admin.current_session_started_at = now;

      const accessToken = jwt.sign(
        {
          id: admin.id,
          role: admin.role,
          type: "admin",
          sessionId,
        },
        JWT_SECRET,
        { expiresIn: "1d" }
      );

      await AdminActivityLog.create({
        adminId: admin.id,
        action: "LOGIN_SUCCESS",
        targetType: "Admin",
        targetId: admin.id,
        details: `IP: ${ip}, device: ${userAgent}`,
      });

      return res.status(200).json({ accessToken, admin });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Erreur lors de la connexion." });
    }
  },

  async logout(req, res) {
    try {
      const admin = req.adminEntity;
      const sessionId = req.admin?.sessionId || null;

      if (admin) {
        const parsedSessions = parseAdminSessions(
          admin.current_session_token,
          admin.current_session_started_at
        );
        const { active: activeSessions } = cleanupExpiredSessions(
          parsedSessions,
          MAX_ADMIN_SESSION_MS,
          new Date()
        );
        const remainingSessions = removeSession(activeSessions, sessionId);
        const serialized = serializeAdminSessions(remainingSessions);
        const latest = getLastSessionDate(remainingSessions);

        await admin.update({
          current_session_token: serialized,
          current_session_started_at: latest,
        });
        admin.current_session_token = serialized;
        admin.current_session_started_at = latest;
      }

      await AdminActivityLog.create({
        adminId: req.admin.id,
        action: "LOGOUT",
        targetType: "Admin",
        targetId: req.admin.id,
        details: "Session terminee par l'utilisateur.",
      }).catch(() => {});

      return res.status(200).json({ message: "Deconnexion reussie." });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Erreur lors de la deconnexion." });
    }
  },
};
