"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class AdminGirl extends Model {
    static associate(models) {
      AdminGirl.belongsTo(models.Admin, {
        foreignKey: "admin_id",
        as: "admin",
      });
      AdminGirl.belongsTo(models.Girl, { foreignKey: "girl_id", as: "girl" });
    }
  }

  AdminGirl.init(
    {
      admin_id: DataTypes.INTEGER,
      girl_id: DataTypes.INTEGER,
    },
    {
      sequelize,
      modelName: "AdminGirl",
    }
  );

  return AdminGirl;
};
