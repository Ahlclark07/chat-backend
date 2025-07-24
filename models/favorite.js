module.exports = (sequelize, DataTypes) => {
  const Favorite = sequelize.define("Favorite", {
    client_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    girl_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  });

  Favorite.associate = (models) => {
    Favorite.belongsTo(models.Client, { foreignKey: "client_id" });
    Favorite.belongsTo(models.Girl, { foreignKey: "girl_id" });
  };

  return Favorite;
};
