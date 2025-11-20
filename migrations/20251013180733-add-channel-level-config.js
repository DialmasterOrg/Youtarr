'use strict';

const { addColumnIfMissing, removeColumnIfExists } = require('./helpers');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Add sub_folder column to support grouping channels into subfolders
    await addColumnIfMissing(queryInterface, 'channels', 'sub_folder', {
      type: Sequelize.TEXT,
      allowNull: true,
      defaultValue: null
    });

    // Add video_quality column to support per-channel quality override
    await addColumnIfMissing(queryInterface, 'channels', 'video_quality', {
      type: Sequelize.TEXT,
      allowNull: true,
      defaultValue: null
    });
  },

  async down (queryInterface, Sequelize) {
    await removeColumnIfExists(queryInterface, 'channels', 'sub_folder');
    await removeColumnIfExists(queryInterface, 'channels', 'video_quality');
  }
};
