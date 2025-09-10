"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("EmailLogs", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      from: { type: Sequelize.STRING },
      to: { type: Sequelize.TEXT },
      cc: { type: Sequelize.TEXT },
      bcc: { type: Sequelize.TEXT },
      subject: { type: Sequelize.STRING },
      template: { type: Sequelize.STRING },
      message_id: { type: Sequelize.STRING },
      provider_accepted: { type: Sequelize.TEXT },
      provider_rejected: { type: Sequelize.TEXT },
      provider_envelope: { type: Sequelize.TEXT },
      provider_response: { type: Sequelize.TEXT },
      success: { type: Sequelize.BOOLEAN, defaultValue: false },
      error_name: { type: Sequelize.STRING },
      error_code: { type: Sequelize.STRING },
      error_message: { type: Sequelize.TEXT },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn("NOW"),
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn("NOW"),
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("EmailLogs");
  },
};

