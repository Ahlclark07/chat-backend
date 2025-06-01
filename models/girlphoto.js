"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class GirlPhoto extends Model {
    static associate(models) {
      GirlPhoto.belongsTo(models.Girl, { foreignKey: "girl_id", as: "girl" });
    }
  }

  GirlPhoto.init(
    {
      girl_id: DataTypes.INTEGER,
      url: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: "GirlPhoto",
    }
  );

  return GirlPhoto;
};
