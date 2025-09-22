'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('video_profile_mappings', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      video_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Videos',
          key: 'id',
        },
        onDelete: 'CASCADE',
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
      season: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      episode: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      processed_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false,
      },
    });

    // Ensure each video is only mapped to one profile
    await queryInterface.addIndex('video_profile_mappings', ['video_id', 'profile_id'], {
      name: 'unique_video_profile',
      unique: true,
    });

    // Index for efficient lookups
    await queryInterface.addIndex('video_profile_mappings', ['profile_id'], {
      name: 'idx_profile_mapping',
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('video_profile_mappings');
  },
};