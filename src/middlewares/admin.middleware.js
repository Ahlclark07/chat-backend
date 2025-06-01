const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET;

// 🔐 Authentifie un token admin
function authenticateAdminJWT(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Token manquant ou invalide." });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    if (decoded.type !== "admin") {
      return res.status(403).json({ message: "Accès réservé aux admins." });
    }

    req.admin = decoded; // { id, role, type: 'admin' }
    next();
  } catch (err) {
    return res.status(403).json({ message: "Token invalide ou expiré." });
  }
}

// 🛡 Autorise uniquement certains rôles
function authorizeRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.admin.role)) {
      return res.status(403).json({ message: "Rôle non autorisé." });
    }
    next();
  };
}

module.exports = {
  authenticateAdminJWT,
  authorizeRole,
};
