'use strict';

const { addColumnIfMissing, removeColumnIfExists } = require('./helpers');

module.exports = {
  async up(queryInterface, Sequelize) {
    // 'default' keeps YouTube's playlist order; 'reversed' flips it for the .m3u and media server sync.
    await addColumnIfMissing(queryInterface, 'playlists', 'sort_order', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'default',
    });
  },

  async down(queryInterface) {
    await removeColumnIfExists(queryInterface, 'playlists', 'sort_order');
  },
};
