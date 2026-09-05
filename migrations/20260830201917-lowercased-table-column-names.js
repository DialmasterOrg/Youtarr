'use strict';

const { extractTableName, columnExists } = require('./helpers');

// The tableExists function in helpers is case-insensitive so we cannot use it for this migration.
async function tableExists(queryInterface, tableName) {
  const tablesRaw = await queryInterface.showAllTables();
  return tablesRaw.some((table) => extractTableName(table) === tableName);
}

async function tableAndColumnExist(queryInterface, tableName, columnName) {
  return await tableExists(queryInterface, tableName) && await columnExists(queryInterface, tableName, columnName);
};

const TABLES = [
  ['ApiKeys', 'apikeys'],
  ['JobVideoDownloads', 'jobvideodownloads'],
  ['JobVideos', 'jobvideos'],
  ['Jobs', 'jobs'],
  ['Sessions', 'sessions'],
  ['Videos', 'videos'],
];

async function renameTableResumably(queryInterface, original, lowercase, destination) {
  // Recognize temporary names left by either an upgrade or a rollback.
  // Compare stored names exactly so distinct tables on LCTN=0 are conflicts,
  // while LCTN=1 naturally returns only the lowercase stored name.
  const candidates = new Set([original, lowercase, `${original}-tmp`, `${lowercase}-tmp`]);
  const tables = (await queryInterface.showAllTables()).map(extractTableName);
  const matches = tables.filter((name) => candidates.has(name));
  if (matches.length !== 1) {
    throw new Error(`Cannot rename ${original}: expected one table, found ${matches.length} (${matches.join(', ')})`);
  }

  const source = matches[0];
  if (source === destination) return;

  if (source.endsWith('-tmp')) {
    await queryInterface.renameTable(source, destination);
  } else {
    // A case-only rename fails on LCTN=2. Each step commits independently,
    // so the temporary name must remain recoverable on the next invocation.
    const temporary = `${source}-tmp`;
    await queryInterface.renameTable(source, temporary);
    await queryInterface.renameTable(temporary, destination);
  }
}

async function normalizeTableNames(queryInterface) {
  for (const [original, lowercase] of TABLES) {
    await renameTableResumably(queryInterface, original, lowercase, lowercase);
  }
}

const COLUMNS = [
  ['channels', 'lastFetchedByTab', 'last_fetched_by_tab'],
  ['channelvideos', 'publishedAt', 'published_at'],
  ['jobs', 'jobType', 'job_type'],
  ['jobs', 'timeCreated', 'time_created'],
  ['jobs', 'timeInitiated', 'time_initiated'],
  ['media_server_users', 'createdAt', 'created_at'],
  ['media_server_users', 'updatedAt', 'updated_at'],
  ['playlist_sync_state', 'createdAt', 'created_at'],
  ['playlist_sync_state', 'updatedAt', 'updated_at'],
  ['playlists', 'createdAt', 'created_at'],
  ['playlists', 'lastFetched', 'last_fetched'],
  ['playlists', 'updatedAt', 'updated_at'],
  ['playlistvideos', 'createdAt', 'created_at'],
  ['playlistvideos', 'updatedAt', 'updated_at'],
  ['subfolders', 'createdAt', 'created_at'],
  ['subfolders', 'updatedAt', 'updated_at'],
  ['video_watch_status', 'createdAt', 'created_at'],
  ['video_watch_status', 'updatedAt', 'updated_at'],
  ['videos', 'audioFilePath', 'audio_file_path'],
  ['videos', 'audioFileSize', 'audio_file_size'],
  ['videos', 'filePath', 'file_path'],
  ['videos', 'fileSize', 'file_size'],
  ['videos', 'originalDate', 'original_date'],
  ['videos', 'youTubeChannelName', 'youtube_channel_name'],
  ['videos', 'youTubeVideoName', 'youtube_video_name'],
  ['videos', 'youtubeId', 'youtube_id'],
  ['watch_status_sync_cursors', 'createdAt', 'created_at'],
  ['watch_status_sync_cursors', 'updatedAt', 'updated_at'],
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await normalizeTableNames(queryInterface);
    for (const [tableName, from, to] of COLUMNS) {
      if (await tableAndColumnExist(queryInterface, tableName, from)) {
        await queryInterface.renameColumn(tableName, from, to);
      }
    }

    // Sequelize generates invalid SQL for these columns since their default (in the database) is `CURRENT_TIMESTAMP`, see https://github.com/sequelize/sequelize/issues/8868
    if (await tableAndColumnExist(queryInterface, 'sessions', 'createdAt')) {
      await queryInterface.sequelize.query('ALTER TABLE sessions CHANGE createdAt created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP');
    }
    if (await tableAndColumnExist(queryInterface, 'sessions', 'updatedAt')) {
      await queryInterface.sequelize.query('ALTER TABLE sessions CHANGE updatedAt updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
    }
  },

  async down (queryInterface, Sequelize) {
    // Recover tables before touching columns, including an interrupted upgrade
    // or a rollback that already restored some original table names.
    await normalizeTableNames(queryInterface);
    if (await tableAndColumnExist(queryInterface, 'sessions', 'created_at')) {
      await queryInterface.sequelize.query('ALTER TABLE sessions CHANGE created_at createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP');
    }
    if (await tableAndColumnExist(queryInterface, 'sessions', 'updated_at')) {
      await queryInterface.sequelize.query('ALTER TABLE sessions CHANGE updated_at updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
    }

    for (const [tableName, to, from] of COLUMNS) {
      if (await tableAndColumnExist(queryInterface, tableName, from)) {
        await queryInterface.renameColumn(tableName, from, to);
      }
    }
    for (const [original, lowercase] of TABLES) {
      await renameTableResumably(queryInterface, original, lowercase, original);
    }
  }
};
