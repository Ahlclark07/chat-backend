module.exports = (sequelize, DataTypes) => {
  const ClientBlock = sequelize.define(
    "ClientBlock",
    {
      client_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      girl_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      reason: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      tableName: "ClientBlocks",
    }
  );

  ClientBlock.associate = (models) => {
    ClientBlock.belongsTo(models.Client, {
      foreignKey: "client_id",
      as: "client",
    });
    ClientBlock.belongsTo(models.Girl, { foreignKey: "girl_id", as: "girl" });
  };

  return ClientBlock;
};
