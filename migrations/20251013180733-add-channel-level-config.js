'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Add sub_folder column to support grouping channels into subfolders
    await queryInterface.addColumn('channels', 'sub_folder', {
      type: Sequelize.TEXT,
      allowNull: true,
      defaultValue: null
    });

    // Add video_quality column to support per-channel quality override
    await queryInterface.addColumn('channels', 'video_quality', {
      type: Sequelize.TEXT,
      allowNull: true,
      defaultValue: null
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('channels', 'sub_folder');
    await queryInterface.removeColumn('channels', 'video_quality');
  }
};
