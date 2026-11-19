const { Model, DataTypes } = require('sequelize');
const { sequelize } = require('../db');

class WatchStatusHold extends Model {}

WatchStatusHold.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
    video_id: { type: DataTypes.INTEGER, allowNull: false },
    server_type: { type: DataTypes.STRING(16), allowNull: false },
    server_user_id: { type: DataTypes.STRING(255), allowNull: false },
    operation_id: { type: DataTypes.INTEGER, allowNull: true },
    snapshot: { type: DataTypes.TEXT, allowNull: false },
    state: { type: DataTypes.STRING(16), allowNull: false },
    attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    last_attempt_at: { type: DataTypes.DATE, allowNull: true },
    last_pushed_at: { type: DataTypes.DATE, allowNull: true },
    last_error: { type: DataTypes.TEXT, allowNull: true },
    expires_at: { type: DataTypes.DATE, allowNull: false },
  },
  {
    sequelize,
    modelName: 'WatchStatusHold',
    tableName: 'watch_status_holds',
    timestamps: true,
    underscored: true,
  }
);

module.exports = WatchStatusHold;
