'use strict';

const { addColumnIfMissing, removeColumnIfExists } = require('./helpers');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Actual pixel dimensions of the downloaded video ("1080x1920"), measured
    // from the media file via ffprobe; display logic derives the tier label.
    // NULL = unknown (audio-only or not yet backfilled); "0x0" = probed but
    // undeterminable.
    await addColumnIfMissing(queryInterface, 'Videos', 'video_resolution', {
      type: Sequelize.STRING(20),
      allowNull: true,
      defaultValue: null
    });
  },

  async down(queryInterface, Sequelize) {
    await removeColumnIfExists(queryInterface, 'Videos', 'video_resolution');
  }
};
