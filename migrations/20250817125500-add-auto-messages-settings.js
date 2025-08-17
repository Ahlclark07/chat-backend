"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();
    await queryInterface.bulkInsert("Settings", [
      { key: "auto_messages_enabled", value: "false", createdAt: now, updatedAt: now },
      { key: "auto_messages_interval_seconds", value: "20", createdAt: now, updatedAt: now },
      { key: "auto_messages_max_conversations", value: "3", createdAt: now, updatedAt: now },
    ], { ignoreDuplicates: true });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("Settings", { key: [
      "auto_messages_enabled",
      "auto_messages_interval_seconds",
      "auto_messages_max_conversations",
    ]});
  },
};

