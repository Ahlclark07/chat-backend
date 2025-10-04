"use strict";
module.exports = (sequelize, DataTypes) => {
  const SuspensionReason = sequelize.define(
    "SuspensionReason",
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      user_type: { type: DataTypes.ENUM("Client", "Admin"), allowNull: false },
      user_id: { type: DataTypes.INTEGER, allowNull: false },
      suspended_by_id: { type: DataTypes.INTEGER, allowNull: false },
      reason: { type: DataTypes.STRING(1000), allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      tableName: "SuspensionReasons",
    }
  );
  SuspensionReason.associate = function () {};
  return SuspensionReason;
};