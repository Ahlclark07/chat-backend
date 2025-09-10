"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Client extends Model {
    static associate(models) {
      Client.belongsTo(models.Country, { foreignKey: "pays_id", as: "pays" });
      Client.belongsTo(models.City, { foreignKey: "ville_id", as: "ville" });
      Client.hasMany(models.Conversation, {
        foreignKey: "client_id",
        as: "conversations",
      });
      Client.hasMany(models.CreditTransaction, {
        foreignKey: "client_id",
        as: "transactions",
      });
      Client.hasMany(models.RefreshToken, {
        foreignKey: "client_id",
        as: "refresh_tokens",
      });
    }
  }

  Client.init(
    {
      nom: DataTypes.STRING,
      prenom: DataTypes.STRING,
      email: DataTypes.STRING,
      mot_de_passe: DataTypes.STRING,
      date_naissance: DataTypes.DATEONLY,
      photo_profil: DataTypes.STRING,
      pays_id: DataTypes.INTEGER,
      ville_id: DataTypes.INTEGER,
      telephone: DataTypes.STRING,
      credit_balance: DataTypes.INTEGER,
      is_banned: DataTypes.BOOLEAN,
      ban_reason: DataTypes.STRING,
      ban_expires_at: DataTypes.DATE,
      last_login: DataTypes.DATE,
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      sexe: {
        type: DataTypes.ENUM("homme", "femme"),
        allowNull: true,
      },
      attirance: {
        type: DataTypes.ENUM("femme", "homme", "tous"),
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "Client",
    }
  );

  return Client;
};
