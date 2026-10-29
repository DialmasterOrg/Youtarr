const { Model, DataTypes } = require('sequelize');
const { sequelize } = require('../db');

class TvShowSeason extends Model {}

TvShowSeason.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
    show_id: { type: DataTypes.INTEGER, allowNull: false },
    season: { type: DataTypes.INTEGER, allowNull: false },
    name: { type: DataTypes.STRING(255), allowNull: true },
    // Highest order-numbered episode ever given in the season; never goes down.
    order_high_water: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  },
  {
    sequelize,
    modelName: 'TvShowSeason',
    tableName: 'tv_show_seasons',
    timestamps: true,
    underscored: true,
  }
);

module.exports = TvShowSeason;
