'use strict';

// Ordering-invariant tests for the multi-user watch status migrations. There
// is no DDL harness in this repo (migrations run against real MariaDB on
// container startup), so these tests record the queryInterface call sequence
// and assert the orderings that would corrupt an upgrade if regressed:
// backfill before NOT NULL, the new unique index added before the old one is
// removed, and the down-path dedupe before the old key is restored.

const { Sequelize } = require('sequelize');

const multiUser = require('../20260717192412-multi-user-watch-status');
const cursors = require('../20260717203015-watch-status-sync-cursors');

// Minimal queryInterface double: existence checks answer from the provided
// schema state; every mutating call is recorded in order.
function createRecordingQueryInterface({ tables = [], indexes = {} } = {}) {
  const ops = [];
  const record = (op, detail) => ops.push({ op, ...detail });
  return {
    ops,
    showAllTables: async () => tables,
    showIndex: async (table) => indexes[table] || [],
    describeTable: async () => ({}),
    createTable: async (name) => record('createTable', { name }),
    dropTable: async (name) => record('dropTable', { name }),
    addIndex: async (table, fields, options = {}) =>
      record('addIndex', { table, fields, name: options.name, unique: !!options.unique }),
    removeIndex: async (table, identifier) => record('removeIndex', { table, identifier }),
    changeColumn: async (table, column, definition) =>
      record('changeColumn', { table, column, allowNull: definition.allowNull }),
    sequelize: { query: async (sql) => record('query', { sql }) },
  };
}

const opIndex = (ops, predicate) => ops.findIndex(predicate);

describe('multi-user-watch-status migration', () => {
  // Previous schema: video_watch_status exists with the old 2-column unique
  // key; media_server_users does not exist yet.
  const previousSchema = () => createRecordingQueryInterface({
    tables: ['video_watch_status'],
    indexes: {
      video_watch_status: [
        {
          name: 'video_watch_status_video_server_uq',
          fields: [{ attribute: 'video_id' }, { attribute: 'server_type' }],
        },
      ],
    },
  });

  test('up creates the users table and widens the unique key in a safe order', async () => {
    const qi = previousSchema();

    await multiUser.up(qi, Sequelize);

    const ops = qi.ops;
    expect(ops.some((o) => o.op === 'createTable' && o.name === 'media_server_users')).toBe(true);
    expect(
      ops.some((o) => o.op === 'addIndex' && o.name === 'media_server_users_server_user_uq' && o.unique)
    ).toBe(true);

    const backfillAt = opIndex(ops, (o) => o.op === 'query' && /SET server_user_id = '1'/.test(o.sql));
    const notNullAt = opIndex(
      ops,
      (o) => o.op === 'changeColumn' && o.column === 'server_user_id' && o.allowNull === false
    );
    const addNewIndexAt = opIndex(
      ops,
      (o) => o.op === 'addIndex' && o.name === 'video_watch_status_video_server_user_uq'
    );
    const removeOldIndexAt = opIndex(
      ops,
      (o) => o.op === 'removeIndex' && o.identifier === 'video_watch_status_video_server_uq'
    );

    // The NULL backfill must land before the column becomes NOT NULL.
    expect(backfillAt).toBeGreaterThanOrEqual(0);
    expect(notNullAt).toBeGreaterThan(backfillAt);
    // The widened unique key must exist before the old one is dropped, so the
    // table is never without a unique key for updateOnDuplicate.
    expect(addNewIndexAt).toBeGreaterThanOrEqual(0);
    expect(removeOldIndexAt).toBeGreaterThan(addNewIndexAt);

    const newIndex = ops[addNewIndexAt];
    expect(newIndex.fields).toEqual(['video_id', 'server_type', 'server_user_id']);
    expect(newIndex.unique).toBe(true);
  });

  test('down dedupes per-user rows before restoring the old unique key', async () => {
    // Post-up schema: both tables exist; only the new 3-column key remains.
    const qi = createRecordingQueryInterface({
      tables: ['video_watch_status', 'media_server_users'],
      indexes: {
        video_watch_status: [
          {
            name: 'video_watch_status_video_server_user_uq',
            fields: [
              { attribute: 'video_id' },
              { attribute: 'server_type' },
              { attribute: 'server_user_id' },
            ],
          },
        ],
      },
    });

    await multiUser.down(qi, Sequelize);

    const ops = qi.ops;
    expect(ops.some((o) => o.op === 'dropTable' && o.name === 'media_server_users')).toBe(true);

    const dedupeAt = opIndex(ops, (o) => o.op === 'query' && /DELETE w1 FROM video_watch_status/.test(o.sql));
    const removeNewIndexAt = opIndex(
      ops,
      (o) => o.op === 'removeIndex' && o.identifier === 'video_watch_status_video_server_user_uq'
    );
    const restoreOldIndexAt = opIndex(
      ops,
      (o) => o.op === 'addIndex' && o.name === 'video_watch_status_video_server_uq'
    );
    const nullableAt = opIndex(
      ops,
      (o) => o.op === 'changeColumn' && o.column === 'server_user_id' && o.allowNull === true
    );

    // Multi-user rows must collapse to one per (video, server) before the
    // 2-column unique key can be restored.
    expect(dedupeAt).toBeGreaterThanOrEqual(0);
    expect(restoreOldIndexAt).toBeGreaterThan(dedupeAt);
    expect(removeNewIndexAt).toBeGreaterThanOrEqual(0);
    expect(restoreOldIndexAt).toBeGreaterThan(removeNewIndexAt);
    expect(nullableAt).toBeGreaterThanOrEqual(0);
  });

  test('up is idempotent against an already-migrated schema', async () => {
    // Everything already in place: no create/add/remove calls may fire, and
    // the backfill UPDATE is harmless (matches zero rows).
    const qi = createRecordingQueryInterface({
      tables: ['video_watch_status', 'media_server_users'],
      indexes: {
        video_watch_status: [
          {
            name: 'video_watch_status_video_server_user_uq',
            fields: [
              { attribute: 'video_id' },
              { attribute: 'server_type' },
              { attribute: 'server_user_id' },
            ],
          },
        ],
        media_server_users: [
          {
            name: 'media_server_users_server_user_uq',
            fields: [{ attribute: 'server_type' }, { attribute: 'server_user_id' }],
          },
        ],
      },
    });

    await multiUser.up(qi, Sequelize);

    expect(qi.ops.filter((o) => o.op === 'createTable')).toEqual([]);
    expect(qi.ops.filter((o) => o.op === 'addIndex')).toEqual([]);
    expect(qi.ops.filter((o) => o.op === 'removeIndex')).toEqual([]);
  });
});

describe('watch-status-sync-cursors migration', () => {
  test('up creates the cursor table with a unique server_type index', async () => {
    const qi = createRecordingQueryInterface();

    await cursors.up(qi, Sequelize);

    expect(qi.ops.some((o) => o.op === 'createTable' && o.name === 'watch_status_sync_cursors')).toBe(true);
    expect(
      qi.ops.some(
        (o) => o.op === 'addIndex' && o.name === 'watch_status_sync_cursors_server_uq' && o.unique
      )
    ).toBe(true);
  });

  test('down drops the cursor table', async () => {
    const qi = createRecordingQueryInterface({ tables: ['watch_status_sync_cursors'] });

    await cursors.down(qi, Sequelize);

    expect(qi.ops.some((o) => o.op === 'dropTable' && o.name === 'watch_status_sync_cursors')).toBe(true);
  });
});
