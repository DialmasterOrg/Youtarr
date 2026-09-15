'use strict';

// Databases whose default charset was already utf8mb4 when the original
// 20250907 upgrade migration ran were skipped wholesale (it only inspected the
// database default), leaving their original tables on utf8mb4_general_ci, or
// on utf8mb3, while tables created later carry an explicit utf8mb4_unicode_ci.
// MariaDB/MySQL refuse to compare string columns across the two groups
// (ER_CANT_AGGREGATE_2COLLATIONS, "Illegal mix of collations"), which first
// surfaced in the playlist following migration's backfill join.
//
// These helpers bring the database default and every base table to
// utf8mb4_unicode_ci. CONVERT TO coerces the CHAR(36) BINARY UUID columns of
// the jobs foreign key chain to the table collation, so utf8mb4_bin is
// restored on them afterward, inside the same FOREIGN_KEY_CHECKS=0 window.
//
// MariaDB 10.4.31 / 10.5.22 / 10.6.15 / 10.11.5 / 11.0.3 and newer won't change
// the collation of a foreign key column even with FOREIGN_KEY_CHECKS=0. So the
// keys on the UUID chain get read from information_schema, dropped before any
// column is touched, and put back with their stored names and rules once the
// UUID columns are utf8mb4_bin again. Names are read, never assumed: MariaDB
// 12.1+ keeps `<table>_ibfk_N` names across a rename and auto-names new keys
// `1`, `2`, ... A key an interrupted run dropped is recreated from the canonical
// definition next time.
//
// Targets the post-rename lowercase table names; see jobsUuidCollation.js for
// the legacy pre-rename variant.

const TARGET_CHARSET = 'utf8mb4';
const TARGET_COLLATION = 'utf8mb4_unicode_ci';
const UUID_COLLATION = 'utf8mb4_bin';

const UUID_FK_COLUMNS = [
  { table: 'jobs', column: 'id' },
  { table: 'jobvideos', column: 'job_id' },
  { table: 'jobvideodownloads', column: 'job_id' },
];

// Only used to recreate a missing key; its stored name and rules went with it.
const UUID_FOREIGN_KEYS = [
  { table: 'jobvideos', column: 'job_id', referencedTable: 'jobs', referencedColumn: 'id', updateRule: 'CASCADE', deleteRule: 'RESTRICT' },
  { table: 'jobvideodownloads', column: 'job_id', referencedTable: 'jobs', referencedColumn: 'id', updateRule: 'CASCADE', deleteRule: 'CASCADE' },
];

const quoteIdentifier = (name) => `\`${String(name).replace(/`/g, '``')}\``;
const quoteList = (names) => names.map(quoteIdentifier).join(', ');
const lower = (name) => String(name).toLowerCase();
const isUuidColumn = (table, column) =>
  UUID_FK_COLUMNS.some((entry) => entry.table === lower(table) && entry.column === column);

async function getDatabaseInfo(queryInterface, options = {}) {
  const [info] = await queryInterface.sequelize.query(
    `SELECT SCHEMA_NAME AS name, DEFAULT_CHARACTER_SET_NAME AS charset, DEFAULT_COLLATION_NAME AS collation
     FROM information_schema.SCHEMATA
     WHERE SCHEMA_NAME = DATABASE()`,
    { type: 'SELECT', transaction: options.transaction }
  );
  return info;
}

async function findTablesNeedingConversion(queryInterface, options = {}) {
  const tables = await queryInterface.sequelize.query(
    `SELECT TABLE_NAME AS name, TABLE_COLLATION AS collation
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'`,
    { type: 'SELECT', transaction: options.transaction }
  );
  return tables.filter((table) => table.collation !== TARGET_COLLATION);
}

// Missing tables/columns are skipped. Table names are matched
// case-insensitively and reported as stored, so the ALTER targets the real name.
async function findUuidColumns(queryInterface, options = {}) {
  const columns = [];
  for (const { table, column } of UUID_FK_COLUMNS) {
    const rows = await queryInterface.sequelize.query(
      `SELECT TABLE_NAME AS \`table\`, COLLATION_NAME AS collation
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND LOWER(TABLE_NAME) = ? AND COLUMN_NAME = ?`,
      { replacements: [table, column], type: 'SELECT', transaction: options.transaction }
    );
    if (rows.length > 0) {
      columns.push({ table: rows[0].table, column, collation: rows[0].collation });
    }
  }
  return columns;
}

const staleOnly = (columns) =>
  columns.filter(({ collation }) => collation !== UUID_COLLATION).map(({ table, column }) => ({ table, column }));

