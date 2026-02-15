const { Model, DataTypes } = require('sequelize');
const { sequelize } = require('../db');

class ChannelVideo extends Model {}

ChannelVideo.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    youtube_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    channel_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    thumbnail: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    duration: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    publishedAt: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    availability: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
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
    live_status: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
    ignored: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    ignored_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
    },
  },
  {
    sequelize,
    modelName: 'ChannelVideo',
    tableName: 'channelvideos',
    timestamps: false,
  }
);

module.exports = ChannelVideo;
