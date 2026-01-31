const { Model, DataTypes } = require('sequelize');
const { sequelize } = require('../db');

class PlaylistVideo extends Model {}

PlaylistVideo.init(
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
    playlist_id: {
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
    playlist_index: {
      type: DataTypes.INTEGER,
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
    modelName: 'PlaylistVideo',
    tableName: 'playlistvideos',
    timestamps: false,
  }
);

module.exports = PlaylistVideo;
