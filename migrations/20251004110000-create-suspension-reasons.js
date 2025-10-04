"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("SuspensionReasons", {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      user_type: { type: Sequelize.ENUM("Client", "Admin"), allowNull: false },
      user_id: { type: Sequelize.INTEGER, allowNull: false },
      suspended_by_id: { type: Sequelize.INTEGER, allowNull: false },
      reason: { type: Sequelize.STRING(1000), allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
    });
    await queryInterface.addIndex("SuspensionReasons", ["user_type", "user_id"], { name: "suspension_user_idx" });
    await queryInterface.addIndex("SuspensionReasons", ["createdAt"], { name: "suspension_created_idx" });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("SuspensionReasons");
    try { await queryInterface.sequelize.query("DROP TYPE IF EXISTS \"enum_SuspensionReasons_user_type\";"); } catch (e) {}
  },
};