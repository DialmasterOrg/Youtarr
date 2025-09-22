'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('channel_profiles', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      channel_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'channels',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      profile_name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      is_default: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      },
      destination_path: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      naming_template: {
        type: Sequelize.STRING(500),
        allowNull: true,
        defaultValue: '{series} - s{season:02d}e{episode:03d} - {title}',
      },
      season_number: {
        type: Sequelize.INTEGER,
        defaultValue: 1,
        allowNull: false,
      },
      episode_counter: {
        type: Sequelize.INTEGER,
        defaultValue: 1,
        allowNull: false,
      },
      generate_nfo: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      },
      enabled: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
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

    // Add indexes for performance
    await queryInterface.addIndex('channel_profiles', ['channel_id', 'enabled'], {
      name: 'idx_channel_enabled',
    });

    // Note: MySQL doesn't support partial indexes with WHERE clause
    // We enforce "only one default per channel" in application code through transactions
    // Just add a regular index for query performance
    await queryInterface.addIndex('channel_profiles', ['channel_id', 'is_default'], {
      name: 'idx_channel_default',
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('channel_profiles');
  },
};