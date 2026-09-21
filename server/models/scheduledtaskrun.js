const { Model, DataTypes } = require('sequelize');
const { sequelize } = require('../db');

class ScheduledTaskRun extends Model {}

ScheduledTaskRun.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
    task_key: { type: DataTypes.STRING(64), allowNull: false },
    trigger_type: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'scheduled' },
    status: { type: DataTypes.STRING(16), allowNull: false },
    outcome: { type: DataTypes.STRING(32), allowNull: true },
    message: { type: DataTypes.TEXT, allowNull: true },
    details: { type: DataTypes.TEXT, allowNull: true },
    started_at: { type: DataTypes.DATE, allowNull: false },
    finished_at: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    modelName: 'ScheduledTaskRun',
    tableName: 'scheduled_task_runs',
    timestamps: false,
    underscored: true,
  }
);

module.exports = ScheduledTaskRun;
