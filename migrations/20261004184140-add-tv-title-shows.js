'use strict';

const {
  createTableIfNotExists,
  dropTableIfExists,
  addColumnIfMissing,
  removeColumnIfExists,
  addIndexIfMissing,
} = require('./helpers');

const TABLE_OPTIONS = { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' };
// Named explicitly: MariaDB 12.1+ names an unnamed constraint `1`.
const PATTERN_SHOW_FK_NAME = 'tv_show_patterns_show_id_fk';
const SEASON_SHOW_FK_NAME = 'tv_show_seasons_show_id_fk';
const CONFLICT_SHOW_FK_NAME = 'episode_conflicts_show_id_fk';

async function hasConstraint(queryInterface, tableName, constraintName) {
  const [rows] = await queryInterface.sequelize.query(
    `SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
     WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = :tableName AND CONSTRAINT_NAME = :constraintName`,
    { replacements: { tableName, constraintName } }
  );
  return rows.length > 0;
}

async function addShowForeignKey(queryInterface, tableName, name, onDelete) {
  if (await hasConstraint(queryInterface, tableName, name)) return;
  await queryInterface.addConstraint(tableName, {
    fields: ['show_id'],
    type: 'foreign key',
    name,
    references: { table: 'tv_shows', field: 'id' },
    onUpdate: 'cascade',
    onDelete,
  });
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Title patterns of a title show, tried in position order (the first
    // matching show of a channel wins, then its first matching pattern).
    await createTableIfNotExists(queryInterface, 'tv_show_patterns', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      show_id: { type: Sequelize.INTEGER, allowNull: false },
      position: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      // What the user wrote, in the simple syntax or as a regular expression.
      pattern_text: { type: Sequelize.TEXT, allowNull: false },
      // simple | regex
      pattern_kind: { type: Sequelize.STRING(8), allowNull: false },
      // The Python regex classification runs (named groups kept).
      compiled_regex: { type: Sequelize.TEXT, allowNull: false },
      // The same regex as a yt-dlp match filter: groups unnamed, flags scoped.
      filter_regex: { type: Sequelize.TEXT, allowNull: false },
      // title | fixed | year
      season_source: { type: Sequelize.STRING(8), allowNull: false },
      season_fixed: { type: Sequelize.INTEGER, allowNull: true },
      // title | date | order
      episode_source: { type: Sequelize.STRING(8), allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    }, TABLE_OPTIONS);
    await addShowForeignKey(queryInterface, 'tv_show_patterns', PATTERN_SHOW_FK_NAME, 'cascade');

    // Per show and season: its name (<namedseason>, season.nfo) and the
    // highest order-numbered episode ever given, which never goes down.
    await createTableIfNotExists(queryInterface, 'tv_show_seasons', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      show_id: { type: Sequelize.INTEGER, allowNull: false },
      season: { type: Sequelize.INTEGER, allowNull: false },
      name: { type: Sequelize.STRING(255), allowNull: true },
      order_high_water: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    }, TABLE_OPTIONS);
    await addShowForeignKey(queryInterface, 'tv_show_seasons', SEASON_SHOW_FK_NAME, 'cascade');
    await addIndexIfMissing(queryInterface, 'tv_show_seasons', ['show_id', 'season'], {
      name: 'tv_show_seasons_show_season_unique',
      unique: true,
    });

    // A video that lost its episode number to another upload, or whose title
    // could not be classified.
    await createTableIfNotExists(queryInterface, 'episode_conflicts', {
      youtube_id: { type: Sequelize.STRING(20), primaryKey: true, allowNull: false },
      // Owner channel's YouTube id.
      channel_id: { type: Sequelize.STRING(64), allowNull: false },
      // Null for a classification error (no show could be decided).
      show_id: { type: Sequelize.INTEGER, allowNull: true },
      // duplicate | classification_error | released
      kind: { type: Sequelize.STRING(24), allowNull: false },
      // The video holding the number.
      duplicate_of: { type: Sequelize.STRING(20), allowNull: true },
      // Youtarr set the video's ignore flag (so only Youtarr takes it back).
      youtarr_ignored: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      // Youtarr wrote the video's complete.list line (it wasn't there before).
      archive_suppressed: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      // A complete.list write waiting for the download queue to be idle: add | remove
      archive_pending: { type: Sequelize.STRING(8), allowNull: true },
      // JSON: season, episode and other details for display.
      details: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    }, TABLE_OPTIONS);
    await addShowForeignKey(queryInterface, 'episode_conflicts', CONFLICT_SHOW_FK_NAME, 'restrict');
    await addIndexIfMissing(queryInterface, 'episode_conflicts', ['channel_id'], {
      name: 'episode_conflicts_channel_id_idx',
    });
    await addIndexIfMissing(queryInterface, 'episode_conflicts', ['archive_pending'], {
      name: 'episode_conflicts_archive_pending_idx',
    });

    // "Only download videos that belong to a title show".
    await addColumnIfMissing(queryInterface, 'channels', 'tv_show_only_downloads', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
  },

  async down(queryInterface) {
    await removeColumnIfExists(queryInterface, 'channels', 'tv_show_only_downloads');
    await dropTableIfExists(queryInterface, 'episode_conflicts');
    await dropTableIfExists(queryInterface, 'tv_show_seasons');
    await dropTableIfExists(queryInterface, 'tv_show_patterns');
  },
};
