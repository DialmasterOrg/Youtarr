const { DataTypes } = require('sequelize');
const migration = require('../20261022045156-add-external-request-approval-source');

function queryInterface(columns = {}) {
  const table = { ...columns };
  return {
    table,
    describeTable: async () => table,
    addColumn: jest.fn(async (_table, name, definition) => { table[name] = definition; }),
    removeColumn: jest.fn(async (_table, name) => { delete table[name]; }),
  };
}

test('adds a nullable approval_source column once', async () => {
  const query = queryInterface({ id: {} });
  await migration.up(query, DataTypes);
  await migration.up(query, DataTypes);
  expect(query.addColumn).toHaveBeenCalledTimes(1);
  expect(query.table.approval_source).toMatchObject({ allowNull: true, defaultValue: null });
});

test('rollback removes the column and tolerates a missing one', async () => {
  const query = queryInterface({ id: {}, approval_source: {} });
  await migration.down(query);
  await migration.down(query);
  expect(query.removeColumn).toHaveBeenCalledTimes(1);
  expect(query.table).not.toHaveProperty('approval_source');
});
