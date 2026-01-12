'use strict';

const { addColumnIfMissing } = require('./helpers');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Add default rating to Channels table
    await addColumnIfMissing(queryInterface, 'channels', 'default_rating', {
      type: Sequelize.STRING(50),
      allowNull: true,
      defaultValue: null,
      comment: 'Default rating to apply to unrated videos in this channel (e.g., "R", "PG-13", "TV-14")',
    });
  },

  async down (queryInterface, Sequelize) {
    const removeColumnIfExists = async (table, column) => {
      try {
        const columns = await queryInterface.describeTable(table);
        if (columns[column]) {
          await queryInterface.removeColumn(table, column);
        }
      } catch (err) {
        // Column may not exist
      }
    };

    await removeColumnIfExists('channels', 'default_rating');
  }
};
