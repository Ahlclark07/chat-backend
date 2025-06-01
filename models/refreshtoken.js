"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class RefreshToken extends Model {
    static associate(models) {
      RefreshToken.belongsTo(models.Client, {
        foreignKey: "client_id",
        as: "client",
      });
    }
  }

  RefreshToken.init(
    {
      client_id: DataTypes.INTEGER,
      token: DataTypes.STRING,
      ip_address: DataTypes.STRING,
      user_agent: DataTypes.STRING,
      expires_at: DataTypes.DATE,
      revoked: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
    },
    {
      sequelize,
      modelName: "RefreshToken",
    }
  );

  return RefreshToken;
};
