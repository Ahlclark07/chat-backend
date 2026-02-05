"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    async function dropAdminForeignKey() {
      try {
        const fks = await queryInterface.getForeignKeyReferencesForTable(
          "Signalements"
        );
        const adminFk = fks?.find((fk) => fk.columnName === "admin_id");
        if (adminFk?.constraintName) {
          await queryInterface.removeConstraint(
            "Signalements",
            adminFk.constraintName
          );
          return;
        }
      } catch (_) {}

      try {
        await queryInterface.removeConstraint(
          "Signalements",
          "signalements_ibfk_2"
        );
      } catch (_) {}
    }

    await dropAdminForeignKey();

    await queryInterface.changeColumn("Signalements", "admin_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
    });

    await queryInterface.addConstraint("Signalements", {
      fields: ["admin_id"],
      type: "foreign key",
      name: "signalements_admin_id_fk",
      references: {
        table: "Admins",
        field: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    await queryInterface.addColumn("Signalements", "client_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "Clients",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    await queryInterface.addColumn("Signalements", "girl_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "Girls",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    await queryInterface.addColumn("Signalements", "type", {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    async function dropAdminForeignKey() {
      try {
        const fks = await queryInterface.getForeignKeyReferencesForTable(
          "Signalements"
        );
        const adminFk = fks?.find((fk) => fk.columnName === "admin_id");
        if (adminFk?.constraintName) {
          await queryInterface.removeConstraint(
            "Signalements",
            adminFk.constraintName
          );
          return;
        }
      } catch (_) {}

      try {
        await queryInterface.removeConstraint(
          "Signalements",
          "signalements_admin_id_fk"
        );
      } catch (_) {}
    }

    await dropAdminForeignKey();

    await queryInterface.removeColumn("Signalements", "type");
    await queryInterface.removeColumn("Signalements", "girl_id");
    await queryInterface.removeColumn("Signalements", "client_id");

    await queryInterface.changeColumn("Signalements", "admin_id", {
      type: Sequelize.INTEGER,
      allowNull: false,
    });

    await queryInterface.addConstraint("Signalements", {
      fields: ["admin_id"],
      type: "foreign key",
      name: "signalements_admin_id_fk",
      references: {
        table: "Admins",
        field: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });
  },
};
