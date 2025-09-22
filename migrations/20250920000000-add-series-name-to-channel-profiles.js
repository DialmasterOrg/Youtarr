'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('channel_profiles', 'series_name', {
      type: Sequelize.STRING(255),
      allowNull: true,
      after: 'profile_name',
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('channel_profiles', 'series_name');
  },
};