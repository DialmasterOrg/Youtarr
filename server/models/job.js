const { Model, DataTypes } = require('sequelize');

const { sequelize } = require('../db');

class Job extends Model {}

Job.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
      primaryKey: true,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    output: {
      type: DataTypes.TEXT('medium'),
      allowNull: true,
    },
    timeInitiated: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    timeCreated: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    jobType: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    aux_data: {
      type: DataTypes.TEXT('medium'),
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'Job',
    tableName: 'jobs',
    timestamps: false,
    underscored: true,
  }
);

module.exports = Job;
