"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class AdminLoginHistory extends Model {
    static associate(models) {
      AdminLoginHistory.belongsTo(models.Admin, {
        foreignKey: "admin_id",
        as: "admin",
      });
    }
  }

  AdminLoginHistory.init(
    {
      admin_id: DataTypes.INTEGER,
      ip_address: DataTypes.STRING,
      user_agent: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: "AdminLoginHistory",
    }
  );

  return AdminLoginHistory;
};
