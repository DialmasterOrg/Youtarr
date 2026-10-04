const { Model, DataTypes } = require('sequelize');
const { sequelize } = require('../db');

class TvReorganizeOperation extends Model {}

TvReorganizeOperation.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
    change_type: { type: DataTypes.STRING(32), allowNull: false },
    scope: { type: DataTypes.STRING(255), allowNull: false, defaultValue: '' },
    settings_change: { type: DataTypes.TEXT('medium'), allowNull: false },
    settings_applied: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    revision: { type: DataTypes.STRING(64), allowNull: false },
    status: { type: DataTypes.STRING(16), allowNull: false },
    total_items: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    done_items: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    failed_items: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    error: { type: DataTypes.TEXT, allowNull: true },
    started_at: { type: DataTypes.DATE, allowNull: true },
    finished_at: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    modelName: 'TvReorganizeOperation',
    tableName: 'tv_reorganize_operations',
    timestamps: true,
    underscored: true,
  }
);

module.exports = TvReorganizeOperation;
