// Statuses a job never leaves once set.
const FINAL_JOB_STATUSES = new Set(['Complete', 'Complete with Warnings', 'Error', 'Failed', 'Terminated', 'Killed']);

module.exports = { FINAL_JOB_STATUSES };
