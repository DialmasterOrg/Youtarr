'use strict';

const fs = require('fs');
const path = require('path');
const { createCollationSchemaDouble } = require('./support/collationSchemaDouble');
const migration = require('../20260907000000-normalize-utf8mb4-unicode-collation');

const MIGRATION_NAME = '20260907000000-normalize-utf8mb4-unicode-collation.js';
const TABLE_RENAME = '20260830201917-lowercased-table-column-names.js';
const PLAYLIST_FOLLOWING = '20260907174043-playlist-following-and-download-dates.js';

describe('normalize utf8mb4 unicode collation migration', () => {
  test('sorts after the table rename and before the first cross-table collation comparison', () => {
    const names = fs.readdirSync(path.join(__dirname, '..')).filter((name) => name.endsWith('.js')).sort();
    expect(names.indexOf(MIGRATION_NAME)).toBeGreaterThan(names.indexOf(TABLE_RENAME));
    expect(names.indexOf(MIGRATION_NAME)).toBeLessThan(names.indexOf(PLAYLIST_FOLLOWING));
  });

  test('brings a legacy mixed schema to utf8mb4_unicode_ci with utf8mb4_bin UUID keys', async () => {
    const qi = createCollationSchemaDouble({
      database: { name: 'youtarr', charset: 'utf8mb4', collation: 'utf8mb4_general_ci' },
      tables: {
        videos: { collation: 'utf8mb4_general_ci', columns: { youtube_id: 'utf8mb4_general_ci' } },
        jobs: { collation: 'utf8mb4_general_ci', columns: { id: 'utf8mb4_bin' } },
        jobvideos: { collation: 'utf8mb4_general_ci', columns: { job_id: 'utf8mb4_bin' } },
        playlistvideos: { collation: 'utf8mb4_unicode_ci', columns: { youtube_id: 'utf8mb4_unicode_ci' } },
      },
    });
    await migration.up(qi);
    expect(qi.database.collation).toBe('utf8mb4_unicode_ci');
    expect(qi.tables.videos.columns.youtube_id).toBe('utf8mb4_unicode_ci');
    expect(qi.tables.jobs.collation).toBe('utf8mb4_unicode_ci');
    expect(qi.tables.jobs.columns.id).toBe('utf8mb4_bin');
    expect(qi.tables.jobvideos.columns.job_id).toBe('utf8mb4_bin');
    expect(qi.state.foreignKeyChecks).toBe(1);
  });

  test('is a no-op on a second run', async () => {
    const qi = createCollationSchemaDouble({
      tables: {
        videos: { collation: 'utf8mb4_general_ci', columns: { youtube_id: 'utf8mb4_general_ci' } },
      },
    });
    await migration.up(qi);
    qi.ops.length = 0;
    await migration.up(qi);
    expect(qi.ops).toEqual([]);
  });

  test('down leaves the normalized schema in place', async () => {
    const qi = createCollationSchemaDouble({
      tables: { videos: { collation: 'utf8mb4_unicode_ci', columns: { youtube_id: 'utf8mb4_unicode_ci' } } },
    });
    await migration.down(qi);
    expect(qi.ops).toEqual([]);
    expect(qi.tables.videos.collation).toBe('utf8mb4_unicode_ci');
  });
});
