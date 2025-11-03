const {
  Client,
  Girl,
  City,
  Country,
  GirlPhoto,
  Favorite,
  HomepageGirl,
} = require("../../models");
const { Op } = require("sequelize");
module.exports = {
  listGirls: async (req, res) => {
    try {
      const page = parseInt(req.query.page, 10) || 1;
      const limit = 20;
      const offset = (page - 1) * limit;

      const homepageSelection = await HomepageGirl.findAll({
        order: [
          ["position", "ASC"],
          ["createdAt", "ASC"],
        ],
      });

      if (homepageSelection.length > 0) {
        const total = homepageSelection.length;
        const selectedSlice = homepageSelection.slice(offset, offset + limit);
        const selectedIds = selectedSlice.map((row) => row.girl_id);

        const totalPages = Math.ceil(total / limit);

        if (selectedIds.length === 0) {
          return res.json({
            data: [],
            total,
            page,
            totalPages,
          });
        }

        const girls = await Girl.findAll({
          where: { id: selectedIds },
          include: [
            { model: City, as: "ville", attributes: ["id", "name"] },
            { model: Country, as: "pays", attributes: ["id", "name"] },
          ],
        });

        const girlsById = new Map(girls.map((g) => [g.id, g]));
        const orderedGirls = selectedIds
          .map((id) => girlsById.get(id))
          .filter(Boolean);

        return res.json({
          data: orderedGirls,
          total,
          page,
          totalPages,
        });
      }

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
    const { age_min, age_max, pays_id, ville_id, sexe } = req.query;

    const where = {};

    if (typeof age_min !== "undefined" || typeof age_max !== "undefined") {
      const min = age_min !== undefined ? parseInt(age_min, 10) : undefined;
      const max = age_max !== undefined ? parseInt(age_max, 10) : undefined;

      if (
        (min !== undefined && (!Number.isFinite(min) || min < 0)) ||
        (max !== undefined && (!Number.isFinite(max) || max < 0))
      ) {
        return res
          .status(400)
          .json({ message: "age_min et age_max doivent être positifs." });
      }

      if (min !== undefined && max !== undefined && min > max) {
        return res
          .status(400)
          .json({ message: "age_min ne peut pas être supérieur à age_max." });
      }

      const now = new Date();
      let earliestDob = null;
      let latestDob = null;

      if (max !== undefined) {
        earliestDob = new Date(now);
        earliestDob.setFullYear(earliestDob.getFullYear() - max);
      }

      if (min !== undefined) {
        latestDob = new Date(now);
        latestDob.setFullYear(latestDob.getFullYear() - min);
      }

      if (earliestDob && latestDob) {
        where.date_naissance = { [Op.between]: [earliestDob, latestDob] };
      } else if (earliestDob) {
        where.date_naissance = { [Op.gte]: earliestDob };
      } else if (latestDob) {
        where.date_naissance = { [Op.lte]: latestDob };
      }
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
