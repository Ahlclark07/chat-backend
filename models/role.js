"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Role extends Model {
    static associate(models) {
      Role.belongsToMany(models.Admin, {
        through: "AdminRole",
        foreignKey: "role_id",
        as: "admins",
      });

      Role.belongsToMany(models.Permission, {
        through: "RolePermission",
        foreignKey: "role_id",
        as: "permissions",
      });
    }
  }

  Role.init(
    {
      name: DataTypes.STRING,
      description: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: "Role",
    }
  );

  return Role;
};
