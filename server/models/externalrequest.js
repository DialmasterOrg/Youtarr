const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../db');
const REQUEST_STATUSES = ['pending', 'approved', 'processing', 'completed', 'rejected', 'failed', 'cancelled'];
class ExternalRequest extends Model {}
ExternalRequest.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true, allowNull: false },
  api_key_id: { type: DataTypes.INTEGER, allowNull: false }, channel_id: { type: DataTypes.INTEGER, allowNull: true },
  youtube_id: { type: DataTypes.STRING(32), allowNull: true }, channel_url: { type: DataTypes.STRING(500), allowNull: true },
  grant_to_requesting_key: { type: DataTypes.BOOLEAN, allowNull: true },
  request_type: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'video', validate: { isIn: [['video', 'channel', 'delete_video']] } },
  status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'pending', validate: { isIn: [REQUEST_STATUSES] } },
  active_dedupe_key: { type: DataTypes.STRING(191), allowNull: true }, idempotency_hash: { type: DataTypes.STRING(64), allowNull: true },
  job_id: { type: DataTypes.UUID, allowNull: true }, message: { type: DataTypes.STRING(500), allowNull: true },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }, updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  decided_at: { type: DataTypes.DATE, allowNull: true }, completed_at: { type: DataTypes.DATE, allowNull: true },
}, { sequelize, modelName: 'ExternalRequest', tableName: 'external_requests', timestamps: false,
  indexes: [
    { unique: true, fields: ['active_dedupe_key'], name: 'external_requests_active_dedupe_uq' },
    { unique: true, fields: ['api_key_id', 'idempotency_hash'], name: 'external_requests_key_idempotency_uq' },
    { fields: ['api_key_id', 'created_at'], name: 'external_requests_key_created_idx' },
    { fields: ['api_key_id', 'status'], name: 'external_requests_key_status_idx' },
    { fields: ['api_key_id', 'request_type', 'youtube_id', 'created_at', 'id'], name: 'external_requests_catalog_status_idx' },
    { fields: ['request_type', 'status', 'created_at', 'id'], name: 'external_requests_management_idx' },
  ] });
ExternalRequest.REQUEST_STATUSES = REQUEST_STATUSES;
module.exports = ExternalRequest;
