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
      Message.hasOne(models.AutoMessageDelivery, {
        foreignKey: "message_id",
        as: "autoDelivery",
      });
      if (models.Admin) {
        Message.belongsTo(models.Admin, {
          foreignKey: "sender_id",
          as: "sender_admin",
          constraints: false,
        });
      }
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
      is_follow_up: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    },
    {
      sequelize,
      modelName: "Message",
    }
  );

  return Message;
};
