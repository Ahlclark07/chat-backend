"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("Admins", "current_session_token", {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn("Admins", "current_session_started_at", {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("Admins", "current_session_started_at");
    await queryInterface.removeColumn("Admins", "current_session_token");
  },
};

