'use strict';

const {
  createTableIfNotExists,
  dropTableIfExists,
  addIndexIfMissing
} = require('./helpers');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await createTableIfNotExists(queryInterface, 'Sessions', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      session_token: {
        type: Sequelize.STRING(255),
        unique: true,
        allowNull: false
      },
      username: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      user_agent: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      ip_address: {
        type: Sequelize.STRING(45),
        allowNull: true
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: false
      },
      last_used_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    });
    
    // Add indexes for performance
    await addIndexIfMissing(queryInterface, 'Sessions', ['session_token']);
    await addIndexIfMissing(queryInterface, 'Sessions', ['expires_at']);
    await addIndexIfMissing(queryInterface, 'Sessions', ['username']);
    await addIndexIfMissing(queryInterface, 'Sessions', ['is_active', 'expires_at']);
  },

  down: async (queryInterface, Sequelize) => {
    await dropTableIfExists(queryInterface, 'Sessions');
  }
};
