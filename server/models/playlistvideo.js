const { Model, DataTypes } = require('sequelize');
const { sequelize } = require('../db');

class PlaylistVideo extends Model {}

PlaylistVideo.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
    playlist_id: { type: DataTypes.STRING, allowNull: false },
    youtube_id: { type: DataTypes.STRING, allowNull: false },
    position: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    added_at: { type: DataTypes.DATE, allowNull: true },
    channel_id: { type: DataTypes.STRING, allowNull: true },
    ignored: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    ignored_at: { type: DataTypes.DATE, allowNull: true },
  },
  { sequelize, modelName: 'PlaylistVideo', tableName: 'playlistvideos', timestamps: true }
);

module.exports = PlaylistVideo;
