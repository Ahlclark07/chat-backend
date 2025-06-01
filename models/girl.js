"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Girl extends Model {
    static associate(models) {
      Girl.belongsToMany(models.Admin, {
        through: "AdminGirl",
        foreignKey: "girl_id",
        as: "admins",
      });

      Girl.belongsTo(models.Country, { foreignKey: "pays_id", as: "pays" });
      Girl.belongsTo(models.City, { foreignKey: "ville_id", as: "ville" });
      Girl.hasMany(models.Conversation, {
        foreignKey: "girl_id",
        as: "conversations",
      });
      Girl.hasMany(models.GirlPhoto, { foreignKey: "girl_id", as: "photos" });
    }
  }

  Girl.init(
    {
      nom: DataTypes.STRING,
      prenom: DataTypes.STRING,
      date_naissance: DataTypes.DATEONLY,
      photo_profil: DataTypes.STRING,
      description: DataTypes.TEXT,
      pays_id: DataTypes.INTEGER,
      ville_id: DataTypes.INTEGER,
      telephone: DataTypes.STRING,
      is_banned: DataTypes.BOOLEAN,
      ban_reason: DataTypes.STRING,
      ban_expires_at: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: "Girl",
    }
  );

  return Girl;
};
