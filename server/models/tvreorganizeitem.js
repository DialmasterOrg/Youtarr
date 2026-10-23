const { Model, DataTypes } = require('sequelize');
const { sequelize } = require('../db');

class TvReorganizeItem extends Model {}

TvReorganizeItem.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
    operation_id: { type: DataTypes.INTEGER, allowNull: false },
    youtube_id: { type: DataTypes.STRING(20), allowNull: false },
    video_id: { type: DataTypes.INTEGER, allowNull: false },
    channel_id: { type: DataTypes.STRING(64), allowNull: true },
    title: { type: DataTypes.STRING(512), allowNull: true },
    files: { type: DataTypes.TEXT, allowNull: false },
    classification: { type: DataTypes.TEXT, allowNull: true },
    status: { type: DataTypes.STRING(16), allowNull: false },
    files_moved: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    error: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    sequelize,
    modelName: 'TvReorganizeItem',
    tableName: 'tv_reorganize_items',
    timestamps: true,
    underscored: true,
  }
);

module.exports = TvReorganizeItem;
