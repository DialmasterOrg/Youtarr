'use strict';

const { createTableIfNotExists, addIndexIfMissing, dropTableIfExists } = require('./helpers');

module.exports = {
  async up(queryInterface, Sequelize) {
    // One row per release Sonarr or Radarr grabbed through the bridge. The id
    // is also the SABnzbd nzo_id; job_id is the Youtarr download job of the
    // current attempt. No foreign key to Jobs on purpose: the row outlives
    // the job, and a foreign key would tie this table to the Jobs collation
    // history.
    await createTableIfNotExists(queryInterface, 'arr_bridge_grabs', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
      youtube_id: { type: Sequelize.STRING(20), allowNull: false },
      // tv | movie
      kind: { type: Sequelize.STRING(10), allowNull: false },
      // The SABnzbd category the client sent; each client only sees its own.
      category: { type: Sequelize.STRING(32), allowNull: false },
      // Also the SABnzbd history name and the staging folder and file name.
      release_title: { type: Sequelize.STRING(255), allowNull: false },
      // pending | queued | completed | failed | removed
      status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'pending' },
      job_id: { type: Sequelize.UUID, allowNull: true },
      staged_path: { type: Sequelize.STRING(1024), allowNull: true },
      bytes: { type: Sequelize.BIGINT, allowNull: true },
      estimated_bytes: { type: Sequelize.BIGINT, allowNull: true },
      // Kept after the row becomes removed: a failed video is not offered again for a while.
      fail_message: { type: Sequelize.STRING(500), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
      // When the grab ended, completed or failed.
      completed_at: { type: Sequelize.DATE, allowNull: true },
      removed_at: { type: Sequelize.DATE, allowNull: true },
    }, { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' });

    await addIndexIfMissing(queryInterface, 'arr_bridge_grabs', ['status', 'updated_at'], {
      name: 'arr_bridge_grabs_status_idx',
    });
    await addIndexIfMissing(queryInterface, 'arr_bridge_grabs', ['youtube_id'], {
      name: 'arr_bridge_grabs_youtube_id_idx',
    });
  },

  async down(queryInterface) {
    await dropTableIfExists(queryInterface, 'arr_bridge_grabs');
  },
};
