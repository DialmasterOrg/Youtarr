'use strict';

const { createTableIfNotExists, addIndexIfMissing, dropTableIfExists } = require('./helpers');

module.exports = {
  async up(queryInterface, Sequelize) {
    await createTableIfNotExists(queryInterface, 'video_watch_status', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      video_id: { type: Sequelize.INTEGER, allowNull: false },
      server_type: { type: Sequelize.ENUM('plex', 'jellyfin', 'emby'), allowNull: false },
      // Which media-server account the state belongs to. Null for Plex (admin
      // account). Reserved for future multi-user support; v1 stores the single
      // configured jellyfinUserId/embyUserId.
      server_user_id: { type: Sequelize.STRING, allowNull: true },
      played: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      play_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      position_ms: { type: Sequelize.BIGINT, allowNull: true },
      percent_watched: { type: Sequelize.FLOAT, allowNull: true },
      last_watched_at: { type: Sequelize.DATE, allowNull: true },
      last_synced_at: { type: Sequelize.DATE, allowNull: false },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    }, { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' });

    await addIndexIfMissing(queryInterface, 'video_watch_status', ['video_id', 'server_type'], {
      unique: true,
      name: 'video_watch_status_video_server_uq',
    });
  },

  async down(queryInterface) {
    await dropTableIfExists(queryInterface, 'video_watch_status');
  },
};
