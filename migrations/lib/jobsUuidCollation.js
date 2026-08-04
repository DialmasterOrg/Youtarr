'use strict';

// The Jobs FK chain uses Sequelize.UUID columns, which MySQL/MariaDB create as
// CHAR(36) BINARY (the charset's *_bin collation). ALTER TABLE ... CONVERT TO
// CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci coerces those columns to
// utf8mb4_unicode_ci, and InnoDB then refuses foreign keys from any UUID
// column created afterwards (errno 150). These helpers detect and
// restore the canonical utf8mb4_bin collation so referencing and referenced
// columns always match.

const REQUIRED_COLLATION = 'utf8mb4_bin';

const UUID_FK_COLUMNS = [
  { table: 'Jobs', column: 'id' },
  { table: 'JobVideos', column: 'job_id' },
  { table: 'JobVideoDownloads', column: 'job_id' },
];

async function getColumnCollation(queryInterface, table, column, options = {}) {
  const rows = await queryInterface.sequelize.query(
    `SELECT COLLATION_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    { replacements: [table, column], type: 'SELECT', transaction: options.transaction }
  );
  return rows.length > 0 ? rows[0].COLLATION_NAME : null;
}

// Missing tables/columns are skipped.
async function findStaleUuidColumns(queryInterface, options = {}) {
  const stale = [];
  for (const { table, column } of UUID_FK_COLUMNS) {
    const collation = await getColumnCollation(queryInterface, table, column, options);
    if (collation && collation !== REQUIRED_COLLATION) {
      stale.push({ table, column });
    }
  }
  return stale;
}

// The caller must hold a FOREIGN_KEY_CHECKS=0 window on the same connection
// (pass its transaction).
async function repairUuidColumns(queryInterface, staleColumns, options = {}) {
  for (const { table, column } of staleColumns) {
    await queryInterface.sequelize.query(
      `ALTER TABLE \`${table}\` MODIFY \`${column}\` CHAR(36) CHARACTER SET utf8mb4 COLLATE ${REQUIRED_COLLATION} NOT NULL`,
      { transaction: options.transaction }
    );
  }
}

// Self-contained repair inside its own FOREIGN_KEY_CHECKS=0 window. A
// transaction pins all statements to a single pooled connection (SET
// FOREIGN_KEY_CHECKS is session-scoped); the DDL itself auto-commits in MariaDB.
async function ensureJobsUuidBinaryCollation(queryInterface) {
  const stale = await findStaleUuidColumns(queryInterface);
  if (stale.length === 0) {
    return false;
  }

  const transaction = await queryInterface.sequelize.transaction();
  try {
    await queryInterface.sequelize.query('SET FOREIGN_KEY_CHECKS = 0', { transaction });
    await repairUuidColumns(queryInterface, stale, { transaction });
    await queryInterface.sequelize.query('SET FOREIGN_KEY_CHECKS = 1', { transaction });
    await transaction.commit();
    return true;
  } catch (error) {
    try {
      await queryInterface.sequelize.query('SET FOREIGN_KEY_CHECKS = 1', { transaction });
    } catch (resetError) {
      // Connection is being released via rollback; nothing more to do.
    }
    await transaction.rollback();
    throw error;
  }
}

module.exports = {
  UUID_FK_COLUMNS,
  findStaleUuidColumns,
  repairUuidColumns,
  ensureJobsUuidBinaryCollation,
};
