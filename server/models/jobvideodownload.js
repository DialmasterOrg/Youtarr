const { Model, DataTypes } = require('sequelize');
const { sequelize } = require('../db');

class JobVideoDownload extends Model {}

JobVideoDownload.init(
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
      onDelete: 'CASCADE',
    },
    youtube_id: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    file_path: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('in_progress', 'completed'),
      allowNull: false,
      defaultValue: 'in_progress',
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'JobVideoDownload',
    timestamps: false,
    tableName: 'JobVideoDownloads',
    indexes: [
      {
        fields: ['job_id']
      },
      {
        fields: ['status']
      },
      {
        unique: true,
        fields: ['job_id', 'youtube_id'],
        name: 'jobvideodownloads_job_video_unique'
      }
    ]
  }
);

module.exports = JobVideoDownload;
