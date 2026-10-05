const { Model, DataTypes } = require('sequelize');
const { sequelize } = require('../db');

class TvShowPattern extends Model {}

TvShowPattern.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
    show_id: { type: DataTypes.INTEGER, allowNull: false },
    position: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    pattern_text: { type: DataTypes.TEXT, allowNull: false },
    // simple | regex
    pattern_kind: { type: DataTypes.STRING(8), allowNull: false },
    compiled_regex: { type: DataTypes.TEXT, allowNull: false },
    filter_regex: { type: DataTypes.TEXT, allowNull: false },
    // title | fixed | year
    season_source: { type: DataTypes.STRING(8), allowNull: false },
    season_fixed: { type: DataTypes.INTEGER, allowNull: true },
    // title | date | order
    episode_source: { type: DataTypes.STRING(8), allowNull: false },
  },
  {
    sequelize,
    modelName: 'TvShowPattern',
    tableName: 'tv_show_patterns',
    timestamps: true,
    underscored: true,
  }
);

module.exports = TvShowPattern;
