'use strict';

const { ensureJobsUuidBinaryCollation } = require('./lib/jobsUuidCollation');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // The 20250907/20251010 migrations repair coerced UUID FK collations, but
    // only for databases that had not yet applied them when the repair was
    // added. A database that passed them earlier can still hold a mismatch
    // (e.g. Jobs.id utf8mb4_bin vs JobVideos.job_id utf8mb4_unicode_ci from a
    // partial CONVERT TO run). InnoDB then binds the JobVideos->Jobs foreign
    // key unpredictably at each server start: some restarts leave it with no
    // referenced index, and every JobVideos insert fails with
    // ER_NO_REFERENCED_ROW_2 even though the Jobs row exists, so completed
    // jobs show zero videos in Download History. Run the idempotent repair
    // once unconditionally to restore utf8mb4_bin on all three columns.
    await ensureJobsUuidBinaryCollation(queryInterface);
  },

  async down() {
    // No-op: utf8mb4_bin is the canonical collation for these columns;
    // restoring a coerced collation would only reintroduce the broken state.
  },
};
