const { Favorite } = require("../../models");

exports.toggleFavorite = async (req, res) => {
  const { girl_id } = req.params;
  const client_id = req.user.id;

  try {
    const existing = await Favorite.findOne({ where: { girl_id, client_id } });

    if (existing) {
      await existing.destroy();
      return res.json({ liked: false });
    } else {
      await Favorite.create({ girl_id, client_id });
      return res.json({ liked: true });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur lors du like." });
  }
};

exports.getFavorites = async (req, res) => {
  try {
    const favorites = await Favorite.findAll({
      where: { client_id: req.user.id },
      attributes: ["girl_id"],
    });
    const likedGirlIds = favorites.map((f) => f.girl_id);
    res.json(likedGirlIds);
  } catch (err) {
    res.status(500).json({ message: "Erreur lors de la récupération." });
  }
};
