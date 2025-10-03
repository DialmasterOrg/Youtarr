'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Add youtube_removed to Videos table
    await queryInterface.addColumn('Videos', 'youtube_removed', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });

    // Add youtube_removed to channelvideos table
    await queryInterface.addColumn('channelvideos', 'youtube_removed', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('Videos', 'youtube_removed');
    await queryInterface.removeColumn('channelvideos', 'youtube_removed');
  }
};
