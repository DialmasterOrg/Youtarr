'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('Sessions', {
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
    await queryInterface.addIndex('Sessions', ['session_token']);
    await queryInterface.addIndex('Sessions', ['expires_at']);
    await queryInterface.addIndex('Sessions', ['username']);
    await queryInterface.addIndex('Sessions', ['is_active', 'expires_at']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('Sessions');
  }
};