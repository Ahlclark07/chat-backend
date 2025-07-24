"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class ConversationNote extends Model {
    static associate(models) {
      ConversationNote.belongsTo(models.Conversation, {
        foreignKey: "conversation_id",
        as: "conversation",
        onDelete: "CASCADE",
      });
      ConversationNote.belongsTo(models.Admin, {
        foreignKey: "admin_id",
        as: "admin",
        onDelete: "CASCADE",
      });
    }
  }

  ConversationNote.init(
    {
      conversation_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      admin_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      contenu: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: "ConversationNote",
      tableName: "ConversationNotes", // important si nom explicite
    }
  );

  return ConversationNote;
};
