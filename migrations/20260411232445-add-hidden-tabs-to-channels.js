'use strict';

const { addColumnIfMissing, removeColumnIfExists } = require('./helpers');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add hidden_tabs column to store user-selected tabs that should be hidden
    // from the UI even when YouTube reports them as available. Comma-separated
    // list of tab types ('videos', 'shorts', 'streams'). Null means nothing hidden.
    await addColumnIfMissing(queryInterface, 'channels', 'hidden_tabs', {
      type: Sequelize.TEXT,
      allowNull: true,
      defaultValue: null
    });
  },

  async down(queryInterface, Sequelize) {
    await removeColumnIfExists(queryInterface, 'channels', 'hidden_tabs');
  }
};
