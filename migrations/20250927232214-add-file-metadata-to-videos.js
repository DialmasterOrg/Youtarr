'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Add filePath column
    await queryInterface.addColumn('Videos', 'filePath', {
      type: Sequelize.STRING(500),
      allowNull: true
    });

    // Add fileSize column (BIGINT for large files)
    await queryInterface.addColumn('Videos', 'fileSize', {
      type: Sequelize.BIGINT,
      allowNull: true
    });

    // Add removed column to track if file still exists on disk
    await queryInterface.addColumn('Videos', 'removed', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });

    // Add indexes for better query performance
    await queryInterface.addIndex('Videos', ['originalDate']);
    await queryInterface.addIndex('Videos', ['removed']);

    // Add composite index for common sorting pattern
    await queryInterface.addIndex('Videos', [
      { attribute: 'removed', order: 'ASC' },
      { attribute: 'originalDate', order: 'DESC' }
    ]);
  },

  async down (queryInterface, Sequelize) {
    // Remove indexes first
    await queryInterface.removeIndex('Videos', ['originalDate']);
    await queryInterface.removeIndex('Videos', ['removed']);
    await queryInterface.removeIndex('Videos', ['removed', 'originalDate']);

    // Remove columns
    await queryInterface.removeColumn('Videos', 'filePath');
    await queryInterface.removeColumn('Videos', 'fileSize');
    await queryInterface.removeColumn('Videos', 'removed');
  }
};
