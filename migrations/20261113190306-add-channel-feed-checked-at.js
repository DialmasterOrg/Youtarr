'use strict';

const { addColumnIfMissing, removeColumnIfExists } = require('./helpers');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // When a valid YouTube feed last showed the channel had no unlisted
    // uploads, or its unlisted uploads were listed. Kept apart from
    // last_fetched_by_tab (real yt-dlp listings) so a quiet channel still
    // gets a real listing: feeds cannot show members-only uploads, title
    // changes or ended live streams.
    await addColumnIfMissing(queryInterface, 'channels', 'feed_checked_at', {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null
    });
  },

  async down (queryInterface) {
    await removeColumnIfExists(queryInterface, 'channels', 'feed_checked_at');
  }
};
