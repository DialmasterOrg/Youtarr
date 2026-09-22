const { Model, DataTypes } = require('sequelize');
const { sequelize } = require('../db');

class PlaylistVideo extends Model {}

PlaylistVideo.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
    playlist_id: { type: DataTypes.STRING, allowNull: false },
    youtube_id: { type: DataTypes.STRING, allowNull: false },
    position: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    // Legacy cutoff data is retained for playlists already following before #804.
    added_at: { type: DataTypes.DATE, allowNull: true },
    first_seen_at: { type: DataTypes.DATE, allowNull: true },
    downloaded_at: { type: DataTypes.DATE, allowNull: true },
    auto_download_requested: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    // Scheduling attempt, recorded before queue submission, never at completion.
    auto_download_last_attempt_at: { type: DataTypes.DATE(3), allowNull: true },
    channel_id: { type: DataTypes.STRING, allowNull: true },
    channel_name: { type: DataTypes.STRING, allowNull: true },
    title: { type: DataTypes.STRING, allowNull: true },
    thumbnail: { type: DataTypes.STRING, allowNull: true },
    duration: { type: DataTypes.INTEGER, allowNull: true },
    published_at: { type: DataTypes.STRING, allowNull: true },
    ignored: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    ignored_at: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    modelName: 'PlaylistVideo',
    tableName: 'playlistvideos',
    timestamps: true,
    underscored: true,
  }
);

module.exports = PlaylistVideo;
