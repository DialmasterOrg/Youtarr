'use strict';

const { addColumnIfMissing, removeColumnIfExists } = require('./helpers');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Add additional_tags column for adding additional tags to downloaded videos
    await addColumnIfMissing(queryInterface, 'channels', 'additional_tags', {
      type: Sequelize.TEXT,
      allowNull: true,
      defaultValue: null
    });
  },

  async down (queryInterface, Sequelize) {
    await removeColumnIfExists(queryInterface, 'channels', 'additional_tags');
  }
};
