"use strict";

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const { Admin, AdminActivityLog } = require("../../models");
const { extractRequestDeviceIdentity } = require("../utils/deviceFingerprint");
const { logAdminAuth } = require("../utils/adminAuthLogger");
const JWT_SECRET = process.env.JWT_SECRET;

module.exports = {
  async login(req, res) {
    try {
      const {
        email,
        mot_de_passe,
        session_id: previousSessionId,
        sessionId: camelSessionId,
      } = req.body;
      const providedSessionId =
        previousSessionId || camelSessionId || req.body?.session;
      const normalizedSessionId = providedSessionId
        ? String(providedSessionId).trim()
        : null;
      const {
        ip,
        userAgent,
        fingerprint: deviceFingerprint,
      } = extractRequestDeviceIdentity(req);

      let admin = null;

      if (email.includes("@")) {
        admin = await Admin.findOne({ where: { email } });
      } else {
        admin = await Admin.findOne({ where: { identifiant: email } });
      }

      logAdminAuth("LOGIN_ATTEMPT", {
        email,
        adminId: admin?.id || null,
        providedSessionId: normalizedSessionId,
        ip,
        userAgent,
        fingerprint: deviceFingerprint,
      });

      if (!admin) {
        logAdminAuth("LOGIN_FAILED_UNKNOWN_ADMIN", {
          email,
          providedSessionId: normalizedSessionId,
          ip,
          userAgent,
        });
        return res
          .status(400)
          .json({ message: "Email ou mot de passe incorrect." });
      }

      const isValid = await bcrypt.compare(mot_de_passe, admin.mot_de_passe);
      if (!isValid) {
        logAdminAuth("LOGIN_FAILED_INVALID_PASSWORD", {
          email,
          adminId: admin.id,
          ip,
          userAgent,
        });
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
      const existingSessionId = admin.current_session_token || null;
      const sessionStillActive = !!existingSessionId;

      const fingerprintMatches =
        sessionStillActive &&
        admin.current_session_device_hash &&
        deviceFingerprint &&
        admin.current_session_device_hash === deviceFingerprint;

      const providedSessionMatches =
        sessionStillActive &&
        normalizedSessionId &&
        existingSessionId === normalizedSessionId;

      const isSameSession =
        sessionStillActive && (providedSessionMatches || fingerprintMatches);

      if (sessionStillActive && !isSameSession) {
        logAdminAuth("LOGIN_CONFLICT_SESSION_NOTIFIED", {
          email,
          adminId: admin.id,
          existingSessionId,
          providedSessionId: normalizedSessionId,
          ip,
          userAgent,
        });

        const {
          checkRepeatedLoginConflicts,
        } = require("../services/alert.service");
        checkRepeatedLoginConflicts(admin.id).catch((err) =>
          console.error("Error checking conflicts:", err)
        );

        // Notifier l'ancienne session via socket
        const io = req.app.get("io");
        if (io) {
          const {
            notifyAdminSessionConflict,
          } = require("../sockets/messages-dispatcher");
          notifyAdminSessionConflict(io, admin.id, {
            ip,
            userAgent,
            time: new Date().toISOString(),
          });
        }

        return res.status(423).json({
          message:
            "Une session est deja active sur ce compte. L'admin connecte doit confirmer la nouvelle connexion.",
          reason: "session_conflict",
        });
      }

      const sessionId =
        isSameSession && existingSessionId ? existingSessionId : uuidv4();
      const matchSource = !isSameSession
        ? "new_session"
        : providedSessionMatches
        ? "session_token"
        : fingerprintMatches
        ? "fingerprint"
        : "unknown";

      await admin.update({
        current_session_token: sessionId,
        current_session_started_at: now,
        current_session_device_hash: deviceFingerprint,
      });
      admin.current_session_token = sessionId;
      admin.current_session_started_at = now;
      admin.current_session_device_hash = deviceFingerprint;

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

      logAdminAuth(
        isSameSession ? "LOGIN_SESSION_REFRESH" : "LOGIN_NEW_SESSION",
        {
          email,
          adminId: admin.id,
          sessionId,
          existingSessionId,
          providedSessionId: normalizedSessionId,
          matchSource,
          ip,
          userAgent,
          fingerprint: deviceFingerprint,
        }
      );
      await AdminActivityLog.create({
        adminId: admin.id,
        action: isSameSession ? "LOGIN_REFRESH" : "LOGIN_SUCCESS",
        targetType: "Admin",
        targetId: admin.id,
        details: `IP: ${ip}, device: ${userAgent}`,
      });

      return res.status(200).json({ accessToken, admin });
    } catch (err) {
      console.error(err);
      logAdminAuth("LOGIN_ERROR", { error: err.message });
      return res.status(500).json({ message: "Erreur lors de la connexion." });
    }
  },

  async logout(req, res) {
    try {
      const admin = req.adminEntity;
      const sessionId = req.admin?.sessionId || null;
      const { ip, userAgent, fingerprint } = extractRequestDeviceIdentity(req);

      logAdminAuth("LOGOUT_ATTEMPT", {
        adminId: req.admin?.id || admin?.id || null,
        sessionId,
        ip,
        userAgent,
        fingerprint,
      });

      if (
        admin &&
        admin.current_session_token &&
        admin.current_session_token === sessionId
      ) {
        await admin.update({
          current_session_token: null,
          current_session_started_at: null,
          current_session_device_hash: null,
        });
        admin.current_session_token = null;
        admin.current_session_started_at = null;
        admin.current_session_device_hash = null;
        logAdminAuth("LOGOUT_SESSION_CLEARED", {
          adminId: admin.id,
          sessionId,
        });
      } else {
        logAdminAuth("LOGOUT_NO_MATCHING_SESSION", {
          adminId: admin?.id || null,
          providedSessionId: sessionId,
        });
      }

      await AdminActivityLog.create({
        adminId: req.admin.id,
        action: "LOGOUT",
        targetType: "Admin",
        targetId: req.admin.id,
        details: "Session terminee par l'utilisateur.",
      }).catch(() => {});

      logAdminAuth("LOGOUT_SUCCESS", {
        adminId: req.admin?.id || admin?.id || null,
        sessionId,
        ip,
        userAgent,
      });

      return res.status(200).json({ message: "Deconnexion reussie." });
    } catch (err) {
      console.error(err);
      logAdminAuth("LOGOUT_ERROR", { error: err.message });
      return res
        .status(500)
        .json({ message: "Erreur lors de la deconnexion." });
    }
  },

  async heartbeat(req, res) {
    return res.status(200).json({ ok: true });
  },
};
