"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("Clients", {
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
      email: {
        type: Sequelize.STRING,
        unique: true,
        allowNull: false,
      },
      mot_de_passe: {
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
      pays_id: {
        type: Sequelize.INTEGER,
      },
      ville_id: {
        type: Sequelize.INTEGER,
      },
      telephone: {
        type: Sequelize.STRING,
      },
      credit_balance: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
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
    await queryInterface.dropTable("Clients");
  },
};
