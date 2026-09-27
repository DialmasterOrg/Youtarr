'use strict';

const { addColumnIfMissing, removeColumnIfExists } = require('./helpers');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // When a tab count lookup last started for the channel, successful or
    // not. Bulk refreshes rotate through channels oldest attempt first and
    // on-demand refreshes back off after a recent attempt, across restarts.
    await addColumnIfMissing(queryInterface, 'channels', 'tab_counts_attempted_at', {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null
    });
  },

  async down (queryInterface) {
    await removeColumnIfExists(queryInterface, 'channels', 'tab_counts_attempted_at');
  }
};
