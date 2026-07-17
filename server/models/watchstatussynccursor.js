const { Model, DataTypes } = require('sequelize');
const { sequelize } = require('../db');

class WatchStatusSyncCursor extends Model {}

WatchStatusSyncCursor.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
    server_type: { type: DataTypes.ENUM('plex', 'jellyfin', 'emby'), allowNull: false, unique: true },
    cursor: { type: DataTypes.DATE, allowNull: true },
  },
  { sequelize, modelName: 'WatchStatusSyncCursor', tableName: 'watch_status_sync_cursors', timestamps: true }
);

module.exports = WatchStatusSyncCursor;
