'use strict';

const { createTableIfNotExists, dropTableIfExists } = require('./helpers');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await createTableIfNotExists(queryInterface, 'Videos', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      youtubeId: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      youTubeChannelName: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      youTubeVideoName: {
        type: Sequelize.STRING,
        allowNull: false,
      },
    });
  },

  down: async (queryInterface, Sequelize) => {
    await dropTableIfExists(queryInterface, 'Videos');
  },
};
