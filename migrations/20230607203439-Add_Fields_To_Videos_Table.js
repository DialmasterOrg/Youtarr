'use strict';

const { tableExists } = require('./helpers');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    if (!(await tableExists(queryInterface, 'Videos'))) {
      return;
    }

    // Get current table structure to check if columns already exist
    const tableDescription = await queryInterface.describeTable('Videos');

    // Add duration column only if it doesn't exist
    if (!tableDescription.duration) {
      await queryInterface.addColumn('Videos', 'duration', {
        type: Sequelize.INTEGER,
        allowNull: true, // Change to 'false' if the field should be required
      });
    }

    // Add originalDate column only if it doesn't exist
    if (!tableDescription.originalDate) {
      await queryInterface.addColumn('Videos', 'originalDate', {
        type: Sequelize.STRING,
        allowNull: true, // Change to 'false' if the field should be required
      });
    }

    // Add description column only if it doesn't exist
    if (!tableDescription.description) {
      await queryInterface.addColumn('Videos', 'description', {
        type: Sequelize.TEXT,
        allowNull: true, // Change to 'false' if the field should be required
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    if (!(await tableExists(queryInterface, 'Videos'))) {
      return;
    }

    // Get current table structure to check if columns exist before removing
    const tableDescription = await queryInterface.describeTable('Videos');

    if (tableDescription.duration) {
      await queryInterface.removeColumn('Videos', 'duration');
    }
    if (tableDescription.originalDate) {
      await queryInterface.removeColumn('Videos', 'originalDate');
    }
    if (tableDescription.description) {
      await queryInterface.removeColumn('Videos', 'description');
    }
  },
};
