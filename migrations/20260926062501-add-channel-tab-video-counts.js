'use strict';

const { addColumnIfMissing, removeColumnIfExists } = require('./helpers');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Per-tab YouTube video totals keyed by media type, for the download
    // percentage: {"video":{"total":449,"fetchedAt":"<ISO timestamp>"}}
    await addColumnIfMissing(queryInterface, 'channels', 'tab_video_counts', {
      type: Sequelize.TEXT,
      allowNull: true,
      defaultValue: null
    });
  },

  async down (queryInterface) {
    await removeColumnIfExists(queryInterface, 'channels', 'tab_video_counts');
  }
};