async function findStaleUuidColumns(queryInterface, options = {}) {
  return staleOnly(await findUuidColumns(queryInterface, options));
}

async function restoreUuidColumns(queryInterface, staleColumns, options = {}) {
  for (const { table, column } of staleColumns) {
    await queryInterface.sequelize.query(
      `ALTER TABLE ${quoteIdentifier(table)} MODIFY ${quoteIdentifier(column)} CHAR(36) CHARACTER SET ${TARGET_CHARSET} COLLATE ${UUID_COLLATION} NOT NULL`,
      { transaction: options.transaction }
    );
  }
}

// KEY_COLUMN_USAGE has one row per key column, so group first. Only keys
// touching a UUID column on either side are kept; nothing else gets dropped.
function selectUuidForeignKeys(rows) {
  const grouped = new Map();
  for (const row of rows) {
    const key = JSON.stringify([row.table, row.name]);
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key).push(row);
  }

  const keys = [];
  for (const parts of grouped.values()) {
    parts.sort((a, b) => a.position - b.position);
    const [first] = parts;
    keys.push({
      name: first.name,
      table: first.table,
      columns: parts.map((part) => part.column),
      referencedTable: first.referencedTable,
      referencedColumns: parts.map((part) => part.referencedColumn),
      updateRule: first.updateRule,
      deleteRule: first.deleteRule,
    });
  }

  return keys.filter(
    (fk) =>
      fk.columns.some((column) => isUuidColumn(fk.table, column)) ||
      fk.referencedColumns.some((column) => isUuidColumn(fk.referencedTable, column))
  );
}

async function findUuidForeignKeys(queryInterface, options = {}) {
  const rows = await queryInterface.sequelize.query(
    `SELECT kcu.CONSTRAINT_NAME AS name, kcu.TABLE_NAME AS \`table\`, kcu.COLUMN_NAME AS \`column\`,
            kcu.ORDINAL_POSITION AS position,
            kcu.REFERENCED_TABLE_NAME AS referencedTable, kcu.REFERENCED_COLUMN_NAME AS referencedColumn,
            rc.UPDATE_RULE AS updateRule, rc.DELETE_RULE AS deleteRule
     FROM information_schema.KEY_COLUMN_USAGE kcu
     JOIN information_schema.REFERENTIAL_CONSTRAINTS rc
       ON rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
      AND rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
      AND rc.TABLE_NAME = kcu.TABLE_NAME
     WHERE kcu.CONSTRAINT_SCHEMA = DATABASE() AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
     ORDER BY kcu.TABLE_NAME, kcu.CONSTRAINT_NAME, kcu.ORDINAL_POSITION`,
    { type: 'SELECT', transaction: options.transaction }
  );
  return selectUuidForeignKeys(rows);
}

// Keys an interrupted run dropped: both columns exist but no stored key covers
// them. The name can't collide with an auto-generated one.
function findMissingUuidForeignKeys(uuidColumns, foreignKeys) {
  const stored = (table, column) =>
    uuidColumns.find((entry) => lower(entry.table) === table && entry.column === column);

  return UUID_FOREIGN_KEYS.flatMap((canonical) => {
    const child = stored(canonical.table, canonical.column);
    const parent = stored(canonical.referencedTable, canonical.referencedColumn);
    if (!child || !parent) {
      return [];
    }
    const covered = foreignKeys.some(
      (fk) =>
        lower(fk.table) === canonical.table &&
        fk.columns.length === 1 &&
        fk.columns[0] === canonical.column &&
        lower(fk.referencedTable) === canonical.referencedTable
    );
    if (covered) {
      return [];
    }
    return [{
      name: `${child.table}_${canonical.column}_fk`,
      table: child.table,
      columns: [canonical.column],
      referencedTable: parent.table,
      referencedColumns: [canonical.referencedColumn],
      updateRule: canonical.updateRule,
      deleteRule: canonical.deleteRule,
    }];
  });
}

async function dropForeignKeys(queryInterface, foreignKeys, options = {}) {
  for (const fk of foreignKeys) {
    await queryInterface.sequelize.query(
      `ALTER TABLE ${quoteIdentifier(fk.table)} DROP FOREIGN KEY ${quoteIdentifier(fk.name)}`,
      { transaction: options.transaction }
    );
  }
}

