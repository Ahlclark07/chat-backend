"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class EmailLog extends Model {
    static associate(models) {
      // No associations for now
    }
  }

  EmailLog.init(
    {
      from: DataTypes.STRING,
      to: DataTypes.TEXT,
      cc: DataTypes.TEXT,
      bcc: DataTypes.TEXT,
      subject: DataTypes.STRING,
      template: DataTypes.STRING,
      message_id: DataTypes.STRING,
      provider_accepted: DataTypes.TEXT,
      provider_rejected: DataTypes.TEXT,
      provider_envelope: DataTypes.TEXT,
      provider_response: DataTypes.TEXT,
      success: DataTypes.BOOLEAN,
      error_name: DataTypes.STRING,
      error_code: DataTypes.STRING,
      error_message: DataTypes.TEXT,
    },
    {
      sequelize,
      modelName: "EmailLog",
    }
  );

  return EmailLog;
};

