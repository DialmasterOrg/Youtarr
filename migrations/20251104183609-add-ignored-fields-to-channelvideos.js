'use strict';

const { addColumnIfMissing, removeColumnIfExists } = require('./helpers');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await addColumnIfMissing(queryInterface, 'channelvideos', 'ignored', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await addColumnIfMissing(queryInterface, 'channelvideos', 'ignored_at', {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null,
    });
  },

  async down (queryInterface, Sequelize) {
    await removeColumnIfExists(queryInterface, 'channelvideos', 'ignored_at');
    await removeColumnIfExists(queryInterface, 'channelvideos', 'ignored');
  }
};
