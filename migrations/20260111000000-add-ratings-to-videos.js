'use strict';

const { addColumnIfMissing } = require('./helpers');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Add rating-related columns to Videos table
    await addColumnIfMissing(queryInterface, 'Videos', 'content_rating', {
      type: Sequelize.JSON,
      allowNull: true,
      comment: 'Raw content rating object from YouTube/yt-dlp (e.g., {mpaaRating: "mpaaR", tvpgRating: "tvpg14"})',
    });

    await addColumnIfMissing(queryInterface, 'Videos', 'age_limit', {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: 'Age limit from yt-dlp (e.g., 18 for age-restricted content)',
    });

    await addColumnIfMissing(queryInterface, 'Videos', 'normalized_rating', {
      type: Sequelize.STRING(50),
      allowNull: true,
      comment: 'Normalized rating for Plex/Kodi (e.g., "R", "PG-13", "TV-14")',
    });

    await addColumnIfMissing(queryInterface, 'Videos', 'rating_source', {
      type: Sequelize.STRING(100),
      allowNull: true,
      comment: 'Source of the rating (e.g., "youtube:mpaaRating", "yt-dlp:age_limit")',
    });

    // Add index for filtering/sorting by normalized_rating
    try {
      await queryInterface.addIndex('Videos', ['normalized_rating'], {
        name: 'idx_normalized_rating',
      });
    } catch (err) {
      // Index may already exist
      console.log('Index on normalized_rating may already exist');
    }
  },

  async down (queryInterface, Sequelize) {
    // Remove index
    try {
      await queryInterface.removeIndex('Videos', 'idx_normalized_rating');
    } catch (err) {
      // Index may not exist
    }

    // Remove columns
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

    await removeColumnIfExists('Videos', 'rating_source');
    await removeColumnIfExists('Videos', 'normalized_rating');
    await removeColumnIfExists('Videos', 'age_limit');
    await removeColumnIfExists('Videos', 'content_rating');
  }
};
