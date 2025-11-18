const jwt = require("jsonwebtoken");
const { Admin } = require("../../models");
const {
  extractRequestDeviceIdentity,
} = require("../utils/deviceFingerprint");
const { logAdminAuth } = require("../utils/adminAuthLogger");
const JWT_SECRET = process.env.JWT_SECRET;
const DEFAULT_SESSION_IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const ADMIN_SESSION_IDLE_TIMEOUT_MS =
  parseInt(
    process.env.ADMIN_SESSION_IDLE_TIMEOUT_MS ||
      `${DEFAULT_SESSION_IDLE_TIMEOUT_MS}`,
    10
  ) || DEFAULT_SESSION_IDLE_TIMEOUT_MS;
const ADMIN_SESSION_TOUCH_INTERVAL_MS =
  parseInt(process.env.ADMIN_SESSION_TOUCH_INTERVAL_MS || "60000", 10) || 60000;

async function authenticateAdminJWT(req, res, next) {
  const { ip, userAgent, fingerprint } = extractRequestDeviceIdentity(req);
  const requestContext = {
    path: req.originalUrl,
    method: req.method,
  };
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    logAdminAuth("MIDDLEWARE_AUTH_HEADER_MISSING", {
      ...requestContext,
      ip,
      userAgent,
    });
    return res.status(401).json({ message: "Token manquant ou invalide." });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.type !== "admin" || !decoded.sessionId) {
      logAdminAuth("MIDDLEWARE_INVALID_TOKEN_PAYLOAD", {
        ...requestContext,
        reason: "WRONG_TYPE_OR_SESSION",
      });
      return res.status(403).json({ message: "Acces reserve aux admins." });
    }

    const admin = await Admin.findByPk(decoded.id);
    logAdminAuth("MIDDLEWARE_SESSION_CHECK_START", {
      ...requestContext,
      adminId: decoded.id,
      sessionId: decoded.sessionId,
      ip,
      userAgent,
      fingerprint,
    });

    if (!admin) {
      logAdminAuth("MIDDLEWARE_ADMIN_NOT_FOUND", {
        ...requestContext,
        adminId: decoded.id,
      });
      return res
        .status(401)
        .json({ message: "Session admin invalide ou expiree." });
    }
    if (
      !admin.current_session_token ||
      admin.current_session_token !== decoded.sessionId
    ) {
      const sameDevice =
        fingerprint &&
        admin.current_session_device_hash &&
        fingerprint === admin.current_session_device_hash;

      if (sameDevice) {
        const now = new Date();
        admin.current_session_token = decoded.sessionId;
        admin.current_session_started_at = now;
        await admin.update({
          current_session_token: decoded.sessionId,
          current_session_started_at: now,
        });
        logAdminAuth("MIDDLEWARE_SESSION_REBOUND", {
          ...requestContext,
          adminId: admin.id,
          sessionId: decoded.sessionId,
        });
      } else {
        logAdminAuth("MIDDLEWARE_SESSION_TOKEN_MISMATCH", {
          ...requestContext,
          adminId: admin.id,
          storedSessionId: admin.current_session_token,
          providedSessionId: decoded.sessionId,
          fingerprintMatch: false,
        });
        return res
          .status(401)
          .json({ message: "Session admin invalide ou expiree." });
      }
    }

    const now = new Date();
    const lastSeen = admin.current_session_started_at
      ? new Date(admin.current_session_started_at)
      : null;

    if (!lastSeen) {
      logAdminAuth("MIDDLEWARE_SESSION_NO_LAST_SEEN", {
        ...requestContext,
        adminId: admin.id,
      });
      await admin.update({
        current_session_token: null,
        current_session_started_at: null,
        current_session_device_hash: null,
      });
      return res
        .status(401)
        .json({ message: "Session admin invalide ou expiree." });
    }

    if (now.getTime() - lastSeen.getTime() >= ADMIN_SESSION_IDLE_TIMEOUT_MS) {
      logAdminAuth("MIDDLEWARE_SESSION_IDLE_TIMEOUT", {
        ...requestContext,
        adminId: admin.id,
        lastSeen: lastSeen.toISOString(),
      });
      await admin.update({
        current_session_token: null,
        current_session_started_at: null,
        current_session_device_hash: null,
      });
      return res
        .status(401)
        .json({ message: "Session admin invalide ou expiree." });
    }

    if (now.getTime() - lastSeen.getTime() >= ADMIN_SESSION_TOUCH_INTERVAL_MS) {
      admin.current_session_started_at = now;
      await admin.update({
        current_session_started_at: now,
      });
      logAdminAuth("MIDDLEWARE_SESSION_TOUCHED", {
        ...requestContext,
        adminId: admin.id,
        sessionId: admin.current_session_token,
      });
    }

    req.admin = decoded;
    req.adminEntity = admin;
    logAdminAuth("MIDDLEWARE_SESSION_VALID", {
      ...requestContext,
      adminId: admin.id,
      sessionId: admin.current_session_token,
    });
    return next();
  } catch (err) {
    logAdminAuth("MIDDLEWARE_TOKEN_ERROR", {
      ...requestContext,
      error: err.message,
    });
    return res.status(403).json({ message: "Token invalide ou expire." });
  }
}

function authorizeRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.admin.role)) {
      return res.status(403).json({ message: "Role non autorise." });
    }
    return next();
  };
}

module.exports = {
  authenticateAdminJWT,
  authorizeRole,
};
