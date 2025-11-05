const { Model, DataTypes, Op } = require('sequelize');
const { sequelize } = require('../db');

class Session extends Model {
  // Class method to clean up expired sessions
  static async cleanupExpired() {
    await this.destroy({
      where: {
        expires_at: {
          [Op.lt]: new Date()
        }
      }
    });
  }
}

Session.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    session_token: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    user_agent: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    ip_address: {
      type: DataTypes.STRING(45),
      allowNull: true,
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    last_used_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
    }
  },
  {
    sequelize,
    modelName: 'Session',
    tableName: 'Sessions',
    timestamps: true,
    indexes: [
      { fields: ['session_token'] },
      { fields: ['expires_at'] },
      { fields: ['username'] }
    ]
  }
);

module.exports = Session;