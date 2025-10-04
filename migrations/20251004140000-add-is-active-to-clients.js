"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("Clients", "is_active", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      after: "is_banned",
    });
    await queryInterface.sequelize.query("UPDATE Clients SET is_active = 1");
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("Clients", "is_active");
  },
};
