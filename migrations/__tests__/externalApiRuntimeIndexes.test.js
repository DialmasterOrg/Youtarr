const migration = require('../20261007041058-add-external-api-runtime-indexes');

function queryInterface(initial = []) {
  const indexes = [...initial];
  return {
    indexes,
    showIndex: async () => indexes,
    addIndex: jest.fn(async (_table, fields, { name }) => {
      indexes.push({ name, fields: fields.map(attribute => ({ attribute })) });
    }),
    removeIndex: jest.fn(async (_table, name) => {
      indexes.splice(indexes.findIndex(index => index.name === name), 1);
    }),
  };
}

test('reapply repairs missing runtime indexes without duplicating an equivalent index', async () => {
  const custom = { name: 'operator_catalog_index',
    fields: migration.INDEXES[0].fields.map(attribute => ({ attribute })) };
  const query = queryInterface([custom]);
  await migration.up(query);
  await migration.up(query);
  expect(query.addIndex).toHaveBeenCalledTimes(1);
  await migration.down(query);
  expect(query.indexes).toEqual([custom]);
});

test('rollback preserves unrelated indexes even when their names collide', async () => {
  const unrelated = { name: migration.INDEXES[0].name, fields: [{ attribute: 'message' }] };
  const query = queryInterface([unrelated]);
  await migration.up(query);
  await migration.down(query);
  expect(query.indexes).toEqual([unrelated]);
});
