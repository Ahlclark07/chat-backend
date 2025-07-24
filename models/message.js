"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Message extends Model {
    static associate(models) {
      Message.belongsTo(models.Conversation, {
        foreignKey: "conversation_id",
        as: "conversation",
      });
      Message.hasOne(models.CreditTransaction, {
        foreignKey: "message_id",
        as: "credit",
      });
    }
  }

  Message.init(
    {
      conversation_id: DataTypes.INTEGER,
      sender_type: DataTypes.ENUM("client", "girl", "system"),
      body: DataTypes.TEXT,
      media_url: DataTypes.STRING,
      sender_id: DataTypes.INTEGER,
      receiver_id: DataTypes.INTEGER,
    },
    {
      sequelize,
      modelName: "Message",
    }
  );

  return Message;
};
