const { Model, DataTypes } = require('sequelize');
const { sequelize } = require('../db');

class Subfolder extends Model {}

Subfolder.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
    // Stored clean (no __ prefix). Unique under utf8mb4_unicode_ci (case-insensitive).
    name: { type: DataTypes.STRING(100), allowNull: false, unique: true },
  },
  { sequelize, modelName: 'Subfolder', tableName: 'subfolders', timestamps: true }
);

module.exports = Subfolder;
