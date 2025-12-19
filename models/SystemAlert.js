"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class SystemAlert extends Model {
    static associate(models) {
      SystemAlert.belongsTo(models.Admin, {
        foreignKey: "admin_id",
        as: "admin",
      });
    }
  }

  SystemAlert.init(
    {
      type: {
        type: DataTypes.ENUM("MULTIPLE_CONNECTIONS", "SUSPICIOUS_CONTENT"),
        allowNull: false,
      },
      severity: {
        type: DataTypes.ENUM("LOW", "MEDIUM", "HIGH", "CRITICAL"),
        defaultValue: "MEDIUM",
      },
      status: {
        type: DataTypes.ENUM("OPEN", "RESOLVED", "IGNORED"),
        defaultValue: "OPEN",
      },
      admin_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      details: {
        type: DataTypes.JSON, // Stores IP, message content, etc.
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "SystemAlert",
    }
  );

  return SystemAlert;
};
