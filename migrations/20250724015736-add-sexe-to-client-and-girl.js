"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await Promise.all([
      queryInterface.addColumn("Clients", "sexe", {
        type: Sequelize.ENUM("homme", "femme"),
        allowNull: true,
        defaultValue: null,
      }),
      queryInterface.addColumn("Girls", "sexe", {
        type: Sequelize.ENUM("homme", "femme"),
        allowNull: true,
        defaultValue: null,
      }),
    ]);
  },

  async down(queryInterface, Sequelize) {
    await Promise.all([
      queryInterface.removeColumn("Clients", "sexe"),
      queryInterface.removeColumn("Girls", "sexe"),
    ]);
  },
};
