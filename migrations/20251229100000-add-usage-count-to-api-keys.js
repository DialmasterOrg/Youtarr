'use strict';

const { addColumnIfNotExists } = require('./helpers');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await addColumnIfNotExists(queryInterface, 'ApiKeys', 'usage_count', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
  },

  async down(queryInterface) {
    const tableDescription = await queryInterface.describeTable('ApiKeys');
    if (tableDescription.usage_count) {
      await queryInterface.removeColumn('ApiKeys', 'usage_count');
    }
  },
};

