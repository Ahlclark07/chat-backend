"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class ForbiddenWord extends Model {
    static associate(models) {
      // optional: ForbiddenWord.belongsTo(models.Admin, { foreignKey: "created_by" });
    }
  }

  ForbiddenWord.init(
    {
      word: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      created_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "ForbiddenWord",
    }
  );

  return ForbiddenWord;
};

