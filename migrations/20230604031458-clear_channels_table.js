'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('channels', null, {});
  },

  async down(queryInterface, Sequelize) {},
};
