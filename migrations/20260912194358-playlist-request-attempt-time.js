'use strict';

const { addColumnIfMissing, removeColumnIfExists } = require('./helpers');

module.exports = {
  async up(queryInterface, Sequelize) {
    // Existing requests have no known attempt time and join the bounded retry
    // pool. Do not infer attempts from discovery or download dates.
    await addColumnIfMissing(queryInterface, 'playlistvideos', 'auto_download_last_attempt_at', {
      type: Sequelize.DATE(3), allowNull: true,
    });
  },

  async down(queryInterface) {
    await removeColumnIfExists(queryInterface, 'playlistvideos', 'auto_download_last_attempt_at');
  },
};
