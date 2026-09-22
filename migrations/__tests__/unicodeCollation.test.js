'use strict';

// Databases whose default charset was already utf8mb4 when the 20250907
// upgrade ran were skipped wholesale, leaving their original tables on
// utf8mb4_general_ci (or utf8mb3) next to tables created later with an
// explicit utf8mb4_unicode_ci. Any SQL comparing string columns across the
// two groups fails with ER_CANT_AGGREGATE_2COLLATIONS.
//
// Newer MariaDB refuses collation changes on foreign key columns even with
// FOREIGN_KEY_CHECKS=0, so the jobs keys get dropped around the conversion.

const { createCollationSchemaDouble } = require('./support/collationSchemaDouble');
const {
  findTablesNeedingConversion,
  findStaleUuidColumns,
  findUuidForeignKeys,
  selectUuidForeignKeys,
  normalizeUnicodeCollation,
} = require('../lib/unicodeCollation');

const UNICODE = 'utf8mb4_unicode_ci';
const GENERAL = 'utf8mb4_general_ci';
const BIN = 'utf8mb4_bin';

const jobVideosJobFk = () => ({
  name: 'JobVideos_ibfk_1', columns: ['job_id'], referencedTable: 'jobs', referencedColumns: ['id'],
  updateRule: 'CASCADE', deleteRule: 'RESTRICT',
});
const jobVideosVideoFk = () => ({
  name: 'JobVideos_ibfk_2', columns: ['video_id'], referencedTable: 'videos', referencedColumns: ['id'],
  updateRule: 'CASCADE', deleteRule: 'RESTRICT',
});
const jobVideoDownloadsJobFk = () => ({
  name: 'JobVideoDownloads_ibfk_1', columns: ['job_id'], referencedTable: 'jobs', referencedColumns: ['id'],
  updateRule: 'CASCADE', deleteRule: 'CASCADE',
});

function legacyMixedSchema() {
  return {
    database: { name: 'youtarr', charset: 'utf8mb4', collation: UNICODE },
    tables: {
      videos: { collation: GENERAL, columns: { youtube_id: GENERAL } },
      channels: { collation: GENERAL, columns: { channel_id: GENERAL } },
      jobs: { collation: GENERAL, columns: { id: BIN, status: GENERAL } },
      jobvideos: { collation: GENERAL, columns: { job_id: BIN }, foreignKeys: [jobVideosJobFk(), jobVideosVideoFk()] },
      jobvideodownloads: { collation: GENERAL, columns: { job_id: BIN }, foreignKeys: [jobVideoDownloadsJobFk()] },
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
      jobvideos: { collation: UNICODE, columns: { job_id: BIN }, foreignKeys: [jobVideosJobFk(), jobVideosVideoFk()] },
      jobvideodownloads: { collation: UNICODE, columns: { job_id: BIN }, foreignKeys: [jobVideoDownloadsJobFk()] },
      playlistvideos: { collation: UNICODE, columns: { youtube_id: UNICODE } },
    },
  };
}

const NO_CHANGES = { databaseChanged: false, convertedTables: [], restoredUuidColumns: [], restoredForeignKeys: [] };

const tableCollations = (tables) =>
  Object.fromEntries(Object.entries(tables).map(([name, table]) => [name, table.collation]));

const usageRow = (fk, table, position = 0) => ({
  name: fk.name,
  table,
  column: fk.columns[position],
  position: position + 1,
  referencedTable: fk.referencedTable,
  referencedColumn: fk.referencedColumns[position],
  updateRule: fk.updateRule,
  deleteRule: fk.deleteRule,
});

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

