'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Add youtube_removed_checked_at column to channelvideos table
    await queryInterface.addColumn('channelvideos', 'youtube_removed_checked_at', {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null
    });

    // Add youtube_removed_checked_at column to Videos table
    await queryInterface.addColumn('Videos', 'youtube_removed_checked_at', {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null
    });
  },

  async down (queryInterface, Sequelize) {
    // Remove youtube_removed_checked_at column from ChannelVideos table
    await queryInterface.removeColumn('channelvideos', 'youtube_removed_checked_at');

    // Remove youtube_removed_checked_at column from Videos table
    await queryInterface.removeColumn('Videos', 'youtube_removed_checked_at');
  }
};
