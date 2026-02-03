"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn("SystemAlerts", "type", {
      type: Sequelize.ENUM(
        "MULTIPLE_CONNECTIONS",
        "SUSPICIOUS_CONTENT",
        "REPEATED_ADMIN_MESSAGE"
      ),
      allowNull: false,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn("SystemAlerts", "type", {
      type: Sequelize.ENUM("MULTIPLE_CONNECTIONS", "SUSPICIOUS_CONTENT"),
      allowNull: false,
    });
  },
};
