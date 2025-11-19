'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Add last_downloaded_at column - nullable for backwards compatibility
    await queryInterface.addColumn('Videos', 'last_downloaded_at', {
      type: Sequelize.DATE,
      allowNull: true
    });

    // Add index for better query performance when sorting by download date
    await queryInterface.addIndex('Videos', ['last_downloaded_at']);
  },

  async down (queryInterface, Sequelize) {
    // Remove index first
    await queryInterface.removeIndex('Videos', ['last_downloaded_at']);

    // Remove column
    await queryInterface.removeColumn('Videos', 'last_downloaded_at');
  }
};
