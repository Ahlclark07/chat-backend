"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn("CreditTransactions", "conversation_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    // If reverting, set any NULLs to 0 or delete them before enforcing NOT NULL
    await queryInterface.sequelize.query(
      "DELETE FROM CreditTransactions WHERE conversation_id IS NULL"
    );
    await queryInterface.changeColumn("CreditTransactions", "conversation_id", {
      type: Sequelize.INTEGER,
      allowNull: false,
    });
  },
};

