'use strict';

const { normalizeUnicodeCollation } = require('./lib/unicodeCollation');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // Databases that were already utf8mb4 when the 20250907 upgrade ran were
    // skipped wholesale, leaving their original tables on utf8mb4_general_ci
    // (or utf8mb3) beside tables created later with an explicit
    // utf8mb4_unicode_ci. Comparing string columns across the two groups fails
    // with "Illegal mix of collations". This is deliberately timestamped to
    // sort after the table rename (so the UUID columns are found under their
    // lowercase names) and before the playlist following migration, whose
    // backfill join is the first such comparison.
    const result = await normalizeUnicodeCollation(queryInterface);
    if (result.databaseChanged || result.convertedTables.length > 0 || result.restoredUuidColumns.length > 0) {
      console.log(
        `Normalized collation to utf8mb4_unicode_ci: database=${result.databaseChanged}, ` +
        `tables=[${result.convertedTables.join(', ')}], uuidColumns=[${result.restoredUuidColumns.join(', ')}]`
      );
    }
  },

  async down() {
    // No-op: utf8mb4_unicode_ci is the canonical collation; restoring the
    // mixed schema would only reintroduce the failure.
  },
};
