'use strict';

// Databases whose default charset was already utf8mb4 when the 20250907
// upgrade ran were skipped wholesale, leaving their original tables on
// utf8mb4_general_ci (or utf8mb3) next to tables created later with an
// explicit utf8mb4_unicode_ci. Any SQL comparing string columns across the
// two groups fails with ER_CANT_AGGREGATE_2COLLATIONS.

const { createCollationSchemaDouble } = require('./support/collationSchemaDouble');
const {
  findTablesNeedingConversion,
  findStaleUuidColumns,
  normalizeUnicodeCollation,
} = require('../lib/unicodeCollation');

const UNICODE = 'utf8mb4_unicode_ci';
const GENERAL = 'utf8mb4_general_ci';
const BIN = 'utf8mb4_bin';

function legacyMixedSchema() {
  return {
    database: { name: 'youtarr', charset: 'utf8mb4', collation: UNICODE },
    tables: {
      videos: { collation: GENERAL, columns: { youtube_id: GENERAL } },
      channels: { collation: GENERAL, columns: { channel_id: GENERAL } },
      jobs: { collation: GENERAL, columns: { id: BIN, status: GENERAL } },
      jobvideos: { collation: GENERAL, columns: { job_id: BIN } },
      jobvideodownloads: { collation: GENERAL, columns: { job_id: BIN } },
      playlistvideos: { collation: UNICODE, columns: { youtube_id: UNICODE } },
      SequelizeMeta: { collation: 'utf8_unicode_ci', columns: { name: 'utf8_unicode_ci' } },
    },
  };
}

function normalizedSchema() {
  return {
    database: { name: 'youtarr', charset: 'utf8mb4', collation: UNICODE },
    tables: {
      videos: { collation: UNICODE, columns: { youtube_id: UNICODE } },
      jobs: { collation: UNICODE, columns: { id: BIN } },
      jobvideos: { collation: UNICODE, columns: { job_id: BIN } },
      jobvideodownloads: { collation: UNICODE, columns: { job_id: BIN } },
      playlistvideos: { collation: UNICODE, columns: { youtube_id: UNICODE } },
    },
  };
}

const tableCollations = (tables) =>
  Object.fromEntries(Object.entries(tables).map(([name, table]) => [name, table.collation]));

describe('findTablesNeedingConversion', () => {
  test('lists every base table not on utf8mb4_unicode_ci, including utf8mb3 leftovers', async () => {
    const qi = createCollationSchemaDouble(legacyMixedSchema());
    const names = (await findTablesNeedingConversion(qi)).map((table) => table.name).sort();
    expect(names).toEqual(['SequelizeMeta', 'channels', 'jobs', 'jobvideodownloads', 'jobvideos', 'videos']);
  });

  test('returns nothing when every table is already on utf8mb4_unicode_ci', async () => {
    const qi = createCollationSchemaDouble(normalizedSchema());
    expect(await findTablesNeedingConversion(qi)).toEqual([]);
  });
});

describe('findStaleUuidColumns', () => {
  test('returns the UUID foreign key columns that are not utf8mb4_bin', async () => {
    const schema = normalizedSchema();
    schema.tables.jobs.columns.id = UNICODE;
    schema.tables.jobvideos.columns.job_id = UNICODE;
    const qi = createCollationSchemaDouble(schema);
    expect(await findStaleUuidColumns(qi)).toEqual([
      { table: 'jobs', column: 'id' },
      { table: 'jobvideos', column: 'job_id' },
    ]);
  });

  test('skips UUID columns whose table does not exist', async () => {
    const schema = normalizedSchema();
    delete schema.tables.jobvideodownloads;
    schema.tables.jobs.columns.id = UNICODE;
    const qi = createCollationSchemaDouble(schema);
    expect(await findStaleUuidColumns(qi)).toEqual([{ table: 'jobs', column: 'id' }]);
  });

  test('matches table names case-insensitively and reports the stored name', async () => {
    const schema = normalizedSchema();
    delete schema.tables.jobs;
    schema.tables.Jobs = { collation: UNICODE, columns: { id: UNICODE } };
    const qi = createCollationSchemaDouble(schema);
    expect(await findStaleUuidColumns(qi)).toEqual([{ table: 'Jobs', column: 'id' }]);
  });
});

