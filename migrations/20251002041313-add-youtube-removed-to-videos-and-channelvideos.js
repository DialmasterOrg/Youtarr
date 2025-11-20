'use strict';

const { addColumnIfMissing, removeColumnIfExists } = require('./helpers');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Add youtube_removed to Videos table
    await addColumnIfMissing(queryInterface, 'Videos', 'youtube_removed', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });

    // Add youtube_removed to channelvideos table
    await addColumnIfMissing(queryInterface, 'channelvideos', 'youtube_removed', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
  },

  async down (queryInterface, Sequelize) {
    await removeColumnIfExists(queryInterface, 'Videos', 'youtube_removed');
    await removeColumnIfExists(queryInterface, 'channelvideos', 'youtube_removed');
  }
};
