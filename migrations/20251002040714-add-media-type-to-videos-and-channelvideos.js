'use strict';

const { addColumnIfMissing, removeColumnIfExists } = require('./helpers');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add media_type to Videos table
    await addColumnIfMissing(queryInterface, 'Videos', 'media_type', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'video'
    });

    // Add media_type to channelvideos table
    await addColumnIfMissing(queryInterface, 'channelvideos', 'media_type', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'video'
    });
  },

  async down(queryInterface, Sequelize) {
    await removeColumnIfExists(queryInterface, 'Videos', 'media_type');
    await removeColumnIfExists(queryInterface, 'channelvideos', 'media_type');
  }
};
