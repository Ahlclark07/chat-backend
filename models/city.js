"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class City extends Model {
    static associate(models) {
      City.belongsTo(models.Country, {
        foreignKey: "country_id",
        as: "country",
      });
    }
  }

  City.init(
    {
      name: DataTypes.STRING,
      country_id: DataTypes.INTEGER,
    },
    {
      sequelize,
      modelName: "City",
    }
  );

  return City;
};
