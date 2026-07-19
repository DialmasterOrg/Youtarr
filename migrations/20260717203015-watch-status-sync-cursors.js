'use strict';

const { createTableIfNotExists, dropTableIfExists, addIndexIfMissing } = require('./helpers');

module.exports = {
  async up(queryInterface, Sequelize) {
    // Durable per-server sync cursor. Today only Plex uses it: the newest play
    // history event actually scanned, independent of whether events matched a
    // Youtarr video, so the incremental history fetch can never permanently
    // skip events. Deleting a row forces a full re-scan on the next sync.
    await createTableIfNotExists(queryInterface, 'watch_status_sync_cursors', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      server_type: { type: Sequelize.ENUM('plex', 'jellyfin', 'emby'), allowNull: false },
      cursor: { type: Sequelize.DATE, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    }, { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' });
    await addIndexIfMissing(queryInterface, 'watch_status_sync_cursors', ['server_type'], {
      unique: true,
      name: 'watch_status_sync_cursors_server_uq',
    });
  },

  async down(queryInterface) {
    await dropTableIfExists(queryInterface, 'watch_status_sync_cursors');
  },
};
