"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class CreditTransaction extends Model {
    static associate(models) {
      CreditTransaction.belongsTo(models.Client, {
        foreignKey: "client_id",
        as: "client",
      });
      CreditTransaction.belongsTo(models.Conversation, {
        foreignKey: "conversation_id",
        as: "conversation",
      });
      CreditTransaction.belongsTo(models.Message, {
        foreignKey: "message_id",
        as: "message",
      });
    }
  }

  CreditTransaction.init(
    {
      client_id: DataTypes.INTEGER,
      conversation_id: DataTypes.INTEGER,
      message_id: DataTypes.INTEGER,
      amount: DataTypes.INTEGER,
    },
    {
      sequelize,
      modelName: "CreditTransaction",
    }
  );

  return CreditTransaction;
};
