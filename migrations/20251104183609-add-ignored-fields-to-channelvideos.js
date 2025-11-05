'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('channelvideos', 'ignored', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.addColumn('channelvideos', 'ignored_at', {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null,
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('channelvideos', 'ignored_at');
    await queryInterface.removeColumn('channelvideos', 'ignored');
  }
};
