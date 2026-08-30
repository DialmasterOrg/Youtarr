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
    usage_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    role: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'legacy_download', validate: { isIn: [['legacy_download', 'view', 'request', 'delete', 'full_access']] } },
    auto_approve_video_requests: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    auto_approve_channel_requests: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    auto_approve_delete_requests: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    allow_video_requests: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    allow_channel_requests: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    allow_delete_video_requests: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    max_rating_level: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 4 },
    allow_unrated: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    allowed_media_types: { type: DataTypes.JSON, allowNull: false, defaultValue: ['video'] },
    max_active_jobs: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 5, validate: { min: 1, max: 5 } },
    hourly_write_limit: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 30, validate: { min: 1, max: 30 } },
    daily_write_limit: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 200, validate: { min: 1, max: 200 } },
    revoked_at: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    modelName: 'ApiKey',
    tableName: 'ApiKeys',
    timestamps: false,
  }
);

module.exports = ApiKey;
