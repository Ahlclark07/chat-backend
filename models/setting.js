"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Setting extends Model {
    static associate(models) {}
  }

  Setting.init(
    {
      key: { type: DataTypes.STRING, allowNull: false, unique: true },
      value: { type: DataTypes.STRING, allowNull: false },
    },
    { sequelize, modelName: "Setting" }
  );

  return Setting;
};

