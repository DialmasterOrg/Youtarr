'use strict';

const migration = require('../20260908105000-add-external-api-key-permissions');

function queryInterface(columns = {}) {
  const operations = [];
  return {
    operations,
    describeTable: jest.fn().mockResolvedValue(columns),
    addColumn: jest.fn(async (_table, column) => operations.push(['add', column])),
    changeColumn: jest.fn(async (_table, column) => operations.push(['change', column])),
    removeColumn: jest.fn(async (_table, column) => operations.push(['remove', column])),
    sequelize: { query: jest.fn(async (sql) => operations.push(['query', sql])) },
  };
}

describe('external API key permission migration', () => {
  test('adds granular permissions and backfills them from existing roles', async () => {
    const qi = queryInterface();
    await migration.up(qi, { BOOLEAN: 'BOOLEAN' });

    expect(qi.operations.filter(([operation]) => operation === 'add')).toEqual([
      ['add', 'allow_video_requests'],
      ['add', 'allow_channel_requests'],
      ['add', 'allow_delete_video_requests'],
    ]);
    const backfills = qi.operations
      .filter(([operation]) => operation === 'query')
      .map(([, sql]) => sql);
    expect(backfills).toHaveLength(3);
    expect(backfills.join('\n')).toContain("role IN ('request', 'delete', 'admin')");
    expect(backfills.join('\n')).toContain("role IN ('delete', 'admin')");
  });

  test('does not overwrite granular policies when the migration is reapplied', async () => {
    const columns = {
      allow_video_requests: {},
      allow_channel_requests: {},
      allow_delete_video_requests: {},
    };
    const repeat = queryInterface(columns);
    await migration.up(repeat, { BOOLEAN: 'BOOLEAN' });
    expect(repeat.operations.filter(([operation]) => operation === 'add')).toEqual([]);
    expect(repeat.operations.filter(([operation]) => operation === 'query')).toHaveLength(3);
    expect(repeat.operations.filter(([operation]) => operation === 'query').every(([, sql]) => /IS NULL/.test(sql))).toBe(true);
  });

  test('revokes non-cumulative policies before removing their columns', async () => {
    const columns = {
      is_active: {},
      revoked_at: {},
      allow_video_requests: {},
      allow_channel_requests: {},
      allow_delete_video_requests: {},
    };
    const repeat = queryInterface(columns);

    await migration.down(repeat);
    const revoke = repeat.operations.find(([operation]) => operation === 'query')?.[1];
    expect(revoke).toContain('SET is_active = false');
    expect(revoke).toContain("role <> 'legacy_download'");
    expect(revoke).toContain('allow_video_requests <> CASE');
    expect(revoke).toContain('allow_channel_requests <> CASE');
    expect(revoke).toContain('allow_delete_video_requests <> CASE');
    expect(repeat.operations.findIndex(([operation]) => operation === 'query'))
      .toBeLessThan(repeat.operations.findIndex(([operation]) => operation === 'remove'));
    expect(repeat.operations.filter(([operation]) => operation === 'remove')).toEqual([
      ['remove', 'allow_delete_video_requests'],
      ['remove', 'allow_channel_requests'],
      ['remove', 'allow_video_requests'],
    ]);
  });
});
