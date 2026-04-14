const { Model, DataTypes } = require('sequelize');
const { sequelize } = require('../db');

class Playlist extends Model {}

Playlist.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
    playlist_id: { type: DataTypes.STRING, allowNull: false },
    title: { type: DataTypes.STRING, allowNull: true },
    url: { type: DataTypes.STRING, allowNull: true },
    description: { type: DataTypes.TEXT, allowNull: true },
    uploader: { type: DataTypes.STRING, allowNull: true },
    thumbnail: { type: DataTypes.STRING, allowNull: true },
    video_count: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 },
    enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    auto_download: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    sync_to_plex: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    sync_to_jellyfin: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    sync_to_emby: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    public_on_servers: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    default_sub_folder: { type: DataTypes.STRING, allowNull: true },
    video_quality: { type: DataTypes.TEXT, allowNull: true },
    min_duration: { type: DataTypes.INTEGER, allowNull: true },
    max_duration: { type: DataTypes.INTEGER, allowNull: true },
    title_filter_regex: { type: DataTypes.TEXT, allowNull: true },
    audio_format: { type: DataTypes.STRING, allowNull: true },
    default_rating: { type: DataTypes.STRING, allowNull: true },
    lastFetched: { type: DataTypes.DATE, allowNull: true },
  },
  { sequelize, modelName: 'Playlist', tableName: 'playlists', timestamps: true }
);

module.exports = Playlist;
