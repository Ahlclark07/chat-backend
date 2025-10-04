"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("ClientActivationTokens", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      client_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "Clients", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      token: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true,
      },
      expires_at: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      consumed_at: {
        allowNull: true,
        type: Sequelize.DATE,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn("NOW"),
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn("NOW"),
      },
    });
    await queryInterface.addIndex("ClientActivationTokens", ["client_id"], {
      name: "activation_tokens_client_idx",
    });
    await queryInterface.addIndex("ClientActivationTokens", ["token"], {
      unique: true,
      name: "activation_tokens_token_idx",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("ClientActivationTokens");
  },
};