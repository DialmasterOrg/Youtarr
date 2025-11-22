'use strict';

const { addColumnIfMissing, removeColumnIfExists } = require('./helpers');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await addColumnIfMissing(queryInterface, 'channelvideos', 'live_status', {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: null,
    });
  },

  async down (queryInterface, Sequelize) {
    await removeColumnIfExists(queryInterface, 'channelvideos', 'live_status');
  }
};
