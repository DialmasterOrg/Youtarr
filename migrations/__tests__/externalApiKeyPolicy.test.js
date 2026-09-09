'use strict';

const migration = require('../20260908100000-add-external-api-key-policy');

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

describe('external API key policy migration', () => {
  test('backfills safe legacy defaults and is idempotent', async () => {
    const qi = queryInterface();
    await migration.up(qi, { STRING: () => 'STRING', BOOLEAN: 'BOOLEAN', INTEGER: 'INTEGER', JSON: 'JSON', DATE: 'DATE' });
    expect(qi.operations.filter(([op]) => op === 'add')).toHaveLength(8);
    expect(qi.operations.some(([, sql]) => /legacy_download/.test(sql))).toBe(true);
    expect(qi.operations.some(([, sql]) => /JSON_ARRAY\('video'\)/.test(sql))).toBe(true);
    expect(qi.operations).toContainEqual(['change', 'allowed_media_types']);

    const existing = Object.fromEntries(['role', 'auto_approve_video_requests', 'auto_approve_channel_requests',
      'auto_approve_delete_requests', 'max_rating_level', 'allow_unrated', 'allowed_media_types', 'revoked_at'].map((key) => [key, {}]));
    const repeat = queryInterface(existing);
    await migration.up(repeat, { STRING: () => 'STRING', BOOLEAN: 'BOOLEAN', INTEGER: 'INTEGER', JSON: 'JSON', DATE: 'DATE' });
    expect(repeat.operations.filter(([op]) => op === 'add')).toEqual([]);
  });

  test('disables external roles before rollback drops their distinguishing fields', async () => {
    const qi = queryInterface({ role: {}, revoked_at: {}, allowed_media_types: {} });
    await migration.down(qi);
    const disableAt = qi.operations.findIndex(([, sql]) => /SET is_active = false/.test(sql || ''));
    const removeRoleAt = qi.operations.findIndex(([op, column]) => op === 'remove' && column === 'role');
    expect(disableAt).toBeGreaterThanOrEqual(0);
    expect(removeRoleAt).toBeGreaterThan(disableAt);
    expect(qi.operations[disableAt][1]).toContain("role <> 'legacy_download'");
  });
});
