const jwt = require("jsonwebtoken");
const { Admin } = require("../../models");
const {
  parseAdminSessions,
  cleanupExpiredSessions,
  serializeAdminSessions,
  getLastSessionDate,
  DEFAULT_SESSION_MAX_AGE_MS,
} = require("../utils/adminSession.util");

const JWT_SECRET = process.env.JWT_SECRET;
const MAX_ADMIN_SESSION_MS = DEFAULT_SESSION_MAX_AGE_MS;

async function authenticateAdminJWT(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Token manquant ou invalide." });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    if (decoded.type !== "admin" || !decoded.sessionId) {
      return res.status(403).json({ message: "Acces reserve aux admins." });
    }

    const admin = await Admin.findByPk(decoded.id);
    if (!admin) {
      return res
        .status(401)
        .json({ message: "Session admin invalide ou expiree." });
    }

    const parsedSessions = parseAdminSessions(
      admin.current_session_token,
      admin.current_session_started_at
    );
    const { active: activeSessions, expired } = cleanupExpiredSessions(
      parsedSessions,
      MAX_ADMIN_SESSION_MS,
      new Date()
    );

    const sessionMatch = activeSessions.find(
      (session) => session.token === decoded.sessionId
    );

    const serializedActive = serializeAdminSessions(activeSessions);
    const latestActiveDate = getLastSessionDate(activeSessions);
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

    if (!sessionMatch) {
      return res
        .status(401)
        .json({ message: "Session admin invalide ou expiree." });
    }


    req.admin = decoded;
    req.adminEntity = admin;
    return next();
  } catch (err) {
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
