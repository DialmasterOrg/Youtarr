const { Model, DataTypes } = require('sequelize');
const { sequelize } = require('../db');

class VideoWatchStatus extends Model {}

VideoWatchStatus.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
    video_id: { type: DataTypes.INTEGER, allowNull: false },
    server_type: { type: DataTypes.ENUM('plex', 'jellyfin', 'emby'), allowNull: false },
    server_user_id: { type: DataTypes.STRING, allowNull: true },
    played: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    play_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    position_ms: { type: DataTypes.BIGINT, allowNull: true },
    percent_watched: { type: DataTypes.FLOAT, allowNull: true },
    last_watched_at: { type: DataTypes.DATE, allowNull: true },
    last_synced_at: { type: DataTypes.DATE, allowNull: false },
  },
  { sequelize, modelName: 'VideoWatchStatus', tableName: 'video_watch_status', timestamps: true }
);

module.exports = VideoWatchStatus;
