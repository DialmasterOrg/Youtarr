'use strict';

const { addColumnIfMissing, removeColumnIfExists } = require('./helpers');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add audioFilePath column to track MP3 file location separately from video file
    await addColumnIfMissing(queryInterface, 'Videos', 'audioFilePath', {
      type: Sequelize.STRING(500),
      allowNull: true,
      defaultValue: null
    });

    // Add audioFileSize column to track MP3 file size
    await addColumnIfMissing(queryInterface, 'Videos', 'audioFileSize', {
      type: Sequelize.BIGINT,
      allowNull: true,
      defaultValue: null
    });
  },

  async down(queryInterface, Sequelize) {
    await removeColumnIfExists(queryInterface, 'Videos', 'audioFilePath');
    await removeColumnIfExists(queryInterface, 'Videos', 'audioFileSize');
  }
};