describe('selectUuidForeignKeys', () => {
  test('keeps the foreign keys on the jobs UUID chain and drops the rest', () => {
    const rows = [
      usageRow(jobVideosJobFk(), 'jobvideos'),
      usageRow(jobVideosVideoFk(), 'jobvideos'),
      usageRow(jobVideoDownloadsJobFk(), 'jobvideodownloads'),
    ];
    expect(selectUuidForeignKeys(rows)).toEqual([
      { ...jobVideosJobFk(), table: 'jobvideos' },
      { ...jobVideoDownloadsJobFk(), table: 'jobvideodownloads' },
    ]);
  });

  test('keeps a foreign key from a table outside the chain when it references jobs.id', () => {
    const archiveFk = {
      name: 'archive_ibfk_1', columns: ['job_id'], referencedTable: 'jobs', referencedColumns: ['id'],
      updateRule: 'NO ACTION', deleteRule: 'SET NULL',
    };
    expect(selectUuidForeignKeys([usageRow(archiveFk, 'archive')])).toEqual([{ ...archiveFk, table: 'archive' }]);
  });

  test('matches table names case-insensitively and reports them as stored', () => {
    const rows = [usageRow(jobVideosJobFk(), 'JobVideos')];
    rows[0].referencedTable = 'Jobs';
    expect(selectUuidForeignKeys(rows)).toEqual([{ ...jobVideosJobFk(), table: 'JobVideos', referencedTable: 'Jobs' }]);
  });

  test('assembles multi-column keys in ordinal order', () => {
    const composite = {
      name: 'wide_fk', columns: ['job_id', 'seq'], referencedTable: 'jobs', referencedColumns: ['id', 'seq'],
      updateRule: 'CASCADE', deleteRule: 'CASCADE',
    };
    const rows = [usageRow(composite, 'wide', 1), usageRow(composite, 'wide', 0)];
    expect(selectUuidForeignKeys(rows)).toEqual([{ ...composite, table: 'wide' }]);
  });
});

describe('findUuidForeignKeys', () => {
  test('reads the jobs foreign keys from information_schema with their stored names and rules', async () => {
    const qi = createCollationSchemaDouble(legacyMixedSchema());
    expect(await findUuidForeignKeys(qi)).toEqual([
      { ...jobVideosJobFk(), table: 'jobvideos' },
      { ...jobVideoDownloadsJobFk(), table: 'jobvideodownloads' },
    ]);
  });
});

