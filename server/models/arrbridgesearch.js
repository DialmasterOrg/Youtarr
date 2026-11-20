const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../db');

// A search Sonarr or Radarr sent through the bridge (modules/arrBridge/searchHistory).
class ArrBridgeSearch extends Model {}

ArrBridgeSearch.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
  at: { type: DataTypes.DATE, allowNull: false },
  first_at: { type: DataTypes.DATE, allowNull: false },
  count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  kind: { type: DataTypes.STRING(10), allowNull: true },
  shape: { type: DataTypes.STRING(20), allowNull: false },
  outcome: { type: DataTypes.STRING(20), allowNull: false },
  offered: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  note: { type: DataTypes.STRING(40), allowNull: true },
  title_stage_skipped: { type: DataTypes.STRING(40), allowNull: true },
  search_text: { type: DataTypes.STRING(255), allowNull: true },
  // Both hold JSON as text.
  asked: { type: DataTypes.TEXT, allowNull: false },
  stages: { type: DataTypes.TEXT('medium'), allowNull: false },
}, {
  sequelize,
  modelName: 'ArrBridgeSearch',
  tableName: 'arr_bridge_searches',
  timestamps: false,
  indexes: [
    { fields: ['at'], name: 'arr_bridge_searches_at_idx' },
  ],
});

module.exports = ArrBridgeSearch;
