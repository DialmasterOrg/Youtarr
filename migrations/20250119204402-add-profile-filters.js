'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('profile_filters', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      profile_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'channel_profiles',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      filter_type: {
        type: Sequelize.ENUM('title_regex', 'title_contains', 'duration_range'),
        allowNull: false,
      },
      filter_value: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      priority: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false,
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false,
      },
    });

    // Add index for efficient filter lookup
    await queryInterface.addIndex('profile_filters', ['profile_id', 'priority'], {
      name: 'idx_profile_priority',
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('profile_filters');
  },
};