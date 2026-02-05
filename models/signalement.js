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
      Signalement.belongsTo(models.Client, {
        foreignKey: "client_id",
        as: "client",
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      });
      Signalement.belongsTo(models.Girl, {
        foreignKey: "girl_id",
        as: "girl",
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      });
      Signalement.belongsTo(models.Conversation, {
        foreignKey: "conversation_id",
        as: "conversation",
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      });
    }
  }

  Signalement.init(
    {
      admin_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      client_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      girl_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      type: {
        type: DataTypes.STRING,
        allowNull: true,
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
      conversation_id: {
        type: DataTypes.INTEGER,
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
