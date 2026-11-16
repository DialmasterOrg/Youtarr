const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../db');

const GRAB_STATUSES = ['pending', 'queued', 'completed', 'failed', 'removed'];

// A release Sonarr or Radarr grabbed through the bridge (modules/arrBridge).
class ArrBridgeGrab extends Model {}

ArrBridgeGrab.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true, allowNull: false },
  youtube_id: { type: DataTypes.STRING(20), allowNull: false },
  kind: { type: DataTypes.STRING(10), allowNull: false, validate: { isIn: [['tv', 'movie']] } },
  category: { type: DataTypes.STRING(32), allowNull: false },
  release_title: { type: DataTypes.STRING(255), allowNull: false },
  status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'pending', validate: { isIn: [GRAB_STATUSES] } },
  job_id: { type: DataTypes.UUID, allowNull: true },
  staged_path: { type: DataTypes.STRING(1024), allowNull: true },
  bytes: { type: DataTypes.BIGINT, allowNull: true },
  estimated_bytes: { type: DataTypes.BIGINT, allowNull: true },
  fail_message: { type: DataTypes.STRING(500), allowNull: true },
  // See modules/arrBridge/libraryCopyRemover.
  library_copy: { type: DataTypes.STRING(20), allowNull: true },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  completed_at: { type: DataTypes.DATE, allowNull: true },
  removed_at: { type: DataTypes.DATE, allowNull: true },
}, {
  sequelize,
  modelName: 'ArrBridgeGrab',
  tableName: 'arr_bridge_grabs',
  timestamps: false,
  indexes: [
    { fields: ['status', 'updated_at'], name: 'arr_bridge_grabs_status_idx' },
    { fields: ['youtube_id'], name: 'arr_bridge_grabs_youtube_id_idx' },
  ],
});

ArrBridgeGrab.GRAB_STATUSES = GRAB_STATUSES;

module.exports = ArrBridgeGrab;
