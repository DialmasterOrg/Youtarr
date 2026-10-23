const { Model, DataTypes } = require('sequelize');
const { sequelize } = require('../db');

class VideoClassification extends Model {}

VideoClassification.init(
  {
    youtube_id: { type: DataTypes.STRING(20), primaryKey: true, allowNull: false },
    channel_id: { type: DataTypes.STRING(64), allowNull: false },
    show_id: { type: DataTypes.INTEGER, allowNull: false },
    status: { type: DataTypes.STRING(16), allowNull: false },
    season: { type: DataTypes.INTEGER, allowNull: true },
    episode: { type: DataTypes.INTEGER, allowNull: true },
    source: { type: DataTypes.STRING(16), allowNull: true },
    timestamp_source: { type: DataTypes.STRING(16), allowNull: true },
    pattern_id: { type: DataTypes.INTEGER, allowNull: true },
    episode_title: { type: DataTypes.STRING(512), allowNull: true },
    file_stem: { type: DataTypes.STRING(255), allowNull: true },
    title_opt_out: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  },
  {
    sequelize,
    modelName: 'VideoClassification',
    tableName: 'video_classifications',
    timestamps: true,
    underscored: true,
  }
);

module.exports = VideoClassification;
