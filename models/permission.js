"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Permission extends Model {
    static associate(models) {
      Permission.belongsToMany(models.Role, {
        through: "RolePermission",
        foreignKey: "permission_id",
        as: "roles",
      });
    }
  }

  Permission.init(
    {
      name: DataTypes.STRING,
      description: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: "Permission",
    }
  );

  return Permission;
};
