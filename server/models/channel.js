const { Model, DataTypes } = require('sequelize');
const { sequelize } = require('../db');

class Channel extends Model {}

Channel.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    channel_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    url: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    uploader: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    lastFetched: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'Channel',
    timestamps: false,
    tableName: 'channels',
  }
);

module.exports = Channel;
