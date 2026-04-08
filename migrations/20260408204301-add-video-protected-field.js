'use strict';

const { addColumnIfMissing, removeColumnIfExists } = require('../helpers');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await addColumnIfMissing(queryInterface, 'Videos', 'protected', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
  },

  down: async (queryInterface) => {
    await removeColumnIfExists(queryInterface, 'Videos', 'protected');
  },
};
