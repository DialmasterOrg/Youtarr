'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Videos', 'channel_id', {
      type: Sequelize.STRING,
      allowNull: true, // Change to 'false' if the field should be required
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Videos', 'channel_id');
  },
};
