"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Girl extends Model {
    static associate(models) {
      Girl.belongsTo(models.Admin, {
        foreignKey: "created_by",
        as: "creator",
      });

      Girl.belongsTo(models.Admin, {
        foreignKey: "admin_id",
        as: "admin",
      });

      Girl.belongsTo(models.Country, { foreignKey: "pays_id", as: "pays" });
      Girl.belongsTo(models.City, { foreignKey: "ville_id", as: "ville" });

      Girl.hasMany(models.Conversation, {
        foreignKey: "girl_id",
        as: "conversations",
      });

      Girl.hasMany(models.GirlPhoto, {
        foreignKey: "girl_id",
        as: "photos",
      });
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
      created_by: DataTypes.INTEGER, // superadmin/god qui a créé
      admin_id: DataTypes.INTEGER, // admin responsable
      ban_expires_at: DataTypes.DATE,
      sexe: {
        type: DataTypes.ENUM("homme", "femme"),
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "Girl",
    }
  );

  return Girl;
};
