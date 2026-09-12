'use strict';

const { Sequelize } = require('sequelize');
const migration = require('../20260907174043-playlist-following-and-download-dates');

function recordingInterface() {
  const schema = {
    playlistvideos: { added_at: {}, created_at: {} },
    playlists: { auto_download_baseline_at: {} },
  };
  const ops = [];
  return {
    schema, ops,
    describeTable: async (table) => schema[table],
    addColumn: async (table, column, definition) => {
      schema[table][column] = definition;
      ops.push({ op: 'add', table, column, definition });
    },
    removeColumn: async (table, column) => {
      delete schema[table][column];
      ops.push({ op: 'remove', table, column });
    },
    sequelize: { query: async (sql) => ops.push({ op: 'query', sql: sql.replace(/\s+/g, ' ').trim() }) },
  };
}

describe('playlist following and download dates migration', () => {
  test('creates all columns before backfilling existing data', async () => {
    const qi = recordingInterface();
    await migration.up(qi, Sequelize);
    expect(qi.ops.map(({ op, column }) => [op, column])).toEqual([
      ['add', 'first_seen_at'], ['add', 'downloaded_at'], ['add', 'auto_download_requested'],
      ['add', 'auto_download_baseline_id'], ['query', undefined], ['query', undefined],
    ]);
  });

  test('backfills missing discovery dates from creation time', async () => {
    const qi = recordingInterface();
    await migration.up(qi, Sequelize);
    expect(qi.ops.filter(({ op }) => op === 'query')[0].sql)
      .toBe('UPDATE playlistvideos SET first_seen_at = created_at WHERE first_seen_at IS NULL');
  });

  test('backfills missing download dates from download history with job time as fallback', async () => {
    const qi = recordingInterface();
    await migration.up(qi, Sequelize);
    expect(qi.ops.filter(({ op }) => op === 'query')[1].sql).toBe(
      'UPDATE playlistvideos pv JOIN ( SELECT v.youtube_id, COALESCE(v.last_downloaded_at, MAX(j.time_created)) AS downloaded_at FROM videos v LEFT JOIN jobvideos jv ON jv.video_id = v.id LEFT JOIN jobs j ON j.id = jv.job_id GROUP BY v.id ) downloads ON downloads.youtube_id = pv.youtube_id SET pv.downloaded_at = downloads.downloaded_at WHERE pv.downloaded_at IS NULL'
    );
  });

  test('does not replace columns or replay legacy cutoffs on a repeated upgrade', async () => {
    const qi = recordingInterface();
    await migration.up(qi, Sequelize);
    qi.ops.length = 0;
    await migration.up(qi, Sequelize);
    expect(qi.ops.map(({ op }) => op)).toEqual(['query', 'query']);
    expect(qi.ops.map(({ sql }) => sql).join(' ')).not.toMatch(/SET (?:\w+\.)?(?:added_at|auto_download_baseline_at|auto_download_baseline_id)\s*=/);
  });

  test('rollback removes only new columns and leaves legacy tracking data intact', async () => {
    const qi = recordingInterface();
    await migration.up(qi, Sequelize);
    qi.ops.length = 0;
    await migration.down(qi);
    expect(qi.schema).toEqual({
      playlistvideos: { added_at: {}, created_at: {} },
      playlists: { auto_download_baseline_at: {} },
    });
    expect(qi.ops.map(({ op }) => op)).toEqual(['remove', 'remove', 'remove', 'remove']);
  });
});


describe('playlist following setup error migration', () => {
  const setupErrorMigration = require('../20260912165847-playlist-following-setup-error');

  test('adds an optional persisted error without changing existing following state', async () => {
    const qi = recordingInterface();
    await setupErrorMigration.up(qi, Sequelize);
    expect(qi.ops).toEqual([{ op: 'add', table: 'playlists', column: 'auto_download_setup_error', definition: {
      type: Sequelize.STRING, allowNull: true,
    } }]);
  });

  test('is safe to apply and roll back repeatedly without touching the baseline', async () => {
    const qi = recordingInterface();
    await setupErrorMigration.up(qi, Sequelize);
    await setupErrorMigration.up(qi, Sequelize);
    await setupErrorMigration.down(qi);
    await setupErrorMigration.down(qi);
    expect(qi.ops.map(({ op, column }) => [op, column])).toEqual([
      ['add', 'auto_download_setup_error'], ['remove', 'auto_download_setup_error'],
    ]);
    expect(qi.schema.playlists).toEqual({ auto_download_baseline_at: {} });
  });
});
