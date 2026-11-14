'use strict';

const { createTableIfNotExists, addIndexIfMissing, dropTableIfExists } = require('./helpers');

module.exports = {
  async up(queryInterface, Sequelize) {
    // One row per members-only video Youtarr has seen. A row is itself the
    // signal that the video is members-only, even from an untracked channel.
    await createTableIfNotExists(queryInterface, 'video_members_access', {
      youtube_id: { type: Sequelize.STRING(20), primaryKey: true, allowNull: false },
      // confirmed | denied, or NULL when no verdict was recorded (no cookies,
      // or the cookies had stopped working).
      access: { type: Sequelize.STRING(16), allowNull: true },
      // SHA-256 of the cookie file the verdict was made with; a verdict only
      // counts while the same cookies are configured.
      cookie_key: { type: Sequelize.STRING(64), allowNull: true },
      checked_at: { type: Sequelize.DATE, allowNull: true },
    }, { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' });

    await addIndexIfMissing(queryInterface, 'video_members_access', ['access', 'checked_at'], {
      name: 'video_members_access_access_checked_idx',
    });
  },

  async down(queryInterface) {
    await dropTableIfExists(queryInterface, 'video_members_access');
  },
};
