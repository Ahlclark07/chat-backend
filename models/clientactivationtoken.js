"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class ClientActivationToken extends Model {
    static associate(models) {
      ClientActivationToken.belongsTo(models.Client, {
        foreignKey: "client_id",
        as: "client",
      });
    }
  }

  ClientActivationToken.init(
    {
      client_id: { type: DataTypes.INTEGER, allowNull: false },
      token: { type: DataTypes.STRING(255), allowNull: false },
      expires_at: { type: DataTypes.DATE, allowNull: false },
      consumed_at: { type: DataTypes.DATE, allowNull: true },
    },
    {
      sequelize,
      modelName: "ClientActivationToken",
      tableName: "ClientActivationTokens",
    }
  );

  return ClientActivationToken;
};