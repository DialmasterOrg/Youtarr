'use strict';

// On databases not created with utf8mb4 defaults, the 20250907 conversion
// migration coerced Jobs.id/JobVideos.job_id from their binary collation to
// utf8mb4_unicode_ci, and the later JobVideoDownloads migration then failed
// with errno 150 on its foreign key. There is no DDL harness in this repo, so
// these tests record the queryInterface call sequence and assert the repair
// statements are issued in an order that keeps the FK creatable.

const { Sequelize } = require('sequelize');

const {
  findStaleUuidColumns,
  repairUuidColumns,
  ensureJobsUuidBinaryCollation,
} = require('../lib/jobsUuidCollation');

const jvdMigration = require('../20251010162434-add-jobvideodownloads-table');
const utf8mb4Migration = require('../20250907000000-upgrade-to-utf8mb4-if-needed');

// Minimal queryInterface double. `collations` maps 'Table.column' to a
// collation name; a missing key means the table/column does not exist.
// Every non-SELECT statement is recorded in order.
function createDouble({
  collations = {},
  tables = [],
  dbInfo = { name: 'youtarr', charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' },
  tableCollations = [],
  failOnSqlMatching = null,
} = {}) {
  const ops = [];
  const transactions = [];

  const sequelize = {
    query: async (sql, options = {}) => {
      if (/FROM information_schema\.COLUMNS/i.test(sql)) {
        const [table, column] = options.replacements;
        const key = `${table}.${column}`;
        return key in collations ? [{ COLLATION_NAME: collations[key] }] : [];
      }
      if (/FROM information_schema\.SCHEMATA/i.test(sql)) {
        return [dbInfo];
      }
      if (/FROM information_schema\.tables/i.test(sql)) {
        return tableCollations;
      }
      if (failOnSqlMatching && failOnSqlMatching.test(sql)) {
        ops.push({ sql });
        throw new Error(`forced failure for: ${sql}`);
      }
      ops.push({ sql });
      return [];
    },
    transaction: async () => {
      const record = { committed: false, rolledBack: false };
      transactions.push(record);
      return {
        commit: async () => {
          record.committed = true;
        },
        rollback: async () => {
          record.rolledBack = true;
        },
      };
    },
  };

  return {
    ops,
    transactions,
    sequelize,
    showAllTables: async () => tables,
    showIndex: async () => [],
    createTable: async (name) => ops.push({ sql: `CREATE ${name}` }),
    addIndex: async (table, fields, options = {}) =>
      ops.push({ sql: `INDEX ${table} ${JSON.stringify(fields)} ${options.name || ''}` }),
  };
}

const sqlIndex = (ops, pattern) => ops.findIndex((op) => pattern.test(op.sql));

describe('findStaleUuidColumns', () => {
  test('returns empty when every UUID FK column is already utf8mb4_bin', async () => {
    const qi = createDouble({
      collations: {
        'Jobs.id': 'utf8mb4_bin',
        'JobVideos.job_id': 'utf8mb4_bin',
        'JobVideoDownloads.job_id': 'utf8mb4_bin',
      },
    });
    expect(await findStaleUuidColumns(qi)).toEqual([]);
  });

  test('returns the columns whose collation was coerced away from utf8mb4_bin', async () => {
    const qi = createDouble({
      collations: {
        'Jobs.id': 'utf8mb4_unicode_ci',
        'JobVideos.job_id': 'utf8mb4_unicode_ci',
      },
    });
    const stale = await findStaleUuidColumns(qi);
    expect(stale).toEqual([
      { table: 'Jobs', column: 'id' },
      { table: 'JobVideos', column: 'job_id' },
    ]);
  });

  test('skips tables that do not exist', async () => {
    const qi = createDouble({ collations: { 'Jobs.id': 'utf8mb4_bin' } });
    expect(await findStaleUuidColumns(qi)).toEqual([]);
  });
});

describe('repairUuidColumns', () => {
  test('issues a MODIFY to CHAR(36) utf8mb4_bin for each stale column', async () => {
    const qi = createDouble();
    await repairUuidColumns(qi, [
      { table: 'Jobs', column: 'id' },
      { table: 'JobVideos', column: 'job_id' },
    ]);
    expect(
      sqlIndex(qi.ops, /ALTER TABLE `Jobs` MODIFY `id` CHAR\(36\).*COLLATE utf8mb4_bin NOT NULL/)
    ).not.toBe(-1);
    expect(
      sqlIndex(qi.ops, /ALTER TABLE `JobVideos` MODIFY `job_id` CHAR\(36\).*COLLATE utf8mb4_bin NOT NULL/)
    ).not.toBe(-1);
  });
});

describe('ensureJobsUuidBinaryCollation', () => {
  test('does nothing when no column is stale', async () => {
    const qi = createDouble({
      collations: { 'Jobs.id': 'utf8mb4_bin', 'JobVideos.job_id': 'utf8mb4_bin' },
    });
    const repaired = await ensureJobsUuidBinaryCollation(qi);
    expect(repaired).toBe(false);
    expect(qi.ops).toEqual([]);
  });

  test('repairs stale columns inside a FOREIGN_KEY_CHECKS=0 window and commits', async () => {
    const qi = createDouble({
      collations: { 'Jobs.id': 'utf8mb4_unicode_ci', 'JobVideos.job_id': 'utf8mb4_unicode_ci' },
    });
    const repaired = await ensureJobsUuidBinaryCollation(qi);
    expect(repaired).toBe(true);

    const fkOff = sqlIndex(qi.ops, /SET FOREIGN_KEY_CHECKS = 0/);
    const alterJobs = sqlIndex(qi.ops, /ALTER TABLE `Jobs` MODIFY `id`/);
    const alterJobVideos = sqlIndex(qi.ops, /ALTER TABLE `JobVideos` MODIFY `job_id`/);
    const fkOn = sqlIndex(qi.ops, /SET FOREIGN_KEY_CHECKS = 1/);

    expect(fkOff).not.toBe(-1);
    expect(fkOn).not.toBe(-1);
    expect(fkOff).toBeLessThan(alterJobs);
    expect(fkOff).toBeLessThan(alterJobVideos);
    expect(alterJobs).toBeLessThan(fkOn);
    expect(alterJobVideos).toBeLessThan(fkOn);
    expect(qi.transactions[0].committed).toBe(true);
  });

  test('re-enables foreign key checks and rolls back if a repair fails', async () => {
    const qi = createDouble({
      collations: { 'Jobs.id': 'utf8mb4_unicode_ci' },
      failOnSqlMatching: /ALTER TABLE `Jobs`/,
    });
    await expect(ensureJobsUuidBinaryCollation(qi)).rejects.toThrow('forced failure');

    const failedAlter = sqlIndex(qi.ops, /ALTER TABLE `Jobs`/);
    const fkOn = sqlIndex(qi.ops, /SET FOREIGN_KEY_CHECKS = 1/);
    expect(fkOn).toBeGreaterThan(failedAlter);
    expect(qi.transactions[0].rolledBack).toBe(true);
  });
});

describe('add-jobvideodownloads-table migration', () => {
  test('repairs a coerced Jobs.id collation before creating the table', async () => {
    const qi = createDouble({
      tables: ['Jobs', 'JobVideos', 'Videos'],
      collations: { 'Jobs.id': 'utf8mb4_unicode_ci', 'JobVideos.job_id': 'utf8mb4_unicode_ci' },
    });
    await jvdMigration.up(qi, Sequelize);

    const alterJobs = sqlIndex(qi.ops, /ALTER TABLE `Jobs` MODIFY `id`/);
    const createTable = sqlIndex(qi.ops, /^CREATE JobVideoDownloads$/);
    expect(alterJobs).not.toBe(-1);
    expect(createTable).not.toBe(-1);
    expect(alterJobs).toBeLessThan(createTable);
  });

  test('creates the table without any repair when collations are already binary', async () => {
    const qi = createDouble({
      tables: ['Jobs', 'JobVideos', 'Videos'],
      collations: { 'Jobs.id': 'utf8mb4_bin', 'JobVideos.job_id': 'utf8mb4_bin' },
    });
    await jvdMigration.up(qi, Sequelize);

    expect(sqlIndex(qi.ops, /ALTER TABLE/)).toBe(-1);
    expect(sqlIndex(qi.ops, /^CREATE JobVideoDownloads$/)).not.toBe(-1);
  });
});

describe('upgrade-to-utf8mb4-if-needed migration', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('restores utf8mb4_bin on UUID FK columns after converting tables', async () => {
    const qi = createDouble({
      dbInfo: { name: 'youtarr', charset: 'latin1', collation: 'latin1_swedish_ci' },
      tableCollations: [
        { TABLE_NAME: 'Jobs', TABLE_COLLATION: 'latin1_swedish_ci' },
        { TABLE_NAME: 'JobVideos', TABLE_COLLATION: 'latin1_swedish_ci' },
      ],
      // State as CONVERT TO leaves it: bin collation coerced to unicode_ci.
      collations: { 'Jobs.id': 'utf8mb4_unicode_ci', 'JobVideos.job_id': 'utf8mb4_unicode_ci' },
    });
    await utf8mb4Migration.up(qi, Sequelize);

    const convertJobs = sqlIndex(qi.ops, /ALTER TABLE `Jobs` CONVERT TO/);
    const alterJobs = sqlIndex(qi.ops, /ALTER TABLE `Jobs` MODIFY `id`/);
    const alterJobVideos = sqlIndex(qi.ops, /ALTER TABLE `JobVideos` MODIFY `job_id`/);
    const fkOn = sqlIndex(qi.ops, /SET FOREIGN_KEY_CHECKS = 1/);

    expect(alterJobs).toBeGreaterThan(convertJobs);
    expect(alterJobVideos).toBeGreaterThan(convertJobs);
    expect(fkOn).toBeGreaterThan(alterJobs);
    expect(fkOn).toBeGreaterThan(alterJobVideos);
  });

  test('still skips entirely when the database is already utf8mb4', async () => {
    const qi = createDouble({
      dbInfo: { name: 'youtarr', charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' },
      tableCollations: [],
      collations: { 'Jobs.id': 'utf8mb4_bin', 'JobVideos.job_id': 'utf8mb4_bin' },
    });
    await utf8mb4Migration.up(qi, Sequelize);

    expect(sqlIndex(qi.ops, /ALTER TABLE/)).toBe(-1);
  });
});
