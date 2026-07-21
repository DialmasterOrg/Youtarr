'use strict';

const { addColumnIfMissing, removeColumnIfExists } = require('./helpers');

module.exports = {
  async up(queryInterface, Sequelize) {
    await addColumnIfMissing(queryInterface, 'channels', 'm3u_enabled', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await addColumnIfMissing(queryInterface, 'channels', 'm3u_sort_order', {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: 'oldest_first',
    });
  },

  async down(queryInterface) {
    await removeColumnIfExists(queryInterface, 'channels', 'm3u_sort_order');
    await removeColumnIfExists(queryInterface, 'channels', 'm3u_enabled');
  },
};
