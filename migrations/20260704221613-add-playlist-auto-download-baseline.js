'use strict';

const { addColumnIfMissing, removeColumnIfExists } = require('./helpers');

module.exports = {
  async up(queryInterface, Sequelize) {
    // NULL = playlist has never auto-downloaded. Deliberately no backfill:
    // the first auto run seeds (typically a no-op on caught-up playlists) and
    // stamps the baseline itself.
    await addColumnIfMissing(queryInterface, 'playlists', 'auto_download_baseline_at', {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null,
    });
  },

  async down(queryInterface) {
    await removeColumnIfExists(queryInterface, 'playlists', 'auto_download_baseline_at');
  },
};