describe('normalizeUnicodeCollation', () => {
  test('issues no statements and opens no transaction when the schema is already normalized', async () => {
    const qi = createCollationSchemaDouble(normalizedSchema());
    const result = await normalizeUnicodeCollation(qi);
    expect(qi.ops).toEqual([]);
    expect(qi.transactions).toEqual([]);
    expect(result).toEqual(NO_CHANGES);
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
    expect(result).toEqual({
      ...NO_CHANGES,
      restoredUuidColumns: ['jobs.id'],
      restoredForeignKeys: ['jobvideos.JobVideos_ibfk_1', 'jobvideodownloads.JobVideoDownloads_ibfk_1'],
    });
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

  describe('on a server that refuses to alter foreign key columns', () => {
    const strictLegacy = () => createCollationSchemaDouble({ ...legacyMixedSchema(), rejectForeignKeyColumnChanges: true });

    test('converts every table by dropping the jobs foreign keys first', async () => {
      const qi = strictLegacy();
      await normalizeUnicodeCollation(qi);
      expect(tableCollations(qi.tables)).toEqual({
        videos: UNICODE, channels: UNICODE, jobs: UNICODE, jobvideos: UNICODE,
        jobvideodownloads: UNICODE, playlistvideos: UNICODE, SequelizeMeta: UNICODE,
      });
      expect(qi.tables.jobs.columns.id).toBe(BIN);
      expect(qi.tables.jobvideodownloads.columns.job_id).toBe(BIN);
    });

    test('puts the jobs foreign keys back with their stored names and rules', async () => {
      const qi = strictLegacy();
      const result = await normalizeUnicodeCollation(qi);
      expect(qi.tables.jobvideodownloads.foreignKeys).toEqual([jobVideoDownloadsJobFk()]);
      expect(qi.tables.jobvideos.foreignKeys).toContainEqual(jobVideosJobFk());
      expect(result.restoredForeignKeys).toEqual(['jobvideos.JobVideos_ibfk_1', 'jobvideodownloads.JobVideoDownloads_ibfk_1']);
    });

    test('omits ON UPDATE / ON DELETE clauses for the default rules so each engine keeps its own label', async () => {
      const schema = legacyMixedSchema();
      schema.tables.jobvideos.foreignKeys[0].deleteRule = 'NO ACTION';
      const qi = createCollationSchemaDouble({ ...schema, rejectForeignKeyColumnChanges: true });
      await normalizeUnicodeCollation(qi);
      const adds = qi.ops.map((op) => op.sql).filter((sql) => / ADD CONSTRAINT /.test(sql));
      expect(adds).toEqual([
        'ALTER TABLE `jobvideos` ADD CONSTRAINT `JobVideos_ibfk_1` FOREIGN KEY (`job_id`) REFERENCES `jobs` (`id`) ON UPDATE CASCADE',
        'ALTER TABLE `jobvideodownloads` ADD CONSTRAINT `JobVideoDownloads_ibfk_1` FOREIGN KEY (`job_id`) REFERENCES `jobs` (`id`) ON UPDATE CASCADE ON DELETE CASCADE',
      ]);
    });

    test('never touches foreign keys outside the jobs chain', async () => {
      const qi = strictLegacy();
      await normalizeUnicodeCollation(qi);
      expect(qi.ops.some((op) => /JobVideos_ibfk_2/.test(op.sql))).toBe(false);
      expect(qi.tables.jobvideos.foreignKeys).toContainEqual(jobVideosVideoFk());
    });

    test('re-adds the foreign keys only after the UUID columns are back on utf8mb4_bin', async () => {
      const qi = strictLegacy();
      await normalizeUnicodeCollation(qi);
      const sqls = qi.ops.map((op) => op.sql);
      const lastModify = sqls.reduce((last, sql, i) => (/ MODIFY /.test(sql) ? i : last), -1);
      const firstAdd = sqls.findIndex((sql) => / ADD CONSTRAINT /.test(sql));
      expect(firstAdd).toBeGreaterThan(lastModify);
      expect(lastModify).toBeGreaterThan(-1);
    });

    test('does not drop foreign keys when only the database default needs changing', async () => {
      const schema = normalizedSchema();
      schema.database.collation = GENERAL;
      const qi = createCollationSchemaDouble({ ...schema, rejectForeignKeyColumnChanges: true });
      const result = await normalizeUnicodeCollation(qi);
      expect(qi.ops.some((op) => /FOREIGN KEY/.test(op.sql))).toBe(false);
      expect(result).toEqual({ ...NO_CHANGES, databaseChanged: true });
    });

    test('recreates a jobs foreign key that an interrupted run left missing', async () => {
      const schema = normalizedSchema();
      schema.tables.jobvideodownloads.foreignKeys = [];
      const qi = createCollationSchemaDouble({ ...schema, rejectForeignKeyColumnChanges: true });
      const result = await normalizeUnicodeCollation(qi);
      expect(qi.tables.jobvideodownloads.foreignKeys).toEqual([{
        name: 'jobvideodownloads_job_id_fk', columns: ['job_id'], referencedTable: 'jobs', referencedColumns: ['id'],
        updateRule: 'CASCADE', deleteRule: 'CASCADE',
      }]);
      expect(qi.tables.jobvideos.foreignKeys).toEqual([jobVideosJobFk(), jobVideosVideoFk()]);
      expect(result).toEqual({ ...NO_CHANGES, restoredForeignKeys: ['jobvideodownloads.jobvideodownloads_job_id_fk'] });
    });

    test('recovers on the next run when a conversion fails after the foreign keys were dropped', async () => {
      const schema = legacyMixedSchema();
      const failing = createCollationSchemaDouble({
        ...schema, rejectForeignKeyColumnChanges: true, failOnSqlMatching: /ALTER TABLE `channels` CONVERT/,
      });
      await expect(normalizeUnicodeCollation(failing)).rejects.toThrow(/forced failure/);
      expect(failing.tables.jobvideodownloads.foreignKeys).toEqual([]);

      const retry = createCollationSchemaDouble({ ...schema, rejectForeignKeyColumnChanges: true });
      const result = await normalizeUnicodeCollation(retry);
      expect(tableCollations(retry.tables).channels).toBe(UNICODE);
      expect(retry.tables.jobvideodownloads.foreignKeys).toEqual([{
        name: 'jobvideodownloads_job_id_fk', columns: ['job_id'], referencedTable: 'jobs', referencedColumns: ['id'],
        updateRule: 'CASCADE', deleteRule: 'CASCADE',
      }]);
      expect(retry.tables.jobvideos.foreignKeys).toEqual([jobVideosVideoFk(), {
        name: 'jobvideos_job_id_fk', columns: ['job_id'], referencedTable: 'jobs', referencedColumns: ['id'],
        updateRule: 'CASCADE', deleteRule: 'RESTRICT',
      }]);
      expect(result.restoredForeignKeys).toEqual(['jobvideos.jobvideos_job_id_fk', 'jobvideodownloads.jobvideodownloads_job_id_fk']);
    });
  });
});
