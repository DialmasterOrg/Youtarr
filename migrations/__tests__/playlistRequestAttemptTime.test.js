'use strict';

const { Sequelize } = require('sequelize');
const migration = require('../20260912194358-playlist-request-attempt-time');

function recordingInterface() {
  const schema = { auto_download_requested: {}, first_seen_at: {}, downloaded_at: {} };
  const ops = [];
  return {
    schema, ops,
    describeTable: async () => schema,
    addColumn: async (table, column, definition) => {
      schema[column] = definition;
      ops.push({ op: 'add', table, column, definition });
    },
    removeColumn: async (table, column) => {
      delete schema[column];
      ops.push({ op: 'remove', table, column });
    },
  };
}

describe('playlist request attempt time migration', () => {
  test('adds a nullable millisecond timestamp without inventing past attempts', async () => {
    const qi = recordingInterface();
    await migration.up(qi, Sequelize);
    expect(qi.ops).toEqual([{ op: 'add', table: 'playlistvideos', column: 'auto_download_last_attempt_at', definition: {
      type: Sequelize.DATE(3), allowNull: true,
    } }]);
  });

  test('repeated upgrade and rollback preserve request flags and video dates', async () => {
    const qi = recordingInterface();
    await migration.up(qi, Sequelize);
    await migration.up(qi, Sequelize);
    await migration.down(qi);
    await migration.down(qi);
    expect(qi.ops.map(({ op }) => op)).toEqual(['add', 'remove']);
    expect(qi.schema).toEqual({ auto_download_requested: {}, first_seen_at: {}, downloaded_at: {} });
  });
});
