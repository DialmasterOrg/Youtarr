'use strict';

const { tableExists } = require('./helpers');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await tableExists(queryInterface, 'channels'))) {
      return;
    }

    await queryInterface.bulkDelete('channels', null, {});
  },

  async down(queryInterface, Sequelize) {},
};
