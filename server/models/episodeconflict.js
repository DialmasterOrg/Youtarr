const { Model, DataTypes } = require('sequelize');
const { sequelize } = require('../db');

class EpisodeConflict extends Model {}

EpisodeConflict.init(
  {
    youtube_id: { type: DataTypes.STRING(20), primaryKey: true, allowNull: false },
    channel_id: { type: DataTypes.STRING(64), allowNull: false },
    show_id: { type: DataTypes.INTEGER, allowNull: true },
    // duplicate | classification_error | released
    kind: { type: DataTypes.STRING(24), allowNull: false },
    duplicate_of: { type: DataTypes.STRING(20), allowNull: true },
    // Youtarr set the video's ignore flag (so only Youtarr takes it back).
    youtarr_ignored: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    // Youtarr wrote the video's complete.list line (it wasn't there before).
    archive_suppressed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    // add | remove: a complete.list write waiting for the download queue to be idle
    archive_pending: { type: DataTypes.STRING(8), allowNull: true },
    details: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    sequelize,
    modelName: 'EpisodeConflict',
    tableName: 'episode_conflicts',
    timestamps: true,
    underscored: true,
  }
);

module.exports = EpisodeConflict;
