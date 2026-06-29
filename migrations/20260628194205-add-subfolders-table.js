'use strict';

const {
  createTableIfNotExists,
  addIndexIfMissing,
  dropTableIfExists,
} = require('./helpers');

module.exports = {
  async up(queryInterface, Sequelize) {
    await createTableIfNotExists(queryInterface, 'subfolders', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      name: { type: Sequelize.STRING(100), allowNull: false },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    }, { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' });

    await addIndexIfMissing(queryInterface, 'subfolders', ['name'], {
      unique: true,
      name: 'subfolders_name_uq',
    });

    const { collectBackfillNames } = require('./lib/subfolderBackfill');
    const GLOBAL_DEFAULT_SENTINEL = '##USE_GLOBAL_DEFAULT##';
    const ROOT_SENTINEL = '##ROOT##';
    const baseDir = process.env.DATA_PATH || '/usr/src/app/data';

    const [channelRows] = await queryInterface.sequelize.query(
      `SELECT DISTINCT sub_folder FROM channels
       WHERE sub_folder IS NOT NULL AND sub_folder <> :gd AND sub_folder <> :root`,
      { replacements: { gd: GLOBAL_DEFAULT_SENTINEL, root: ROOT_SENTINEL } }
    );
    const [playlistRows] = await queryInterface.sequelize.query(
      `SELECT DISTINCT default_sub_folder FROM playlists
       WHERE default_sub_folder IS NOT NULL AND default_sub_folder <> :gd AND default_sub_folder <> :root`,
      { replacements: { gd: GLOBAL_DEFAULT_SENTINEL, root: ROOT_SENTINEL } }
    );
    const [videoRows] = await queryInterface.sequelize.query(
      `SELECT filePath, audioFilePath FROM Videos
       WHERE filePath IS NOT NULL OR audioFilePath IS NOT NULL`
    );

    const videoPaths = [];
    for (const row of videoRows) {
      if (row.filePath) videoPaths.push(row.filePath);
      if (row.audioFilePath) videoPaths.push(row.audioFilePath);
    }

    const names = collectBackfillNames({
      channelSubFolders: channelRows.map((r) => r.sub_folder),
      playlistSubFolders: playlistRows.map((r) => r.default_sub_folder),
      videoPaths,
      baseDir,
    });

    if (names.length > 0) {
      const now = new Date();
      await queryInterface.bulkInsert(
        'subfolders',
        names.map((name) => ({ name, createdAt: now, updatedAt: now })),
        { ignoreDuplicates: true } // emits INSERT IGNORE; tolerates collation-equivalent collisions
      );
    }
  },

  async down(queryInterface) {
    await dropTableIfExists(queryInterface, 'subfolders');
  },
};
