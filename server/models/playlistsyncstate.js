const { Model, DataTypes } = require('sequelize');
const { sequelize } = require('../db');

class PlaylistSyncState extends Model {}

PlaylistSyncState.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
    playlist_id: { type: DataTypes.INTEGER, allowNull: false },
    server_type: { type: DataTypes.ENUM('plex', 'jellyfin', 'emby'), allowNull: false },
    server_playlist_id: { type: DataTypes.STRING, allowNull: true },
    last_synced_at: { type: DataTypes.DATE, allowNull: true },
    last_error: { type: DataTypes.TEXT, allowNull: true },
  },
  { sequelize, modelName: 'PlaylistSyncState', tableName: 'playlist_sync_state', timestamps: true }
);

module.exports = PlaylistSyncState;
