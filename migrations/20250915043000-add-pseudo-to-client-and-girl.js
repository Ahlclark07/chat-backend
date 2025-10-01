"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await Promise.all([
      queryInterface.addColumn("Clients", "pseudo", {
        type: Sequelize.STRING,
        allowNull: true,
        unique: true,
      }),
      queryInterface.addColumn("Girls", "pseudo", {
        type: Sequelize.STRING,
        allowNull: true,
        unique: true,
      }),
    ]);
  },

  async down(queryInterface) {
    await Promise.all([
      queryInterface.removeColumn("Clients", "pseudo"),
      queryInterface.removeColumn("Girls", "pseudo"),
    ]);
  },
};
