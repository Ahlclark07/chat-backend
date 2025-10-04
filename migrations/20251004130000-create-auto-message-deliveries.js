"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("AutoMessageDeliveries", {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      auto_message_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "AutoMessages", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      client_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "Clients", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      conversation_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "Conversations", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      message_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "Messages", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
    });
    await queryInterface.addConstraint("AutoMessageDeliveries", {
      fields: ["auto_message_id", "client_id"],
      type: "unique",
      name: "auto_message_deliveries_unique",
    });
    await queryInterface.addIndex("AutoMessageDeliveries", ["client_id"], {
      name: "auto_message_deliveries_client_idx",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("AutoMessageDeliveries");
  },
};