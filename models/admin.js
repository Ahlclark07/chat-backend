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
    },
    {
      sequelize,
      modelName: "Admin",
    }
  );

  return Admin;
};
