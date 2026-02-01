'use strict';

const { addColumnIfMissing } = require('./helpers');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Create playlists table
    await queryInterface.createTable('playlists', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      playlist_id: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      title: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      url: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      uploader: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      uploader_id: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      folder_name: {
        type: Sequelize.STRING(255),
        allowNull: true,
        defaultValue: null,
      },
      lastFetched: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      },
      enabled: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      auto_download_enabled: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      sub_folder: {
        type: Sequelize.TEXT,
        allowNull: true,
        defaultValue: null,
      },
      video_quality: {
        type: Sequelize.TEXT,
        allowNull: true,
        defaultValue: null,
      },
      min_duration: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      max_duration: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      title_filter_regex: {
        type: Sequelize.TEXT,
        allowNull: true,
        defaultValue: null,
      },
      audio_format: {
        type: Sequelize.STRING(20),
        allowNull: true,
        defaultValue: null,
      },
    });

    // Create playlistvideos join table (similar to channelvideos)
    await queryInterface.createTable('playlistvideos', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      youtube_id: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      playlist_id: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      title: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      thumbnail: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      duration: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      publishedAt: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      availability: {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: null,
      },
      media_type: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'video',
      },
      youtube_removed: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      youtube_removed_checked_at: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      },
      playlist_index: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      ignored: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      ignored_at: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      },
    });

    // Add indexes for performance
    await queryInterface.addIndex('playlistvideos', ['playlist_id']);
    await queryInterface.addIndex('playlistvideos', ['youtube_id']);
    await queryInterface.addIndex('playlistvideos', ['playlist_id', 'youtube_id'], {
      unique: true,
      name: 'playlistvideos_unique_playlist_video'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('playlistvideos');
    await queryInterface.dropTable('playlists');
  }
};
