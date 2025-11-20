'use strict';

const { addColumnIfMissing, removeColumnIfExists } = require('./helpers');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Add min_duration column for filtering videos by minimum duration (in seconds)
    await addColumnIfMissing(queryInterface, 'channels', 'min_duration', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null
    });

    // Add max_duration column for filtering videos by maximum duration (in seconds)
    await addColumnIfMissing(queryInterface, 'channels', 'max_duration', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null
    });

    // Add title_filter_regex column for filtering videos by title using regex
    await addColumnIfMissing(queryInterface, 'channels', 'title_filter_regex', {
      type: Sequelize.TEXT,
      allowNull: true,
      defaultValue: null
    });
  },

  async down (queryInterface, Sequelize) {
    await removeColumnIfExists(queryInterface, 'channels', 'min_duration');
    await removeColumnIfExists(queryInterface, 'channels', 'max_duration');
    await removeColumnIfExists(queryInterface, 'channels', 'title_filter_regex');
  }
};
