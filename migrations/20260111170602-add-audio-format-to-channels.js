'use strict';

const { addColumnIfMissing, removeColumnIfExists } = require('./helpers');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add audio_format column to support per-channel audio format setting
    // Values: null (video only - default), 'video_mp3' (video + mp3), 'mp3_only' (audio only)
    await addColumnIfMissing(queryInterface, 'channels', 'audio_format', {
      type: Sequelize.STRING(20),
      allowNull: true,
      defaultValue: null
    });
  },

  async down(queryInterface, Sequelize) {
    await removeColumnIfExists(queryInterface, 'channels', 'audio_format');
  }
};
