const { Model, DataTypes } = require('sequelize');
const { sequelize } = require('../db');

class TvShow extends Model {}

TvShow.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
    // YouTube channel id of the owner (not a foreign key: untracked channels get shows too).
    channel_id: { type: DataTypes.STRING(64), allowNull: false },
    kind: { type: DataTypes.STRING(16), allowNull: false },
    name: { type: DataTypes.STRING(255), allowNull: false },
    folder_name: { type: DataTypes.STRING(255), allowNull: false },
    // '' = main downloads folder, else the subfolder name without __.
    library_folder: { type: DataTypes.STRING(100), allowNull: false, defaultValue: '' },
    position: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    exclude_terms: { type: DataTypes.TEXT, allowNull: true },
    poster_source: { type: DataTypes.STRING(255), allowNull: true },
    external_key: { type: DataTypes.STRING(64), allowNull: false },
    previous_videos_folder: { type: DataTypes.STRING(255), allowNull: true },
    retired_at: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    modelName: 'TvShow',
    tableName: 'tv_shows',
    timestamps: true,
    underscored: true,
  }
);

module.exports = TvShow;
