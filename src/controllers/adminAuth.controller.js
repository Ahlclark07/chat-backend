const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { Admin, AdminActivityLog } = require("../../models");

const JWT_SECRET = process.env.JWT_SECRET;

module.exports = {
  // POST /admin/login
  login: async (req, res) => {
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

      const ip =
        req.headers["x-forwarded-for"]?.split(",")[0] || // si derrière un proxy
        req.socket?.remoteAddress || // Express 4+
        null;

      const userAgent = req.headers["user-agent"];
      const isValid = await bcrypt.compare(mot_de_passe, admin.mot_de_passe);
      if (!isValid) {
        await AdminActivityLog.create({
          adminId: admin.id,
          action: "LOGIN_FAILED",
          targetType: "Admin",
          targetId: admin.id,
          details: `IP: ${ip},
          device: ${userAgent}`,
        });
        return res
          .status(400)
          .json({ message: "Email ou mot de passe incorrect." });
      }

      const accessToken = jwt.sign(
        { id: admin.id, role: admin.role, type: "admin" },
        JWT_SECRET,
        { expiresIn: "1d" }
      );

      await AdminActivityLog.create({
        adminId: admin.id,
        action: "LOGIN_SUCCESS",
        targetType: "Admin",
        targetId: admin.id,
        details: `IP: ${ip},
          device: ${userAgent}`,
      });
      return res.status(200).json({ accessToken, admin });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Erreur lors de la connexion." });
    }
  },
};
