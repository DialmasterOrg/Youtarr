'use strict';

const { addColumnIfMissing, removeColumnIfExists } = require('./helpers');

module.exports = {
  async up(queryInterface, Sequelize) {
    await addColumnIfMissing(queryInterface, 'playlistvideos', 'first_seen_at', {
      type: Sequelize.DATE, allowNull: true,
    });
    await addColumnIfMissing(queryInterface, 'playlistvideos', 'downloaded_at', {
      type: Sequelize.DATE, allowNull: true,
    });
    await addColumnIfMissing(queryInterface, 'playlistvideos', 'auto_download_requested', {
      type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false,
    });
    await addColumnIfMissing(queryInterface, 'playlists', 'auto_download_baseline_id', {
      type: Sequelize.INTEGER, allowNull: true,
    });

    // added_at was overwritten on download; row creation records discovery.
    // Preserve legacy added_at and cutoffs so upgrading cannot replay a backlog.
    await queryInterface.sequelize.query(
      'UPDATE playlistvideos SET first_seen_at = created_at WHERE first_seen_at IS NULL'
    );
    await queryInterface.sequelize.query(`
      UPDATE playlistvideos pv
      JOIN (
        SELECT v.youtube_id,
          COALESCE(v.last_downloaded_at, MAX(j.time_created)) AS downloaded_at
        FROM videos v
        LEFT JOIN jobvideos jv ON jv.video_id = v.id
        LEFT JOIN jobs j ON j.id = jv.job_id
        GROUP BY v.id
      ) downloads ON downloads.youtube_id = pv.youtube_id
      SET pv.downloaded_at = downloads.downloaded_at
      WHERE pv.downloaded_at IS NULL
    `);
  },

  async down(queryInterface) {
    await removeColumnIfExists(queryInterface, 'playlists', 'auto_download_baseline_id');
    await removeColumnIfExists(queryInterface, 'playlistvideos', 'auto_download_requested');
    await removeColumnIfExists(queryInterface, 'playlistvideos', 'downloaded_at');
    await removeColumnIfExists(queryInterface, 'playlistvideos', 'first_seen_at');
  },
};
