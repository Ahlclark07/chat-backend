"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Admin extends Model {
    static associate(models) {
      Admin.belongsToMany(models.Girl, {
        through: "AdminGirl",
        foreignKey: "admin_id",
        as: "girls",
      });
      Admin.hasMany(models.AdminActivityLog, { foreignKey: "admin_id" });

      Admin.hasMany(models.AdminLoginHistory, {
        foreignKey: "admin_id",
        as: "login_history",
      });
      Admin.belongsToMany(models.Role, {
        through: "AdminRole",
        foreignKey: "admin_id",
        as: "roles",
      });
      Admin.hasMany(models.Signalement, {
        foreignKey: "admin_id",
        as: "signalements",
      });
      Admin.hasMany(models.HomepageGirl, {
        foreignKey: "added_by",
        as: "homepageSelections",
      });
      if (models.ConversationAdminStat) {
        Admin.hasMany(models.ConversationAdminStat, {
          foreignKey: "admin_id",
          as: "conversationStats",
        });
      }
    }
  }

  Admin.init(
    {
      nom: DataTypes.STRING,
      prenom: DataTypes.STRING,
      email: DataTypes.STRING,
      mot_de_passe: DataTypes.STRING,
      telephone: DataTypes.STRING,
      role: DataTypes.ENUM("admin", "superadmin", "god"),
      is_active: DataTypes.BOOLEAN,
      identifiant: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      current_session_token: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      current_session_started_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },

    {
      sequelize,
      modelName: "Admin",
    }
  );

  return Admin;
};
