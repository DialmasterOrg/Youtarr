const { Model, DataTypes } = require('sequelize');
const { sequelize } = require('../db');

class JobVideo extends Model {}

JobVideo.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    job_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Jobs',
        key: 'id',
      },
      onUpdate: 'CASCADE',
    },
    video_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Videos',
        key: 'id',
      },
      onUpdate: 'CASCADE',
    },
  },
  {
    sequelize,
    modelName: 'JobVideo',
    timestamps: false,
    tableName: 'JobVideos',
  }
);

module.exports = JobVideo;
