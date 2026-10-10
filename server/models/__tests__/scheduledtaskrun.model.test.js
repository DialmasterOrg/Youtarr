const models = require('../index');

describe('ScheduledTaskRun model registration', () => {
  test('is exported from models/index', () => {
    expect(models.ScheduledTaskRun).toBeDefined();
  });

  test('maps to the scheduled_task_runs table with the run lifecycle attributes', () => {
    expect(models.ScheduledTaskRun.tableName).toBe('scheduled_task_runs');
    for (const attribute of ['task_key', 'trigger_type', 'status', 'outcome', 'message', 'details', 'started_at', 'finished_at']) {
      expect(models.ScheduledTaskRun.rawAttributes[attribute]).toBeDefined();
    }
  });
});
