'use strict';

const { createTableIfNotExists, dropTableIfExists } = require('./helpers');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await createTableIfNotExists(queryInterface, 'Jobs', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
      },
      jobType: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      status: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      output: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      timeInitiated: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      timeCreated: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });
  },

  down: async (queryInterface, Sequelize) => {
    await dropTableIfExists(queryInterface, 'Jobs');
  },
};
