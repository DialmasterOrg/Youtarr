'use strict';

const { addColumnIfMissing, removeColumnIfExists } = require('./helpers');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await addColumnIfMissing(queryInterface, 'Videos', 'channel_id', {
      type: Sequelize.STRING,
      allowNull: true, // Change to 'false' if the field should be required
    });
  },

  down: async (queryInterface, Sequelize) => {
    await removeColumnIfExists(queryInterface, 'Videos', 'channel_id');
  },
};
