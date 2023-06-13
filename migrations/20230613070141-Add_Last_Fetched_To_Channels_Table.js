'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('channels', 'lastFetched', {
      type: Sequelize.DATE,
      allowNull: true, // Change to 'false' if the field should be required
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('channels', 'lastFetched');
  },
};
