'use strict';

const {
  createTableIfNotExists,
  dropTableIfExists,
  addIndexIfMissing,
  removeIndexIfExists,
} = require('./helpers');

module.exports = {
  async up(queryInterface, Sequelize) {
    await createTableIfNotExists(queryInterface, 'media_server_users', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      server_type: { type: Sequelize.ENUM('plex', 'jellyfin', 'emby'), allowNull: false },
      server_user_id: { type: Sequelize.STRING, allowNull: false },
      server_user_name: { type: Sequelize.STRING, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    }, { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' });
    await addIndexIfMissing(queryInterface, 'media_server_users', ['server_type', 'server_user_id'], {
      unique: true,
      name: 'media_server_users_server_user_uq',
    });

    // Existing Plex rows were written from the admin listing with a NULL user;
    // the server-local owner accountID is 1 (matches /accounts and the history
    // endpoint), so stamp them as the owner's rows.
    await queryInterface.sequelize.query(
      "UPDATE video_watch_status SET server_user_id = '1' WHERE server_type = 'plex' AND server_user_id IS NULL"
    );
    // NOT NULL: MariaDB unique indexes never treat NULLs as equal, so a
    // nullable column in the new unique key would allow duplicate rows.
    await queryInterface.changeColumn('video_watch_status', 'server_user_id', {
      type: Sequelize.STRING,
      allowNull: false,
    });
    // Widen the upsert key to one row per (video, server, user). Add the new
    // index before dropping the old one so the table is never without a
    // unique key for updateOnDuplicate.
    await addIndexIfMissing(queryInterface, 'video_watch_status',
      ['video_id', 'server_type', 'server_user_id'],
      { unique: true, name: 'video_watch_status_video_server_user_uq' });
    await removeIndexIfExists(queryInterface, 'video_watch_status', 'video_watch_status_video_server_uq');
  },

  async down(queryInterface, Sequelize) {
    await dropTableIfExists(queryInterface, 'media_server_users');
    // Collapse to one row per (video, server) before restoring the old key.
    await queryInterface.sequelize.query(
      'DELETE w1 FROM video_watch_status w1 JOIN video_watch_status w2 ' +
      'ON w1.video_id = w2.video_id AND w1.server_type = w2.server_type AND w1.id > w2.id'
    );
    await removeIndexIfExists(queryInterface, 'video_watch_status', 'video_watch_status_video_server_user_uq');
    await addIndexIfMissing(queryInterface, 'video_watch_status', ['video_id', 'server_type'], {
      unique: true,
      name: 'video_watch_status_video_server_uq',
    });
    await queryInterface.changeColumn('video_watch_status', 'server_user_id', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },
};
