"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("Conversations", "assigned_admin_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
      after: "girl_id",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("Conversations", "assigned_admin_id");
  },
};

