'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('channels', 'skip_video_folder', {
      type: Sequelize.BOOLEAN,
      allowNull: true,
      defaultValue: null,
      comment: 'When true, videos are stored directly in the channel folder without per-video subfolders',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('channels', 'skip_video_folder');
  }
};
