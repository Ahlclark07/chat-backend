const {
  Client,
  Girl,
  City,
  Country,
  GirlPhoto,
  Favorite,
} = require("../../models");
const { Op } = require("sequelize");
module.exports = {
  listGirls: async (req, res) => {
    try {
      const page = parseInt(req.query.page, 10) || 1;
      const limit = 20;
      const offset = (page - 1) * limit;

      const girls = await Girl.findAndCountAll({
        limit,
        offset,
        order: [["createdAt", "DESC"]],
        include: [
          { model: City, as: "ville", attributes: ["id", "name"] },
          { model: Country, as: "pays", attributes: ["id", "name"] },
        ],
      });

      return res.json({
        data: girls.rows,
        total: girls.count,
        page,
        totalPages: Math.ceil(girls.count / limit),
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Erreur lors du chargement des girls." });
    }
  },
  // GET /girls/:id
  getGirlById: async (req, res) => {
    try {
      const { id } = req.params;
      const girl = await Girl.findByPk(id, {
        include: [
          {
            model: GirlPhoto,
            as: "photos",
            attributes: ["id", "url"],
          },
          { model: City, as: "ville", attributes: ["id", "name"] },
          { model: Country, as: "pays", attributes: ["id", "name"] },
        ],
      });

      if (!girl) {
        return res.status(404).json({ message: "Profil introuvable" });
      }

      res.json(girl);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Erreur chargement profil" });
    }
  },
  toggleFavorite: async (req, res) => {
    try {
      const userId = req.user.id; // Assure-toi que l'auth fonctionne
      const girlId = parseInt(req.params.id);

      const existing = await Favorite.findOne({
        where: { client_id: userId, girl_id: girlId },
      });

      if (existing) {
        await existing.destroy();
        return res.json({ liked: false });
      } else {
        await Favorite.create({ client_id: userId, girl_id: girlId });
        return res.json({ liked: true });
      }
    } catch (error) {
      console.log(error);
    }
  },
  getLikedGirlIds: async (req, res) => {
    try {
      const userId = req.user.id;

      const favorites = await Favorite.findAll({
        where: { client_id: userId },
        attributes: ["girl_id"],
      });

      const likedIds = favorites.map((fav) => fav.girl_id);

      res.json(likedIds);
    } catch (error) {
      console.log(error);
    }
  },

  // PUT /me
  updateMe: async (req, res) => {
    try {
      const updates = req.body;
      const photoPath = req.file ? req.file.path : undefined;
      if (photoPath) updates.photo_profil = photoPath;

      const [updated] = await Client.update(updates, {
        where: { id: req.user.id },
      });

      if (!updated) {
        return res
          .status(404)
          .json({ message: "Client introuvable ou aucune modification." });
      }

      const client = await Client.findByPk(req.user.id, {
        attributes: { exclude: ["mot_de_passe"] },
      });

      return res.json(client);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Erreur serveur." });
    }
  },
  getFilteredGirls: async (req, res) => {
    const { age, pays_id, ville_id, sexe } = req.query;

    const where = {};

    if (age) {
      const birthDateLimit = new Date();
      birthDateLimit.setFullYear(birthDateLimit.getFullYear() - age);
      where.date_naissance = { [Op.lte]: birthDateLimit };
    }

    if (pays_id && pays_id !== "neant") where.pays_id = pays_id;
    if (ville_id) where.ville_id = ville_id;
    if (sexe) where.sexe = sexe;

    const girls = await Girl.findAll({
      where,
      include: [
        { model: City, as: "ville", attributes: ["id", "name"] },
        { model: Country, as: "pays", attributes: ["id", "name"] },
      ],
      order: [["createdAt", "DESC"]],
    });

    res.json(girls);
  },
};
