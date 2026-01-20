'use strict';

const { addColumnIfMissing, removeColumnIfExists } = require('./helpers');

module.exports = {
  async up(queryInterface, Sequelize) {
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
      type: Sequelize.STRING(150),
      allowNull: true,
      comment: 'Source of the rating (e.g., "youtube:mpaaR", "yt-dlp:age_limit")',
    });

    await addColumnIfMissing(queryInterface, 'channelvideos', 'content_rating', {
      type: Sequelize.JSON,
      allowNull: true,
      comment: 'Raw content rating object for channel video entries',
    });

    await addColumnIfMissing(queryInterface, 'channelvideos', 'age_limit', {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: 'Age limit from yt-dlp for channel video entries',
    });

    await addColumnIfMissing(queryInterface, 'channelvideos', 'normalized_rating', {
      type: Sequelize.STRING(50),
      allowNull: true,
      comment: 'Normalized rating for channel video entries',
    });

    await addColumnIfMissing(queryInterface, 'channels', 'default_rating', {
      type: Sequelize.STRING(50),
      allowNull: true,
      comment: 'Optional default rating for unrated videos in this channel',
    });
  },

  async down(queryInterface) {
    await removeColumnIfExists(queryInterface, 'channels', 'default_rating');
    await removeColumnIfExists(queryInterface, 'channelvideos', 'normalized_rating');
    await removeColumnIfExists(queryInterface, 'channelvideos', 'age_limit');
    await removeColumnIfExists(queryInterface, 'channelvideos', 'content_rating');
    await removeColumnIfExists(queryInterface, 'Videos', 'rating_source');
    await removeColumnIfExists(queryInterface, 'Videos', 'normalized_rating');
    await removeColumnIfExists(queryInterface, 'Videos', 'age_limit');
    await removeColumnIfExists(queryInterface, 'Videos', 'content_rating');
  },
};
