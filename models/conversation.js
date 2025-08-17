"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Conversation extends Model {
    static associate(models) {
      Conversation.belongsTo(models.Client, {
        foreignKey: "client_id",
        as: "client",
      });
      Conversation.belongsTo(models.Girl, {
        foreignKey: "girl_id",
        as: "girl",
      });
      // Admin assigné en charge de cette conversation (si défini)
      if (models.Admin) {
        Conversation.belongsTo(models.Admin, {
          foreignKey: "assigned_admin_id",
          as: "assigned_admin",
        });
      }
      Conversation.hasMany(models.Message, {
        foreignKey: "conversation_id",
        as: "messages",
      });
      Conversation.hasMany(models.CreditTransaction, {
        foreignKey: "conversation_id",
        as: "transactions",
      });
    }
  }

  Conversation.init(
    {
      client_id: DataTypes.INTEGER,
      girl_id: DataTypes.INTEGER,
      opened_at: DataTypes.DATE,
      closed_at: DataTypes.DATE,
      assigned_admin_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "Conversation",
    }
  );

  return Conversation;
};
