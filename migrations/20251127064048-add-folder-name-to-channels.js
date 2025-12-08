'use strict';

const { addColumnIfMissing, removeColumnIfExists } = require('./helpers');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add folder_name column to store the actual sanitized folder name created by yt-dlp
    // This is needed because yt-dlp sanitizes channel names with --windows-filenames flag,
    // and the sanitized name may differ from the raw uploader name stored in the database
    await addColumnIfMissing(queryInterface, 'channels', 'folder_name', {
      type: Sequelize.STRING(255),
      allowNull: true,
      defaultValue: null,
    });
  },

  async down(queryInterface) {
    await removeColumnIfExists(queryInterface, 'channels', 'folder_name');
  },
};
