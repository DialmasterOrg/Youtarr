const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../db');

class ApiKey extends Model {}

ApiKey.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    key_hash: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    key_prefix: {
      type: DataTypes.STRING(8),
      allowNull: false,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    last_used_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    sequelize,
    modelName: 'ApiKey',
    tableName: 'ApiKeys',
    timestamps: false,
  }
);

module.exports = ApiKey;

