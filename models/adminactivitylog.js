"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class AdminActivityLog extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      AdminActivityLog.belongsTo(models.Admin, { foreignKey: "admin_id" });
    }
  }
  AdminActivityLog.init(
    {
      admin_id: DataTypes.INTEGER,
      action: DataTypes.STRING,
      target_type: DataTypes.STRING,
      target_id: DataTypes.INTEGER,
      details: DataTypes.TEXT,
    },
    {
      sequelize,
      modelName: "AdminActivityLog",
    }
  );

  return AdminActivityLog;
};
