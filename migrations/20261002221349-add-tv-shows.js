'use strict';

const {
  addColumnIfMissing,
  removeColumnIfExists,
  createTableIfNotExists,
  dropTableIfExists,
  addIndexIfMissing,
} = require('./helpers');

const TABLE_OPTIONS = { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' };
// Named explicitly: MariaDB 12.1+ names an unnamed constraint `1`.
const SHOW_FK_NAME = 'video_classifications_show_id_fk';

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
    // Layout of each __subfolder: 'videos' (movie-style) or 'tv'. The main
    // folder's layout lives in config (mainFolderLayout).
    await addColumnIfMissing(queryInterface, 'subfolders', 'layout', {
      type: Sequelize.STRING(10),
      allowNull: false,
      defaultValue: 'videos',
    });

    await createTableIfNotExists(queryInterface, 'tv_shows', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      // YouTube channel id of the owner. Not a foreign key: untracked channels
      // get channel shows too.
      channel_id: { type: Sequelize.STRING(64), allowNull: false },
      // channel | title
      kind: { type: Sequelize.STRING(16), allowNull: false },
      name: { type: Sequelize.STRING(255), allowNull: false },
      // Pinned when the show is created; only a reorganize changes it.
      folder_name: { type: Sequelize.STRING(255), allowNull: false },
      // '' = the main downloads folder, else the subfolder name without __.
      library_folder: { type: Sequelize.STRING(100), allowNull: false, defaultValue: '' },
      position: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      // JSON array of title-show exclude terms.
      exclude_terms: { type: Sequelize.TEXT, allowNull: true },
      poster_source: { type: Sequelize.STRING(255), allowNull: true },
      // Written to tvshow.nfo: the channel id for channel shows, a UUID for
      // title shows. Never changes after creation.
      external_key: { type: Sequelize.STRING(64), allowNull: false },
      // The channel's sub_folder value before it switched to TV.
      previous_videos_folder: { type: Sequelize.STRING(255), allowNull: true },
      retired_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    }, TABLE_OPTIONS);

    await addIndexIfMissing(queryInterface, 'tv_shows', ['library_folder', 'folder_name'], {
      name: 'tv_shows_location_unique',
      unique: true,
    });
    await addIndexIfMissing(queryInterface, 'tv_shows', ['channel_id'], {
      name: 'tv_shows_channel_id_idx',
    });

    await createTableIfNotExists(queryInterface, 'video_classifications', {
      youtube_id: { type: Sequelize.STRING(20), primaryKey: true, allowNull: false },
      // Owner channel's YouTube id.
      channel_id: { type: Sequelize.STRING(64), allowNull: false },
      show_id: { type: Sequelize.INTEGER, allowNull: false },
      // assigned | pending_number | duplicate | unsupported | error
      status: { type: Sequelize.STRING(16), allowNull: false },
      season: { type: Sequelize.INTEGER, allowNull: true },
      episode: { type: Sequelize.INTEGER, allowNull: true },
      // date | title | order | manual | adopted
      source: { type: Sequelize.STRING(16), allowNull: true },
      // timestamp | upload_date (date-numbered episodes only)
      timestamp_source: { type: Sequelize.STRING(16), allowNull: true },
      // Title-show pattern that matched; no foreign key until that table exists.
      pattern_id: { type: Sequelize.INTEGER, allowNull: true },
      episode_title: { type: Sequelize.STRING(512), allowNull: true },
      // On-disk file name without extension; changes only when the show or number changes.
      file_stem: { type: Sequelize.STRING(255), allowNull: true },
      title_opt_out: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    }, TABLE_OPTIONS);

    if (!(await hasForeignKey(queryInterface, 'video_classifications'))) {
      await queryInterface.addConstraint('video_classifications', {
        fields: ['show_id'],
        type: 'foreign key',
        name: SHOW_FK_NAME,
        references: { table: 'tv_shows', field: 'id' },
        onUpdate: 'cascade',
        onDelete: 'restrict',
      });
    }

    // Unnumbered rows hold NULL season and episode, which never collide.
    await addIndexIfMissing(queryInterface, 'video_classifications', ['show_id', 'season', 'episode'], {
      name: 'video_classifications_episode_unique',
      unique: true,
    });
    await addIndexIfMissing(queryInterface, 'video_classifications', ['channel_id'], {
      name: 'video_classifications_channel_id_idx',
    });
  },

  async down(queryInterface) {
    await dropTableIfExists(queryInterface, 'video_classifications');
    await dropTableIfExists(queryInterface, 'tv_shows');
    await removeColumnIfExists(queryInterface, 'subfolders', 'layout');
  },
};
