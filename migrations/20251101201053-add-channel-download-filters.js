'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Add min_duration column for filtering videos by minimum duration (in seconds)
    await queryInterface.addColumn('channels', 'min_duration', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null
    });

    // Add max_duration column for filtering videos by maximum duration (in seconds)
    await queryInterface.addColumn('channels', 'max_duration', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null
    });

    // Add title_filter_regex column for filtering videos by title using regex
    await queryInterface.addColumn('channels', 'title_filter_regex', {
      type: Sequelize.TEXT,
      allowNull: true,
      defaultValue: null
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('channels', 'min_duration');
    await queryInterface.removeColumn('channels', 'max_duration');
    await queryInterface.removeColumn('channels', 'title_filter_regex');
  }
};
