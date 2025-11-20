'use strict';

const { addColumnIfMissing, removeColumnIfExists } = require('./helpers');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add available_tabs column to store which tab types the channel has (videos, shorts, streams)
    await addColumnIfMissing(queryInterface, 'channels', 'available_tabs', {
      type: Sequelize.TEXT,
      allowNull: true,
      defaultValue: null
    });

    // Add auto_download_enabled_tabs column to store which tabs to fetch during automated downloads
    // Default to 'video' to maintain current behavior
    await addColumnIfMissing(queryInterface, 'channels', 'auto_download_enabled_tabs', {
      type: Sequelize.TEXT,
      allowNull: false,
      defaultValue: 'video'
    });

    // Backfill existing channels with 'video' for auto_download_enabled_tabs
    await queryInterface.sequelize.query(
      "UPDATE channels SET auto_download_enabled_tabs = 'video' WHERE auto_download_enabled_tabs IS NULL OR auto_download_enabled_tabs = ''"
    );
  },

  async down(queryInterface, Sequelize) {
    await removeColumnIfExists(queryInterface, 'channels', 'available_tabs');
    await removeColumnIfExists(queryInterface, 'channels', 'auto_download_enabled_tabs');
  }
};
