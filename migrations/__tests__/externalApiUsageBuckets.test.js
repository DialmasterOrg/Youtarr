'use strict';

const migration = require('../20260908106000-create-external-api-usage-buckets');

function queryInterface({ tables = ['apikeys'], columns = {} } = {}) {
  const operations = [];
  return {
    operations,
    showAllTables: jest.fn().mockImplementation(async () => [...tables]),
    describeTable: jest.fn().mockResolvedValue(columns),
    showIndex: jest.fn().mockResolvedValue([]),
    addColumn: jest.fn(async (_table, column) => operations.push(['addColumn', column])),
    removeColumn: jest.fn(async (_table, column) => operations.push(['removeColumn', column])),
    createTable: jest.fn(async (table) => {
      tables.push(table);
      operations.push(['createTable', table]);
    }),
    dropTable: jest.fn(async (table) => operations.push(['dropTable', table])),
    addIndex: jest.fn(async (_table, _fields, options) =>
      operations.push(['addIndex', options.name])),
  };
}

describe('external API usage bucket migration', () => {
  test('creates durable usage buckets and their indexes', async () => {
    const qi = queryInterface();
    await migration.up(qi, {
      INTEGER: 'INTEGER',
      BIGINT: 'BIGINT',
      STRING: jest.fn(() => 'STRING'),
      DATE: 'DATE',
      NOW: 'NOW',
    });
    expect(qi.operations).toEqual(expect.arrayContaining([
      ['createTable', 'external_api_usage_buckets'],
      ['addIndex', 'external_api_usage_key_window_uq'],
      ['addIndex', 'external_api_usage_window_idx'],
    ]));
  });

  test('drops usage storage before removing policy columns', async () => {
    const qi = queryInterface({
      tables: ['apikeys', 'external_api_usage_buckets'],
    });
    await migration.down(qi);
    expect(qi.operations[0]).toEqual(['dropTable', 'external_api_usage_buckets']);
    expect(qi.operations.slice(1)).toEqual([]);
  });
});
