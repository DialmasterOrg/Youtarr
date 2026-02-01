const { Model, DataTypes } = require('sequelize');
const { sequelize } = require('../db');

class Channel extends Model {}

Channel.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    channel_id: {
      type: DataTypes.STRING,
      allowNull: true,
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
    folder_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: null,
    },
    lastFetchedByTab: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },
    enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    available_tabs: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },
    auto_download_enabled_tabs: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: 'video',
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
    default_rating: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    audio_format: {
      type: DataTypes.STRING(20),
      allowNull: true,
      defaultValue: null,
    },
  },
  {
    sequelize,
    modelName: 'Channel',
    timestamps: false,
    tableName: 'channels',
  }
);

module.exports = Channel;
