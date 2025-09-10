"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("Clients", "attirance", {
      type: Sequelize.ENUM("femme", "homme", "tous"),
      allowNull: true,
      defaultValue: null,
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove column first
    await queryInterface.removeColumn("Clients", "attirance");
    // Clean up ENUM type in case dialect persists it (mostly for Postgres)
    // MySQL will ignore this.
    if (queryInterface.sequelize.getDialect() === "postgres") {
      await queryInterface.sequelize.query(
        'DROP TYPE IF EXISTS "enum_Clients_attirance";'
      );
    }
  },
};