describe('normalizeUnicodeCollation', () => {
  test('issues no statements and opens no transaction when the schema is already normalized', async () => {
    const qi = createCollationSchemaDouble(normalizedSchema());
    const result = await normalizeUnicodeCollation(qi);
    expect(qi.ops).toEqual([]);
    expect(qi.transactions).toEqual([]);
    expect(result).toEqual({ databaseChanged: false, convertedTables: [], restoredUuidColumns: [] });
  });

  test('brings every table to utf8mb4_unicode_ci and leaves already-correct tables untouched', async () => {
    const qi = createCollationSchemaDouble(legacyMixedSchema());
    await normalizeUnicodeCollation(qi);
    expect(tableCollations(qi.tables)).toEqual({
      videos: UNICODE, channels: UNICODE, jobs: UNICODE, jobvideos: UNICODE,
      jobvideodownloads: UNICODE, playlistvideos: UNICODE, SequelizeMeta: UNICODE,
    });
    expect(qi.ops.some((op) => /ALTER TABLE `playlistvideos`/.test(op.sql))).toBe(false);
  });

  test('sets the database default collation when it is not utf8mb4_unicode_ci', async () => {
    const schema = legacyMixedSchema();
    schema.database.collation = GENERAL;
    const qi = createCollationSchemaDouble(schema);
    const result = await normalizeUnicodeCollation(qi);
    expect(qi.database.collation).toBe(UNICODE);
    expect(result.databaseChanged).toBe(true);
  });

  test('leaves the database default alone when it is already utf8mb4_unicode_ci', async () => {
    const qi = createCollationSchemaDouble(legacyMixedSchema());
    const result = await normalizeUnicodeCollation(qi);
    expect(qi.ops.some((op) => /ALTER DATABASE/.test(op.sql))).toBe(false);
    expect(result.databaseChanged).toBe(false);
  });

  test('restores utf8mb4_bin on the UUID foreign key columns that CONVERT TO coerces', async () => {
    const qi = createCollationSchemaDouble(legacyMixedSchema());
    const result = await normalizeUnicodeCollation(qi);
    expect(qi.tables.jobs.columns).toEqual({ id: BIN, status: UNICODE });
    expect(qi.tables.jobvideos.columns.job_id).toBe(BIN);
    expect(qi.tables.jobvideodownloads.columns.job_id).toBe(BIN);
    expect(result.restoredUuidColumns).toEqual(['jobs.id', 'jobvideos.job_id', 'jobvideodownloads.job_id']);
  });

  test('repairs coerced UUID columns even when no table needs conversion', async () => {
    const schema = normalizedSchema();
    schema.tables.jobs.columns.id = UNICODE;
    const qi = createCollationSchemaDouble(schema);
    const result = await normalizeUnicodeCollation(qi);
    expect(qi.tables.jobs.columns.id).toBe(BIN);
    expect(result).toEqual({ databaseChanged: false, convertedTables: [], restoredUuidColumns: ['jobs.id'] });
  });

  test('runs every ALTER inside one FOREIGN_KEY_CHECKS=0 window on a single committed transaction', async () => {
    const schema = legacyMixedSchema();
    schema.database.collation = GENERAL;
    const qi = createCollationSchemaDouble(schema);
    await normalizeUnicodeCollation(qi);

    const alters = qi.ops.filter((op) => /^ALTER/.test(op.sql));
    expect(alters.length).toBeGreaterThan(0);
    expect(alters.every((op) => op.foreignKeyChecks === 0)).toBe(true);
    expect(qi.ops[0].sql).toBe('SET FOREIGN_KEY_CHECKS = 0');
    expect(qi.ops[qi.ops.length - 1].sql).toBe('SET FOREIGN_KEY_CHECKS = 1');
    expect(new Set(qi.ops.map((op) => op.transaction)).size).toBe(1);
    expect(qi.ops[0].transaction).toBeDefined();
    expect(qi.transactions).toEqual([{ committed: true, rolledBack: false }]);
  });

  test('re-enables foreign key checks, rolls back, and rethrows when a conversion fails', async () => {
    const qi = createCollationSchemaDouble({
      ...legacyMixedSchema(),
      failOnSqlMatching: /ALTER TABLE `channels` CONVERT/,
    });
    await expect(normalizeUnicodeCollation(qi)).rejects.toThrow(/forced failure/);
    expect(qi.state.foreignKeyChecks).toBe(1);
    expect(qi.transactions).toEqual([{ committed: false, rolledBack: true }]);
  });
});
