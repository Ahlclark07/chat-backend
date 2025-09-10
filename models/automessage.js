"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class AutoMessage extends Model {
    static associate(models) {
      AutoMessage.belongsTo(models.Admin, {
        foreignKey: "created_by",
        as: "creator",
      });
    }
  }

  AutoMessage.init(
    {
      content: { type: DataTypes.TEXT, allowNull: false },
      active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      created_by: { type: DataTypes.INTEGER, allowNull: true },
    },
    { sequelize, modelName: "AutoMessage" }
  );

  return AutoMessage;
};

