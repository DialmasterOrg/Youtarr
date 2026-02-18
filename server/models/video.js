const { Model, DataTypes } = require('sequelize');
const { sequelize } = require('../db');

class Video extends Model {}

Video.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    youtubeId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    youTubeChannelName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    youTubeVideoName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    duration: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    originalDate: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    channel_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    filePath: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    fileSize: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },
    audioFilePath: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    audioFileSize: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },
    removed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    media_type: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'video',
    },
    youtube_removed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    youtube_removed_checked_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
    },
    last_downloaded_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
    },
    content_rating: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Raw content rating object from YouTube/yt-dlp',
    },
    age_limit: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Age limit from yt-dlp',
    },
    normalized_rating: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Normalized rating for Plex/Kodi (e.g., "R", "PG-13", "TV-14")',
    },
    rating_source: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Source of the rating',
    },
  },
  {
    sequelize,
    modelName: 'Video',
    tableName: 'Videos',
    timestamps: false,
  }
);

module.exports = Video;
