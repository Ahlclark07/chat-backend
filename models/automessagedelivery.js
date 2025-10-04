"use strict";
module.exports = (sequelize, DataTypes) => {
  const AutoMessageDelivery = sequelize.define(
    "AutoMessageDelivery",
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      auto_message_id: { type: DataTypes.INTEGER, allowNull: false },
      client_id: { type: DataTypes.INTEGER, allowNull: false },
      conversation_id: { type: DataTypes.INTEGER, allowNull: true },
      message_id: { type: DataTypes.INTEGER, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      tableName: "AutoMessageDeliveries",
    }
  );

  AutoMessageDelivery.associate = function (models) {
    AutoMessageDelivery.belongsTo(models.AutoMessage, {
      foreignKey: "auto_message_id",
      as: "autoMessage",
    });
    AutoMessageDelivery.belongsTo(models.Client, {
      foreignKey: "client_id",
      as: "client",
    });
    AutoMessageDelivery.belongsTo(models.Conversation, {
      foreignKey: "conversation_id",
      as: "conversation",
    });
    AutoMessageDelivery.belongsTo(models.Message, {
      foreignKey: "message_id",
      as: "message",
    });
  };

  return AutoMessageDelivery;
};