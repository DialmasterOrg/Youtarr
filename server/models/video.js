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
  },
  {
    sequelize,
    modelName: 'Video',
    tableName: 'Videos',
    timestamps: false,
  }
);

module.exports = Video;
