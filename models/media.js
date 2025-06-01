"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Media extends Model {
    static associate(models) {
      // Pas d'association directe car owner_type est dynamique (client, girl, etc.)
    }
  }

  Media.init(
    {
      owner_type: DataTypes.ENUM("client", "girl", "admin", "message"),
      owner_id: DataTypes.INTEGER,
      url: DataTypes.STRING,
      type: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: "Media",
    }
  );

  return Media;
};
