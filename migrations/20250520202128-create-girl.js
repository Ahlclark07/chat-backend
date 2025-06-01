"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("Girls", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      nom: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      prenom: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      date_naissance: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      photo_profil: {
        type: Sequelize.STRING,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      pays_id: {
        type: Sequelize.INTEGER,
      },
      ville_id: {
        type: Sequelize.INTEGER,
      },
      telephone: {
        type: Sequelize.STRING,
      },
      is_banned: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      ban_reason: {
        type: Sequelize.STRING,
      },
      ban_expires_at: {
        type: Sequelize.DATE,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("Girls");
  },
};
