"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("HomepageGirls", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      girl_id: {
        allowNull: false,
        type: Sequelize.INTEGER,
        references: {
          model: "Girls",
          key: "id",
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      added_by: {
        allowNull: true,
        type: Sequelize.INTEGER,
        references: {
          model: "Admins",
          key: "id",
        },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      position: {
        allowNull: false,
        type: Sequelize.INTEGER,
        defaultValue: 0,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });
    await queryInterface.addConstraint("HomepageGirls", {
      fields: ["girl_id"],
      type: "unique",
      name: "homepagegirls_girl_id_unique",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("HomepageGirls");
  },
};
