const { Model, DataTypes } = require('sequelize');
const { sequelize } = require('../db');

class VideoProfileMapping extends Model {}

VideoProfileMapping.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    video_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    profile_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    season: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    episode: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    processed_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: 'VideoProfileMapping',
    tableName: 'video_profile_mappings',
    timestamps: false,
  }
);

module.exports = VideoProfileMapping;