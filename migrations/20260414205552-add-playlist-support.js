'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('playlists', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      playlist_id: { type: Sequelize.STRING, allowNull: false },
      title: { type: Sequelize.STRING, allowNull: true },
      url: { type: Sequelize.STRING, allowNull: true },
      description: { type: Sequelize.TEXT, allowNull: true },
      uploader: { type: Sequelize.STRING, allowNull: true },
      thumbnail: { type: Sequelize.STRING, allowNull: true },
      video_count: { type: Sequelize.INTEGER, allowNull: true, defaultValue: 0 },
      enabled: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      auto_download: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      sync_to_plex: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      sync_to_jellyfin: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      sync_to_emby: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      public_on_servers: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      default_sub_folder: { type: Sequelize.STRING, allowNull: true },
      video_quality: { type: Sequelize.TEXT, allowNull: true },
      min_duration: { type: Sequelize.INTEGER, allowNull: true },
      max_duration: { type: Sequelize.INTEGER, allowNull: true },
      title_filter_regex: { type: Sequelize.TEXT, allowNull: true },
      audio_format: { type: Sequelize.STRING, allowNull: true },
      default_rating: { type: Sequelize.STRING, allowNull: true },
      lastFetched: { type: Sequelize.DATE, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    }, { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' });

    await queryInterface.addIndex('playlists', ['playlist_id'], {
      unique: true,
      name: 'playlists_playlist_id_uq',
    });
    await queryInterface.addIndex('playlists', ['enabled'], { name: 'playlists_enabled_idx' });

    await queryInterface.createTable('playlistvideos', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      playlist_id: { type: Sequelize.STRING, allowNull: false },
      youtube_id: { type: Sequelize.STRING, allowNull: false },
      position: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      added_at: { type: Sequelize.DATE, allowNull: true },
      channel_id: { type: Sequelize.STRING, allowNull: true },
      ignored: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      ignored_at: { type: Sequelize.DATE, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    }, { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' });

    await queryInterface.addIndex('playlistvideos', ['playlist_id', 'youtube_id'], {
      unique: true,
      name: 'playlistvideos_playlist_youtube_uq',
    });
    await queryInterface.addIndex('playlistvideos', ['youtube_id'], {
      name: 'playlistvideos_youtube_id_idx',
    });
    await queryInterface.addIndex('playlistvideos', ['playlist_id', 'position'], {
      name: 'playlistvideos_playlist_position_idx',
    });

    await queryInterface.createTable('playlist_sync_state', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      playlist_id: { type: Sequelize.INTEGER, allowNull: false },
      server_type: { type: Sequelize.ENUM('plex', 'jellyfin', 'emby'), allowNull: false },
      server_playlist_id: { type: Sequelize.STRING, allowNull: true },
      last_synced_at: { type: Sequelize.DATE, allowNull: true },
      last_error: { type: Sequelize.TEXT, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    }, { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' });

    await queryInterface.addIndex('playlist_sync_state', ['playlist_id', 'server_type'], {
      unique: true,
      name: 'playlist_sync_state_playlist_server_uq',
    });

    // Safety check — surface any existing channel sub_folder values that would collide with the reserved name
    const [conflicts] = await queryInterface.sequelize.query(
      "SELECT id, url, sub_folder FROM channels WHERE LOWER(sub_folder) = 'playlists'"
    );
    if (conflicts && conflicts.length > 0) {
      // eslint-disable-next-line no-console
      console.warn(
        `WARNING: ${conflicts.length} channel(s) use sub_folder='playlists' which will be reserved. ` +
        `Rename them before the next deploy.`,
        conflicts
      );
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('playlist_sync_state');
    await queryInterface.dropTable('playlistvideos');
    await queryInterface.dropTable('playlists');
  },
};
