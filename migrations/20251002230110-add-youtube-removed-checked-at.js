'use strict';

const { addColumnIfMissing, removeColumnIfExists } = require('./helpers');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Add youtube_removed_checked_at column to channelvideos table
    await addColumnIfMissing(queryInterface, 'channelvideos', 'youtube_removed_checked_at', {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null
    });

    // Add youtube_removed_checked_at column to Videos table
    await addColumnIfMissing(queryInterface, 'Videos', 'youtube_removed_checked_at', {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null
    });
  },

  async down (queryInterface, Sequelize) {
    // Remove youtube_removed_checked_at column from ChannelVideos table
    await removeColumnIfExists(queryInterface, 'channelvideos', 'youtube_removed_checked_at');

    // Remove youtube_removed_checked_at column from Videos table
    await removeColumnIfExists(queryInterface, 'Videos', 'youtube_removed_checked_at');
  }
};
