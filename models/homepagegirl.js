"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class HomepageGirl extends Model {
    static associate(models) {
      HomepageGirl.belongsTo(models.Girl, {
        foreignKey: "girl_id",
        as: "girl",
      });
      HomepageGirl.belongsTo(models.Admin, {
        foreignKey: "added_by",
        as: "addedBy",
      });
    }
  }

  HomepageGirl.init(
    {
      girl_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      added_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      position: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
    },
    {
      sequelize,
      modelName: "HomepageGirl",
    }
  );

  return HomepageGirl;
};
