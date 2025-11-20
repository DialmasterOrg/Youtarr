'use strict';

const {
  addColumnIfMissing,
  removeColumnIfExists,
  addIndexIfMissing,
  removeIndexIfExists
} = require('./helpers');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Add last_downloaded_at column - nullable for backwards compatibility
    await addColumnIfMissing(queryInterface, 'Videos', 'last_downloaded_at', {
      type: Sequelize.DATE,
      allowNull: true
    });

    // Add index for better query performance when sorting by download date
    await addIndexIfMissing(queryInterface, 'Videos', ['last_downloaded_at']);
  },

  async down (queryInterface, Sequelize) {
    // Remove index first
    await removeIndexIfExists(queryInterface, 'Videos', ['last_downloaded_at']);

    // Remove column
    await removeColumnIfExists(queryInterface, 'Videos', 'last_downloaded_at');
  }
};
