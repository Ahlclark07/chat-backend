"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class ConversationAdminStat extends Model {
    static associate(models) {
      if (models.Conversation) {
        ConversationAdminStat.belongsTo(models.Conversation, {
          foreignKey: "conversation_id",
          as: "conversation",
        });
      }
      if (models.Admin) {
        ConversationAdminStat.belongsTo(models.Admin, {
          foreignKey: "admin_id",
          as: "admin",
        });
      }
    }
  }

  ConversationAdminStat.init(
    {
      conversation_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      admin_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      message_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      last_message_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "ConversationAdminStat",
      tableName: "ConversationAdminStats",
    }
  );

  return ConversationAdminStat;
};

