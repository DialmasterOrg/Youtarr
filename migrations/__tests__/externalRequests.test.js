'use strict';

const migration = require('../20260908102000-create-external-requests');

function queryInterface(existing = false) {
  const operations = [];
  return {
    operations,
    showAllTables: jest.fn().mockResolvedValue(existing ? ['external_requests'] : []),
    showIndex: jest.fn().mockResolvedValue([]),
    createTable: jest.fn(async (table, columns) => operations.push(['create', table, columns])),
    addIndex: jest.fn(async (_table, fields, options) => operations.push(['index', fields, options])),
    dropTable: jest.fn(async (table) => operations.push(['drop', table])),
  };
}

describe('external requests migration', () => {
  const Sequelize = {
    UUID: 'UUID',
    INTEGER: 'INTEGER',
    BOOLEAN: 'BOOLEAN',
    STRING: jest.fn((length) => `STRING(${length})`),
    DATE: 'DATE',
    NOW: 'NOW',
  };

  test('creates scoped request storage and concurrency-safe unique indexes', async () => {
    const qi = queryInterface();
    await migration.up(qi, Sequelize);
    const create = qi.operations.find(([operation]) => operation === 'create');
    expect(create[2].api_key_id.references).toEqual({ model: 'apikeys', key: 'id' });
    expect(create[2].channel_id.references).toEqual({ model: 'channels', key: 'id' });
    expect(create[2].channel_id.allowNull).toBe(true);
    expect(create[2].channel_id.onDelete).toBe('SET NULL');
    expect(create[2].youtube_id.allowNull).toBe(true);
    expect(create[2].channel_url).toEqual(expect.objectContaining({ allowNull: true }));
    expect(create[2].grant_to_requesting_key).toEqual(expect.objectContaining({ allowNull: true }));
    expect(create[2].job_id.onDelete).toBe('SET NULL');
    expect(qi.operations).toContainEqual([
      'index',
      ['active_dedupe_key'],
      { unique: true, name: 'external_requests_active_dedupe_uq' },
    ]);
    expect(qi.operations).toContainEqual([
      'index',
      ['api_key_id', 'idempotency_hash'],
      { unique: true, name: 'external_requests_key_idempotency_uq' },
    ]);
    expect(qi.operations.map(([, , options]) => options?.name)).not.toEqual(expect.arrayContaining([
      'external_requests_catalog_status_idx',
      'external_requests_management_idx',
    ]));
  });

  test('rollback removes the feature table and therefore fails closed', async () => {
    const qi = queryInterface(true);
    await migration.down(qi);
    expect(qi.operations).toEqual([['drop', 'external_requests']]);
  });
});
