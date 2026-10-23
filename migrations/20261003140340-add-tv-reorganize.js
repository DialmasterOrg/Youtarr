'use strict';

const {
  createTableIfNotExists,
  dropTableIfExists,
  addColumnIfMissing,
  addIndexIfMissing,
} = require('./helpers');

const TABLE_OPTIONS = { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' };
// Named explicitly: MariaDB 12.1+ names an unnamed constraint `1`.
const ITEM_OPERATION_FK_NAME = 'tv_reorganize_items_operation_id_fk';

async function hasForeignKey(queryInterface, tableName) {
  const [rows] = await queryInterface.sequelize.query(
    `SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
     WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = :tableName AND CONSTRAINT_TYPE = 'FOREIGN KEY'`,
    { replacements: { tableName } }
  );
  return rows.length > 0;
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // A reorganize: moving downloaded files to where changed settings say they
    // belong (a channel or library folder switching between videos and TV).
    // Recorded so an interrupted run resumes on startup.
    await createTableIfNotExists(queryInterface, 'tv_reorganize_operations', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      // channel | folderLayout | defaultSubfolder
      change_type: { type: Sequelize.STRING(32), allowNull: false },
      // The channel id, library folder name, or new default subfolder.
      scope: { type: Sequelize.STRING(255), allowNull: false, defaultValue: '' },
      // JSON: the approved settings change and the show locations it pins
      // (a folder's change can pin hundreds of shows, hence MEDIUMTEXT).
      settings_change: { type: Sequelize.TEXT('medium'), allowNull: false },
      settings_applied: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      revision: { type: Sequelize.STRING(64), allowNull: false },
      // running | completed | partial | failed
      status: { type: Sequelize.STRING(16), allowNull: false },
      total_items: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      done_items: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      failed_items: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      error: { type: Sequelize.TEXT, allowNull: true },
      started_at: { type: Sequelize.DATE, allowNull: true },
      finished_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    }, TABLE_OPTIONS);
    await addIndexIfMissing(queryInterface, 'tv_reorganize_operations', ['status'], {
      name: 'tv_reorganize_operations_status_idx',
    });

    // One video of an operation: every file's source and destination, and
    // the episode assignment it gets (null when it becomes movie-style).
    await createTableIfNotExists(queryInterface, 'tv_reorganize_items', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      operation_id: { type: Sequelize.INTEGER, allowNull: false },
      youtube_id: { type: Sequelize.STRING(20), allowNull: false },
      // Videos.id
      video_id: { type: Sequelize.INTEGER, allowNull: false },
      // Owner channel's YouTube id.
      channel_id: { type: Sequelize.STRING(64), allowNull: true },
      title: { type: Sequelize.STRING(512), allowNull: true },
      // JSON array of { from, to }, plus the old and new video and audio paths.
      files: { type: Sequelize.TEXT, allowNull: false },
      // JSON episode assignment, or null.
      classification: { type: Sequelize.TEXT, allowNull: true },
      // pending | done | failed
      status: { type: Sequelize.STRING(16), allowNull: false },
      // The files reached their destination (a failed item can still have
      // moved: its metadata or row update failed afterwards, and a retry
      // finishes it).
      files_moved: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      error: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    }, TABLE_OPTIONS);
    // Databases that ran an earlier build of this (unreleased) migration.
    await addColumnIfMissing(queryInterface, 'tv_reorganize_items', 'files_moved', {
      type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false,
    });

    if (!(await hasForeignKey(queryInterface, 'tv_reorganize_items'))) {
      await queryInterface.addConstraint('tv_reorganize_items', {
        fields: ['operation_id'],
        type: 'foreign key',
        name: ITEM_OPERATION_FK_NAME,
        references: { table: 'tv_reorganize_operations', field: 'id' },
        onUpdate: 'cascade',
        onDelete: 'cascade',
      });
    }
    await addIndexIfMissing(queryInterface, 'tv_reorganize_items', ['operation_id', 'status'], {
      name: 'tv_reorganize_items_operation_status_idx',
    });
    await addIndexIfMissing(queryInterface, 'tv_reorganize_items', ['channel_id', 'status'], {
      name: 'tv_reorganize_items_channel_status_idx',
    });

    // Watch state Youtarr protects while a reorganize moves a video's files:
    // the media servers report the moved item as new (unwatched) until the
    // state is pushed back, and the sync must not overwrite Youtarr's rows.
    await createTableIfNotExists(queryInterface, 'watch_status_holds', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      // Videos.id, like video_watch_status.video_id.
      video_id: { type: Sequelize.INTEGER, allowNull: false },
      server_type: { type: Sequelize.STRING(16), allowNull: false },
      server_user_id: { type: Sequelize.STRING(255), allowNull: false },
      operation_id: { type: Sequelize.INTEGER, allowNull: true },
      // JSON: played, playCount, positionMs, percentWatched, lastWatchedAt.
      snapshot: { type: Sequelize.TEXT, allowNull: false },
      // pending | restored | failed | dismissed
      state: { type: Sequelize.STRING(16), allowNull: false },
      attempts: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      last_attempt_at: { type: Sequelize.DATE, allowNull: true },
      // When the state was last written to the server (an attempt that found
      // the state already there writes nothing): the server stamps the item
      // with this time, which the sync must not read as a new watch.
      last_pushed_at: { type: Sequelize.DATE, allowNull: true },
      last_error: { type: Sequelize.TEXT, allowNull: true },
      expires_at: { type: Sequelize.DATE, allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    }, TABLE_OPTIONS);
    // Databases that ran an earlier build of this (unreleased) migration.
    await addColumnIfMissing(queryInterface, 'watch_status_holds', 'last_pushed_at', { type: Sequelize.DATE, allowNull: true });
    await addIndexIfMissing(queryInterface, 'watch_status_holds', ['video_id', 'server_type', 'server_user_id'], {
      name: 'watch_status_holds_video_server_user_uq',
      unique: true,
    });
    await addIndexIfMissing(queryInterface, 'watch_status_holds', ['state'], {
      name: 'watch_status_holds_state_idx',
    });
  },

  async down(queryInterface) {
    await dropTableIfExists(queryInterface, 'watch_status_holds');
    await dropTableIfExists(queryInterface, 'tv_reorganize_items');
    await dropTableIfExists(queryInterface, 'tv_reorganize_operations');
  },
};
