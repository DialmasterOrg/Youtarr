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

const quoteIdentifier = (name) => `\`${String(name).replace(/`/g, '``')}\``;

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
async function findStaleUuidColumns(queryInterface, options = {}) {
  const stale = [];
  for (const { table, column } of UUID_FK_COLUMNS) {
    const rows = await queryInterface.sequelize.query(
      `SELECT TABLE_NAME AS \`table\`, COLLATION_NAME AS collation
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND LOWER(TABLE_NAME) = ? AND COLUMN_NAME = ?`,
      { replacements: [table, column], type: 'SELECT', transaction: options.transaction }
    );
    if (rows.length > 0 && rows[0].collation !== UUID_COLLATION) {
      stale.push({ table: rows[0].table, column });
    }
  }
  return stale;
}

async function restoreUuidColumns(queryInterface, staleColumns, options = {}) {
  for (const { table, column } of staleColumns) {
    await queryInterface.sequelize.query(
      `ALTER TABLE ${quoteIdentifier(table)} MODIFY ${quoteIdentifier(column)} CHAR(36) CHARACTER SET ${TARGET_CHARSET} COLLATE ${UUID_COLLATION} NOT NULL`,
      { transaction: options.transaction }
    );
  }
}

// Idempotent: only touches what is off. Every ALTER runs on one pooled
// connection (pinned by the transaction, since SET FOREIGN_KEY_CHECKS is
// session-scoped) with foreign key checks off; the DDL itself auto-commits.
async function normalizeUnicodeCollation(queryInterface) {
  const database = await getDatabaseInfo(queryInterface);
  const tables = await findTablesNeedingConversion(queryInterface);
  const databaseNeedsChange = database.collation !== TARGET_COLLATION;
  const staleBeforeConversion = await findStaleUuidColumns(queryInterface);

  const result = { databaseChanged: false, convertedTables: [], restoredUuidColumns: [] };
  if (!databaseNeedsChange && tables.length === 0 && staleBeforeConversion.length === 0) {
    return result;
  }

  const transaction = await queryInterface.sequelize.transaction();
  try {
    await queryInterface.sequelize.query('SET FOREIGN_KEY_CHECKS = 0', { transaction });

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
  normalizeUnicodeCollation,
};
