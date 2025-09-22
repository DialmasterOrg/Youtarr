const { Model, DataTypes } = require('sequelize');
const { sequelize } = require('../db');

class ProfileFilter extends Model {}

ProfileFilter.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    profile_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    filter_type: {
      type: DataTypes.ENUM('title_regex', 'title_contains', 'duration_range'),
      allowNull: false,
    },
    filter_value: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    priority: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: 'ProfileFilter',
    tableName: 'profile_filters',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

module.exports = ProfileFilter;