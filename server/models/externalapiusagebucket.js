const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../db');
class ExternalApiUsageBucket extends Model {}
ExternalApiUsageBucket.init({
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true, allowNull: false }, api_key_id: { type: DataTypes.INTEGER, allowNull: false },
  window_type: { type: DataTypes.STRING(8), allowNull: false, validate: { isIn: [['hour', 'day']] } }, window_start: { type: DataTypes.DATE, allowNull: false },
  accepted_writes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }, created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }, updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, { sequelize, modelName: 'ExternalApiUsageBucket', tableName: 'external_api_usage_buckets', timestamps: false,
  indexes: [{ unique: true, fields: ['api_key_id', 'window_type', 'window_start'], name: 'external_api_usage_key_window_uq' }, { fields: ['window_start'], name: 'external_api_usage_window_idx' }] });
module.exports = ExternalApiUsageBucket;
