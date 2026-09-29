'use strict';

const migration = require('../20260929100000-add-external-api-runtime-indexes');

const indexShape = (name, fields) => ({
  name,
  fields: fields.map((field) => ({
    attribute: typeof field === 'string' ? field : field.name,
  })),
});

function queryInterface(initialIndexes = {}) {
  const indexes = Object.fromEntries(Object.entries(initialIndexes).map(([table, entries]) => [
    table,
    entries.map(({ name, fields }) => indexShape(name, fields)),
  ]));
  const operations = [];

  return {
    operations,
    indexes,
    showIndex: jest.fn(async (table) => indexes[table] || []),
    addIndex: jest.fn(async (table, fields, { name }) => {
      operations.push(['add', table, name]);
      indexes[table] = [...(indexes[table] || []), indexShape(name, fields)];
    }),
    removeIndex: jest.fn(async (table, name) => {
      operations.push(['remove', table, name]);
      indexes[table] = (indexes[table] || []).filter((index) => index.name !== name);
    }),
  };
}

describe('external API runtime index migration', () => {
  test('adds the justified catalog and request-list indexes once', async () => {
    const qi = queryInterface();

    await migration.up(qi);
    await migration.up(qi);

    expect(qi.operations.filter(([operation]) => operation === 'add')).toEqual(
      migration.INDEXES.map(({ table, name }) => ['add', table, name])
    );
    expect(qi.operations.map(([, , name]) => name)).not.toEqual(expect.arrayContaining([
      'channels_external_channel_id_idx',
      'channelvideos_external_youtube_idx',
      'channelvideos_external_catalog_seek_idx',
    ]));
    expect(qi.showIndex).toHaveBeenCalled();
  });

  test('accepts equivalent indexes under existing names', async () => {
    const equivalents = migration.INDEXES.reduce((result, { table, fields }, index) => {
      result[table] = [...(result[table] || []), {
        name: `existing_equivalent_${index}`,
        fields,
      }];
      return result;
    }, {});
    const qi = queryInterface(equivalents);

    await migration.up(qi);
    await migration.down(qi);

    expect(qi.operations).toEqual([]);
  });

  test('removes only its own named indexes on rollback', async () => {
    const ownIndexes = migration.INDEXES.reduce((result, { table, fields, name }) => {
      result[table] = [...(result[table] || []), { name, fields }];
      return result;
    }, {});
    ownIndexes.channels.push({ name: 'channels_channel_id_idx', fields: ['channel_id'] });
    const qi = queryInterface(ownIndexes);

    await migration.down(qi);

    expect(qi.operations).toEqual(
      migration.INDEXES.slice().reverse().map(({ table, name }) => ['remove', table, name])
    );
    expect(qi.indexes.channels.map((index) => index.name)).toContain('channels_channel_id_idx');
  });
});
