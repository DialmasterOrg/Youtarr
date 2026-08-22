'use strict';

const { addColumnIfMissing, removeColumnIfExists } = require('./helpers');

module.exports = {
  async up(queryInterface, Sequelize) {
    await addColumnIfMissing(queryInterface, 'channels', 'auto_removal_protected', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await addColumnIfMissing(queryInterface, 'channels', 'auto_removal_keep_recent_count', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null,
    });
  },

  async down(queryInterface) {
    await removeColumnIfExists(queryInterface, 'channels', 'auto_removal_keep_recent_count');
    await removeColumnIfExists(queryInterface, 'channels', 'auto_removal_protected');
  },
};
