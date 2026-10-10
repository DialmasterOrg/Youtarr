'use strict';

const { createTableIfNotExists, addIndexIfMissing, dropTableIfExists } = require('./helpers');

module.exports = {
  async up(queryInterface, Sequelize) {
    await createTableIfNotExists(queryInterface, 'scheduled_task_runs', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      // Config key of the schedule, e.g. autoRemovalFrequency.
      task_key: { type: Sequelize.STRING(64), allowNull: false },
      // scheduled | manual | startup
      trigger_type: { type: Sequelize.STRING(16), allowNull: false, defaultValue: 'scheduled' },
      // running | success | error | skipped | interrupted
      status: { type: Sequelize.STRING(16), allowNull: false },
      // Task-specific result code, e.g. updated / up-to-date / timed-out.
      outcome: { type: Sequelize.STRING(32), allowNull: true },
      message: { type: Sequelize.TEXT, allowNull: true },
      // JSON snapshot of task-specific counters.
      details: { type: Sequelize.TEXT, allowNull: true },
      started_at: { type: Sequelize.DATE, allowNull: false },
      finished_at: { type: Sequelize.DATE, allowNull: true },
    }, { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' });

    await addIndexIfMissing(queryInterface, 'scheduled_task_runs', ['task_key', 'started_at'], {
      name: 'scheduled_task_runs_task_started_idx',
    });
  },

  async down(queryInterface) {
    await dropTableIfExists(queryInterface, 'scheduled_task_runs');
  },
};
