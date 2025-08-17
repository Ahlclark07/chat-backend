"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Nettoyage des données orphelines avant d'ajouter les contraintes
    // Ordre: enfants -> parents
    await queryInterface.sequelize.query(
      "DELETE FROM GirlPhotos WHERE girl_id NOT IN (SELECT id FROM Girls)"
    );
    await queryInterface.sequelize.query(
      "DELETE FROM CreditTransactions WHERE message_id IS NOT NULL AND message_id NOT IN (SELECT id FROM Messages)"
    );
    await queryInterface.sequelize.query(
      "DELETE FROM Messages WHERE conversation_id NOT IN (SELECT id FROM Conversations)"
    );
    await queryInterface.sequelize.query(
      "DELETE FROM CreditTransactions WHERE conversation_id NOT IN (SELECT id FROM Conversations)"
    );
    await queryInterface.sequelize.query(
      "DELETE FROM CreditTransactions WHERE client_id NOT IN (SELECT id FROM Clients)"
    );
    await queryInterface.sequelize.query(
      "DELETE FROM AdminLoginHistories WHERE admin_id NOT IN (SELECT id FROM Admins)"
    );
    await queryInterface.sequelize.query(
      "DELETE FROM AdminGirls WHERE admin_id NOT IN (SELECT id FROM Admins) OR girl_id NOT IN (SELECT id FROM Girls)"
    );
    await queryInterface.sequelize.query(
      "DELETE FROM RefreshTokens WHERE client_id NOT IN (SELECT id FROM Clients)"
    );
    await queryInterface.sequelize.query(
      "DELETE FROM Conversations WHERE client_id NOT IN (SELECT id FROM Clients) OR girl_id NOT IN (SELECT id FROM Girls)"
    );

    async function addConstraintSafe(table, options) {
      try {
        await queryInterface.addConstraint(table, options);
      } catch (e) {
        console.log(
          `Skip adding constraint ${options.name} on ${table}: ${e.message}`
        );
      }
    }

    // Conversations FKs
    await addConstraintSafe("Conversations", {
      fields: ["client_id"],
      type: "foreign key",
      name: "fk_conversations_client",
      references: { table: "Clients", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });
    await addConstraintSafe("Conversations", {
      fields: ["girl_id"],
      type: "foreign key",
      name: "fk_conversations_girl",
      references: { table: "Girls", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });
    // Peut être null si admin supprimé
    await addConstraintSafe("Conversations", {
      fields: ["assigned_admin_id"],
      type: "foreign key",
      name: "fk_conversations_assigned_admin",
      references: { table: "Admins", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    // Messages FKs
    await addConstraintSafe("Messages", {
      fields: ["conversation_id"],
      type: "foreign key",
      name: "fk_messages_conversation",
      references: { table: "Conversations", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });

    // GirlPhotos FKs
    await addConstraintSafe("GirlPhotos", {
      fields: ["girl_id"],
      type: "foreign key",
      name: "fk_girlphotos_girl",
      references: { table: "Girls", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });

    // CreditTransactions FKs
    await addConstraintSafe("CreditTransactions", {
      fields: ["client_id"],
      type: "foreign key",
      name: "fk_credit_client",
      references: { table: "Clients", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });
    await addConstraintSafe("CreditTransactions", {
      fields: ["conversation_id"],
      type: "foreign key",
      name: "fk_credit_conversation",
      references: { table: "Conversations", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });
    await addConstraintSafe("CreditTransactions", {
      fields: ["message_id"],
      type: "foreign key",
      name: "fk_credit_message",
      references: { table: "Messages", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    // AdminLoginHistories FK
    await addConstraintSafe("AdminLoginHistories", {
      fields: ["admin_id"],
      type: "foreign key",
      name: "fk_login_history_admin",
      references: { table: "Admins", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });

    // AdminGirls FKs
    await addConstraintSafe("AdminGirls", {
      fields: ["admin_id"],
      type: "foreign key",
      name: "fk_admingirls_admin",
      references: { table: "Admins", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });
    await addConstraintSafe("AdminGirls", {
      fields: ["girl_id"],
      type: "foreign key",
      name: "fk_admingirls_girl",
      references: { table: "Girls", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });

    // RefreshTokens FK
    await addConstraintSafe("RefreshTokens", {
      fields: ["client_id"],
      type: "foreign key",
      name: "fk_refresh_client",
      references: { table: "Clients", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });
  },

  async down(queryInterface, Sequelize) {
    // Drop constraints in reverse order
    await queryInterface.removeConstraint("RefreshTokens", "fk_refresh_client");
    await queryInterface.removeConstraint("AdminGirls", "fk_admingirls_girl");
    await queryInterface.removeConstraint("AdminGirls", "fk_admingirls_admin");
    await queryInterface.removeConstraint("AdminLoginHistories", "fk_login_history_admin");
    await queryInterface.removeConstraint("CreditTransactions", "fk_credit_message");
    await queryInterface.removeConstraint("CreditTransactions", "fk_credit_conversation");
    await queryInterface.removeConstraint("CreditTransactions", "fk_credit_client");
    await queryInterface.removeConstraint("GirlPhotos", "fk_girlphotos_girl");
    await queryInterface.removeConstraint("Messages", "fk_messages_conversation");
    await queryInterface.removeConstraint("Conversations", "fk_conversations_assigned_admin");
    await queryInterface.removeConstraint("Conversations", "fk_conversations_girl");
    await queryInterface.removeConstraint("Conversations", "fk_conversations_client");
  },
};
