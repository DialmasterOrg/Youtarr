'use strict';

const { addColumnIfMissing } = require('./helpers');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Add rating-related columns to channelvideos table
    await addColumnIfMissing(queryInterface, 'channelvideos', 'content_rating', {
      type: Sequelize.JSON,
      allowNull: true,
      comment: 'Raw content rating object from YouTube/yt-dlp',
    });

    await addColumnIfMissing(queryInterface, 'channelvideos', 'age_limit', {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: 'Age limit from yt-dlp',
    });

    await addColumnIfMissing(queryInterface, 'channelvideos', 'normalized_rating', {
      type: Sequelize.STRING(50),
      allowNull: true,
      comment: 'Normalized rating for Plex/Kodi (e.g., "R", "PG-13", "TV-14")',
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

    await removeColumnIfExists('channelvideos', 'normalized_rating');
    await removeColumnIfExists('channelvideos', 'age_limit');
    await removeColumnIfExists('channelvideos', 'content_rating');
  }
};
