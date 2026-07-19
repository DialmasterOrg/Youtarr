const { Model, DataTypes } = require('sequelize');
const { sequelize } = require('../db');

class MediaServerUser extends Model {}

MediaServerUser.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
    server_type: { type: DataTypes.ENUM('plex', 'jellyfin', 'emby'), allowNull: false },
    server_user_id: { type: DataTypes.STRING, allowNull: false },
    server_user_name: { type: DataTypes.STRING, allowNull: true },
  },
  { sequelize, modelName: 'MediaServerUser', tableName: 'media_server_users', timestamps: true }
);

module.exports = MediaServerUser;
