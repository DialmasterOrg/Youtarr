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
    // Add filePath column
    await addColumnIfMissing(queryInterface, 'Videos', 'filePath', {
      type: Sequelize.STRING(500),
      allowNull: true
    });

    // Add fileSize column (BIGINT for large files)
    await addColumnIfMissing(queryInterface, 'Videos', 'fileSize', {
      type: Sequelize.BIGINT,
      allowNull: true
    });

    // Add removed column to track if file still exists on disk
    await addColumnIfMissing(queryInterface, 'Videos', 'removed', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });

    // Add indexes for better query performance
    await addIndexIfMissing(queryInterface, 'Videos', ['originalDate']);
    await addIndexIfMissing(queryInterface, 'Videos', ['removed']);

    // Add composite index for common sorting pattern
    await addIndexIfMissing(queryInterface, 'Videos', [
      { attribute: 'removed', order: 'ASC' },
      { attribute: 'originalDate', order: 'DESC' }
    ]);
  },

  async down (queryInterface, Sequelize) {
    // Remove indexes first
    await removeIndexIfExists(queryInterface, 'Videos', ['originalDate']);
    await removeIndexIfExists(queryInterface, 'Videos', ['removed']);
    await removeIndexIfExists(queryInterface, 'Videos', ['removed', 'originalDate']);

    // Remove columns
    await removeColumnIfExists(queryInterface, 'Videos', 'filePath');
    await removeColumnIfExists(queryInterface, 'Videos', 'fileSize');
    await removeColumnIfExists(queryInterface, 'Videos', 'removed');
  }
};
