'use strict';

// Adds denormalized metadata columns to `playlistvideos` so the playlist detail
// page can show title/thumbnail/duration/published_at/channel_name without
// requiring the videos to be downloaded or the source channel to be fetched
// first. Populated by playlistModule.fetchAllPlaylistVideos from yt-dlp's
// flat-playlist output.
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('playlistvideos');

    if (!table.title) {
      await queryInterface.addColumn('playlistvideos', 'title', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
    if (!table.thumbnail) {
      await queryInterface.addColumn('playlistvideos', 'thumbnail', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
    if (!table.duration) {
      await queryInterface.addColumn('playlistvideos', 'duration', {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
    }
    if (!table.channel_name) {
      await queryInterface.addColumn('playlistvideos', 'channel_name', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
    if (!table.published_at) {
      await queryInterface.addColumn('playlistvideos', 'published_at', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('playlistvideos');
    if (table.published_at) await queryInterface.removeColumn('playlistvideos', 'published_at');
    if (table.channel_name) await queryInterface.removeColumn('playlistvideos', 'channel_name');
    if (table.duration) await queryInterface.removeColumn('playlistvideos', 'duration');
    if (table.thumbnail) await queryInterface.removeColumn('playlistvideos', 'thumbnail');
    if (table.title) await queryInterface.removeColumn('playlistvideos', 'title');
  },
};
