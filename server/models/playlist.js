const { Model, DataTypes } = require('sequelize');
const { sequelize } = require('../db');

class Playlist extends Model {}

Playlist.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    playlist_id: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    url: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    uploader: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    uploader_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    folder_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: null,
    },
    lastFetched: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
    },
    enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    auto_download_enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    sub_folder: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },
    video_quality: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },
    min_duration: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
    },
    max_duration: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
    },
    title_filter_regex: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },
    audio_format: {
      type: DataTypes.STRING(20),
      allowNull: true,
      defaultValue: null,
    },
  },
  {
    sequelize,
    modelName: 'Playlist',
    timestamps: false,
    tableName: 'playlists',
  }
);

module.exports = Playlist;