// RESTRICT and NO ACTION are the same thing in InnoDB, and both are what a key
// gets with no clause: MariaDB reports RESTRICT, MySQL reports NO ACTION.
// Leaving the clause out keeps each engine's own label; spelling RESTRICT out
// gets stored as NO ACTION on MariaDB's ALTER TABLE path.
const DEFAULT_RULES = new Set(['RESTRICT', 'NO ACTION']);
const ruleClause = (keyword, rule) => (DEFAULT_RULES.has(rule) ? '' : ` ON ${keyword} ${rule}`);

async function addForeignKeys(queryInterface, foreignKeys, options = {}) {
  for (const fk of foreignKeys) {
    await queryInterface.sequelize.query(
      `ALTER TABLE ${quoteIdentifier(fk.table)} ADD CONSTRAINT ${quoteIdentifier(fk.name)} ` +
        `FOREIGN KEY (${quoteList(fk.columns)}) REFERENCES ${quoteIdentifier(fk.referencedTable)} (${quoteList(fk.referencedColumns)})` +
        ruleClause('UPDATE', fk.updateRule) +
        ruleClause('DELETE', fk.deleteRule),
      { transaction: options.transaction }
    );
  }
}

// Idempotent: only touches what is off. Every ALTER runs on one pooled
// connection (pinned by the transaction, since SET FOREIGN_KEY_CHECKS is
// session-scoped) with foreign key checks off; the DDL itself auto-commits.
// Keeping checks off also lets the foreign keys go back without a scan of the
// existing rows, so orphans that were tolerated before stay tolerated.
async function normalizeUnicodeCollation(queryInterface) {
  const database = await getDatabaseInfo(queryInterface);
  const tables = await findTablesNeedingConversion(queryInterface);
  const uuidColumns = await findUuidColumns(queryInterface);
  const foreignKeys = await findUuidForeignKeys(queryInterface);
  const missingForeignKeys = findMissingUuidForeignKeys(uuidColumns, foreignKeys);
  const databaseNeedsChange = database.collation !== TARGET_COLLATION;
  const columnsChange = tables.length > 0 || staleOnly(uuidColumns).length > 0;

  const result = { databaseChanged: false, convertedTables: [], restoredUuidColumns: [], restoredForeignKeys: [] };
  if (!databaseNeedsChange && !columnsChange && missingForeignKeys.length === 0) {
    return result;
  }

  const transaction = await queryInterface.sequelize.transaction();
  try {
    await queryInterface.sequelize.query('SET FOREIGN_KEY_CHECKS = 0', { transaction });

    const foreignKeysToRestore = [...(columnsChange ? foreignKeys : []), ...missingForeignKeys];
    if (columnsChange) {
      await dropForeignKeys(queryInterface, foreignKeys, { transaction });
    }

    if (databaseNeedsChange) {
      await queryInterface.sequelize.query(
        `ALTER DATABASE ${quoteIdentifier(database.name)} CHARACTER SET ${TARGET_CHARSET} COLLATE ${TARGET_COLLATION}`,
        { transaction }
      );
      result.databaseChanged = true;
    }

    for (const table of tables) {
      await queryInterface.sequelize.query(
        `ALTER TABLE ${quoteIdentifier(table.name)} CONVERT TO CHARACTER SET ${TARGET_CHARSET} COLLATE ${TARGET_COLLATION}`,
        { transaction }
      );
      result.convertedTables.push(table.name);
    }

    // Re-read after conversion: CONVERT TO coerces the UUID columns of any
    // table it just touched.
    const stale = await findStaleUuidColumns(queryInterface, { transaction });
    await restoreUuidColumns(queryInterface, stale, { transaction });
    result.restoredUuidColumns = stale.map(({ table, column }) => `${table}.${column}`);

    await addForeignKeys(queryInterface, foreignKeysToRestore, { transaction });
    result.restoredForeignKeys = foreignKeysToRestore.map((fk) => `${fk.table}.${fk.name}`);

    await queryInterface.sequelize.query('SET FOREIGN_KEY_CHECKS = 1', { transaction });
    await transaction.commit();
    return result;
  } catch (error) {
    try {
      await queryInterface.sequelize.query('SET FOREIGN_KEY_CHECKS = 1', { transaction });
    } catch (resetError) {
      // The connection is released by the rollback below; nothing more to do.
    }
    await transaction.rollback();
    throw error;
  }
}

module.exports = {
  TARGET_COLLATION,
  UUID_FK_COLUMNS,
  findTablesNeedingConversion,
  findStaleUuidColumns,
  findUuidForeignKeys,
  selectUuidForeignKeys,
  normalizeUnicodeCollation,
};
