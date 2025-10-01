"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Signalement extends Model {
    static associate(models) {
      Signalement.belongsTo(models.Admin, {
        foreignKey: "admin_id",
        as: "auteur",
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      });
    }
  }

  Signalement.init(
    {
      admin_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM("en_cours", "termine"),
        allowNull: false,
        defaultValue: "en_cours",
      },
      resolved_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "Signalement",
      tableName: "Signalements",
    }
  );

  return Signalement;
};
