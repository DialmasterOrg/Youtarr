const { Model, DataTypes } = require('sequelize');
const { sequelize } = require('../db');

class VideoMembersAccess extends Model {}

VideoMembersAccess.init(
  {
    youtube_id: { type: DataTypes.STRING(20), primaryKey: true, allowNull: false },
    access: { type: DataTypes.STRING(16), allowNull: true },
    cookie_key: { type: DataTypes.STRING(64), allowNull: true },
    checked_at: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    modelName: 'VideoMembersAccess',
    tableName: 'video_members_access',
    timestamps: false,
    underscored: true,
  }
);

module.exports = VideoMembersAccess;
