"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class RolePermission extends Model {
    static associate(models) {
      // pas d'association directe : jointure many-to-many
    }
  }

  RolePermission.init(
    {
      role_id: DataTypes.INTEGER,
      permission_id: DataTypes.INTEGER,
    },
    {
      sequelize,
      modelName: "RolePermission",
    }
  );

  return RolePermission;
};
