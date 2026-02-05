const { ClientBlock, Client, Girl, City, Country } = require("../../models");

module.exports = {
  async list(req, res) {
    try {
      const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
      const limit = Math.max(parseInt(req.query.limit, 10) || 10, 1);
      const offset = (page - 1) * limit;

      const { rows, count } = await ClientBlock.findAndCountAll({
        include: [
          {
            model: Client,
            as: "client",
            attributes: ["id", "nom", "prenom", "email", "pseudo"],
          },
          {
            model: Girl,
            as: "girl",
            attributes: ["id", "nom", "prenom", "pseudo", "sexe", "photo_profil"],
            include: [
              { model: City, as: "ville", attributes: ["id", "name"] },
              { model: Country, as: "pays", attributes: ["id", "name"] },
            ],
          },
        ],
        order: [["createdAt", "DESC"]],
        limit,
        offset,
      });

      return res.json({
        total: count,
        page,
        pageSize: limit,
        totalPages: Math.ceil(count / limit),
        data: rows,
      });
    } catch (err) {
      console.error(err);
      return res
        .status(500)
        .json({ message: "Erreur lors du chargement des blocages." });
    }
  },

  async remove(req, res) {
    try {
      const { id } = req.params;
      const block = await ClientBlock.findByPk(id);
      if (!block) {
        return res.status(404).json({ message: "Blocage introuvable." });
      }
      await block.destroy();
      return res.status(204).send();
    } catch (err) {
      console.error(err);
      return res
        .status(500)
        .json({ message: "Erreur lors de la suppression du blocage." });
    }
  },
};
