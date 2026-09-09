const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../db');

class ApiKeyChannelGrant extends Model {}
ApiKeyChannelGrant.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
  api_key_id: { type: DataTypes.INTEGER, allowNull: false },
  channel_id: { type: DataTypes.INTEGER, allowNull: false },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, { sequelize, modelName: 'ApiKeyChannelGrant', tableName: 'api_key_channel_grants', timestamps: false,
  indexes: [
    { unique: true, fields: ['api_key_id', 'channel_id'], name: 'api_key_channel_grants_key_channel_uq' },
    { fields: ['channel_id'], name: 'api_key_channel_grants_channel_idx' },
  ] });
module.exports = ApiKeyChannelGrant;
