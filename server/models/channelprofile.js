const { Model, DataTypes } = require('sequelize');
const { sequelize } = require('../db');

class ChannelProfile extends Model {}

ChannelProfile.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    channel_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    profile_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    series_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    is_default: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    destination_path: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    naming_template: {
      type: DataTypes.STRING(500),
      allowNull: true,
      defaultValue: '{series} - s{season:02d}e{episode:03d} - {title}',
    },
    season_number: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
      allowNull: false,
    },
    episode_counter: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
      allowNull: false,
    },
    generate_nfo: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    enabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: 'ChannelProfile',
    tableName: 'channel_profiles',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

module.exports = ChannelProfile;