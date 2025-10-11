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
  },
  {
    sequelize,
    modelName: 'Channel',
    timestamps: false,
    tableName: 'channels',
  }
);

module.exports = Channel;
