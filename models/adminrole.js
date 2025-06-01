"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class AdminRole extends Model {
    static associate(models) {
      // pas d'association directe : jointure many-to-many
    }
  }

  AdminRole.init(
    {
      admin_id: DataTypes.INTEGER,
      role_id: DataTypes.INTEGER,
    },
    {
      sequelize,
      modelName: "AdminRole",
    }
  );

  return AdminRole;
};
