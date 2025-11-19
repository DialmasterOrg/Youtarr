'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add media_type to Videos table
    await queryInterface.addColumn('Videos', 'media_type', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'video'
    });

    // Add media_type to channelvideos table
    await queryInterface.addColumn('channelvideos', 'media_type', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'video'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Videos', 'media_type');
    await queryInterface.removeColumn('channelvideos', 'media_type');
  }
};
