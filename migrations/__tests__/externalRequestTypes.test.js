'use strict';

const migration = require('../20260908103000-expand-external-request-types');

function queryInterface(
  columns = {},
  indexes = [],
  foreignKeys = [{
    columnName: 'channel_id',
    constraintName: 'external_requests_ibfk_2',
  }]
) {
  const operations = [];
  return {
    operations,
    describeTable: jest.fn().mockResolvedValue(columns),
    showIndex: jest.fn().mockResolvedValue(indexes),
    getForeignKeyReferencesForTable: jest.fn().mockResolvedValue(foreignKeys),
    addColumn: jest.fn(async (_table, column, definition) =>
      operations.push(['add', column, definition])),
    changeColumn: jest.fn(async (_table, column, definition) =>
      operations.push(['change', column, definition])),
    addConstraint: jest.fn(async (_table, definition) =>
      operations.push(['addConstraint', definition])),
    removeConstraint: jest.fn(async (_table, name) =>
      operations.push(['removeConstraint', name])),
    addIndex: jest.fn(async (_table, fields, options) =>
      operations.push(['addIndex', fields, options])),
    removeIndex: jest.fn(async (_table, name) => operations.push(['removeIndex', name])),
    removeColumn: jest.fn(async (_table, column) => operations.push(['remove', column])),
    bulkDelete: jest.fn(async (_table, where) => operations.push(['delete', where])),
  };
}

describe('external request type expansion migration', () => {
  const Sequelize = {
    INTEGER: 'INTEGER',
    BOOLEAN: 'BOOLEAN',
    STRING: jest.fn((length) => `STRING(${length})`),
    Op: { in: Symbol('in') },
  };

  test('adds nullable channel targets and the management queue index idempotently', async () => {
    const fresh = queryInterface();
    await migration.up(fresh, Sequelize);

    expect(fresh.operations).toContainEqual([
      'add',
      'channel_url',
      { type: 'STRING(500)', allowNull: true },
    ]);
    expect(fresh.operations).toContainEqual([
      'add',
      'grant_to_requesting_key',
      { type: 'BOOLEAN', allowNull: true },
    ]);
    expect(fresh.operations).toContainEqual([
      'addIndex',
      ['request_type', 'status', 'created_at', 'id'],
      { name: 'external_requests_management_idx' },
    ]);
    expect(fresh.operations).toContainEqual([
      'change',
      'channel_id',
      expect.objectContaining({ allowNull: true }),
    ]);
    expect(fresh.operations).toContainEqual([
      'removeConstraint',
      'external_requests_ibfk_2',
    ]);
    expect(fresh.operations).toContainEqual([
      'addConstraint',
      expect.objectContaining({
        fields: ['channel_id'],
        type: 'foreign key',
        name: 'external_requests_channel_fk',
        onDelete: 'SET NULL',
      }),
    ]);
    expect(fresh.operations).toContainEqual([
      'change',
      'youtube_id',
      expect.objectContaining({ allowNull: true }),
    ]);

    const existing = queryInterface(
      { channel_url: {}, grant_to_requesting_key: {} },
      [{ name: 'external_requests_management_idx', fields: [] }]
    );
    await migration.up(existing, Sequelize);
    expect(existing.operations.filter(([operation]) => operation === 'add')).toEqual([]);
    expect(existing.operations.filter(([operation]) => operation === 'addIndex')).toEqual([]);
  });

  test('rollback removes non-video records before restoring non-null columns', async () => {
    const qi = queryInterface(
      { channel_url: {}, grant_to_requesting_key: {} },
      [{ name: 'external_requests_management_idx', fields: [] }]
    );
    await migration.down(qi, Sequelize);

    const deleteAt = qi.operations.findIndex(([operation]) => operation === 'delete');
    const channelChangeAt = qi.operations.findIndex(
      ([operation, column]) => operation === 'change' && column === 'channel_id'
    );
    const channelConstraintAt = qi.operations.findIndex(
      ([operation, definition]) =>
        operation === 'addConstraint' && definition.onDelete === 'CASCADE'
    );
    expect(deleteAt).toBeGreaterThanOrEqual(0);
    expect(channelChangeAt).toBeGreaterThan(deleteAt);
    expect(channelConstraintAt).toBeGreaterThan(channelChangeAt);
    expect(qi.operations).toContainEqual([
      'removeIndex',
      'external_requests_management_idx',
    ]);
    expect(qi.operations).toContainEqual(['remove', 'channel_url']);
    expect(qi.operations).toContainEqual(['remove', 'grant_to_requesting_key']);
  });
});
