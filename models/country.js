"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Country extends Model {
    static associate(models) {
      Country.hasMany(models.City, { foreignKey: "country_id", as: "cities" });
    }
  }

  Country.init(
    {
      name: DataTypes.STRING,
      code: DataTypes.STRING(2),
    },
    {
      sequelize,
      modelName: "Country",
    }
  );

  return Country;
};
