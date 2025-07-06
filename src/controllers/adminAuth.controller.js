const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { Admin } = require("../../models");

const JWT_SECRET = process.env.JWT_SECRET;

module.exports = {
  // POST /admin/login
  login: async (req, res) => {
    try {
      const { email, mot_de_passe } = req.body;

      const admin = await Admin.findOne({ where: { email } });
      if (!admin) {
        return res
          .status(400)
          .json({ message: "Email ou mot de passe incorrect." });
      }

      const isValid = await bcrypt.compare(mot_de_passe, admin.mot_de_passe);
      if (!isValid) {
        return res
          .status(400)
          .json({ message: "Email ou mot de passe incorrect." });
      }

      const accessToken = jwt.sign(
        { id: admin.id, role: admin.role, type: "admin" },
        JWT_SECRET,
        { expiresIn: "1d" }
      );

      return res.status(200).json({ accessToken, admin });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Erreur lors de la connexion." });
    }
  },
};
