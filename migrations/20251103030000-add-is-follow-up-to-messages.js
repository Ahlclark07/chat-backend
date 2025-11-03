"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("Messages", "is_follow_up", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("Messages", "is_follow_up");
  },
};

