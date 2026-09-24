/* eslint-env jest */
jest.mock('../../models', () => ({
  ScheduledTaskRun: {
    create: jest.fn(),
    update: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    destroy: jest.fn(),
  },
}));
jest.mock('../../logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

describe('scheduledTaskRuns', () => {
  let runs;
  let ScheduledTaskRun;
  let logger;
  const taskKey = 'autoRemovalFrequency';

  const row = (overrides = {}) => ({
    id: 1,
    task_key: taskKey,
    trigger_type: 'scheduled',
    status: 'success',
    outcome: 'completed',
    message: 'Deleted 2 videos',
    details: '{"deleted":2}',
    started_at: new Date('2026-09-20T02:00:00.000Z'),
    finished_at: new Date('2026-09-20T02:01:00.000Z'),
    ...overrides,
  });

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    ({ ScheduledTaskRun } = require('../../models'));
    logger = require('../../logger');
    ScheduledTaskRun.findAll.mockResolvedValue([]);
    ScheduledTaskRun.findOne.mockResolvedValue(null);
    ScheduledTaskRun.update.mockResolvedValue([1]);
    ScheduledTaskRun.destroy.mockResolvedValue(0);
    runs = require('../scheduledTaskRuns');
  });

  describe('start', () => {
    test('creates a running row and returns it', async () => {
      const created = row({ status: 'running', finished_at: null });
      ScheduledTaskRun.create.mockResolvedValue(created);
      const result = await runs.start({ taskKey, trigger: 'scheduled' });
      expect(ScheduledTaskRun.create).toHaveBeenCalledWith(expect.objectContaining({
        task_key: taskKey,
        trigger_type: 'scheduled',
        status: 'running',
        started_at: expect.any(Date),
      }));
      expect(result).toBe(created);
    });

    test('returns null and warns when the row cannot be created', async () => {
      ScheduledTaskRun.create.mockRejectedValue(new Error('db down'));
      await expect(runs.start({ taskKey })).resolves.toBeNull();
      expect(logger.warn).toHaveBeenCalled();
    });
  });

  describe('finish', () => {
    test('stores the outcome and serializes details as JSON', async () => {
      await runs.finish(row({ status: 'running' }), {
        status: 'success', outcome: 'completed', message: 'Deleted 2 videos', details: { deleted: 2 },
      });
      expect(ScheduledTaskRun.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          outcome: 'completed',
          message: 'Deleted 2 videos',
          details: '{"deleted":2}',
          finished_at: expect.any(Date),
        }),
        { where: { id: 1 } }
      );
    });

    test('prunes rows beyond the retention limit for that task', async () => {
      const ids = Array.from({ length: 23 }, (_, i) => ({ id: 100 - i }));
      ScheduledTaskRun.findAll.mockResolvedValue(ids);
      await runs.finish(row(), { status: 'success' });
      expect(ScheduledTaskRun.destroy).toHaveBeenCalledWith({ where: { id: [80, 79, 78] } });
    });

    test('never prunes a row that is still running', async () => {
      const rows = Array.from({ length: 23 }, (_, i) => ({ id: 100 - i, status: 'success', outcome: 'completed' }));
      rows[22].status = 'running';
      ScheduledTaskRun.findAll.mockResolvedValue(rows);
      await runs.finish(row(), { status: 'success' });
      expect(ScheduledTaskRun.destroy).toHaveBeenCalledWith({ where: { id: [80, 79] } });
    });

    test('keeps the newest row of each outcome beyond the retention limit', async () => {
      const rows = Array.from({ length: 23 }, (_, i) => ({ id: 100 - i, status: 'success', outcome: 'up-to-date' }));
      rows[20].outcome = 'updated';
      ScheduledTaskRun.findAll.mockResolvedValue(rows);
      await runs.finish(row(), { status: 'success' });
      expect(ScheduledTaskRun.destroy).toHaveBeenCalledWith({ where: { id: [79, 78] } });
    });

    test('ignores a missing run handle', async () => {
      await runs.finish(null, { status: 'success' });
      expect(ScheduledTaskRun.update).not.toHaveBeenCalled();
    });

    test('warns instead of throwing when the update fails', async () => {
      ScheduledTaskRun.update.mockRejectedValue(new Error('db down'));
      await expect(runs.finish(row(), { status: 'success' })).resolves.toBeUndefined();
      expect(logger.warn).toHaveBeenCalled();
    });
  });

  describe('record', () => {
    test('inserts a completed run in one step', async () => {
      const startedAt = new Date('2026-09-20T03:00:00.000Z');
      const finishedAt = new Date('2026-09-20T03:02:00.000Z');
      await runs.record({
        taskKey: 'videoRescanFrequency', trigger: 'manual', startedAt, finishedAt,
        status: 'success', outcome: 'completed', message: 'Scanned 10 videos', details: { videosScanned: 10 },
      });
      expect(ScheduledTaskRun.create).toHaveBeenCalledWith({
        task_key: 'videoRescanFrequency',
        trigger_type: 'manual',
        started_at: startedAt,
        finished_at: finishedAt,
        status: 'success',
        outcome: 'completed',
        message: 'Scanned 10 videos',
        details: '{"videosScanned":10}',
      });
    });
  });

  describe('recordSkipped', () => {
    test('inserts a skipped row explaining the overlap', async () => {
      await runs.recordSkipped(taskKey);
      expect(ScheduledTaskRun.create).toHaveBeenCalledWith(expect.objectContaining({
        task_key: taskKey,
        status: 'skipped',
        message: 'The previous run was still in progress.',
      }));
    });
  });

  describe('markInterruptedRuns', () => {
    test('flags rows left running by a previous process', async () => {
      await runs.markInterruptedRuns();
      expect(ScheduledTaskRun.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'interrupted', message: 'The server restarted before it finished.' }),
        { where: { status: 'running' } }
      );
    });
  });

  describe('getLatestRuns', () => {
    test('returns the newest serialized run per task', async () => {
      ScheduledTaskRun.findAll.mockResolvedValue([
        row({ id: 3, started_at: new Date('2026-09-21T02:00:00.000Z') }),
        row({ id: 2, task_key: 'sessionCleanupFrequency', details: null, outcome: null }),
        row({ id: 1 }),
      ]);
      const latest = await runs.getLatestRuns();
      expect(Object.keys(latest)).toEqual([taskKey, 'sessionCleanupFrequency']);
      expect(latest[taskKey]).toEqual({
        id: 3,
        taskKey,
        trigger: 'scheduled',
        status: 'success',
        outcome: 'completed',
        message: 'Deleted 2 videos',
        details: { deleted: 2 },
        startedAt: '2026-09-21T02:00:00.000Z',
        finishedAt: '2026-09-20T02:01:00.000Z',
      });
      expect(latest.sessionCleanupFrequency.details).toBeNull();
    });

    test('returns an empty object when the table cannot be read', async () => {
      ScheduledTaskRun.findAll.mockRejectedValue(new Error('db down'));
      await expect(runs.getLatestRuns()).resolves.toEqual({});
    });
  });

  describe('getLatestRun', () => {
    test('filters by outcome when asked', async () => {
      ScheduledTaskRun.findOne.mockResolvedValue(row({ outcome: 'updated' }));
      const latest = await runs.getLatestRun('ytdlpUpdateFrequency', { outcome: 'updated' });
      expect(ScheduledTaskRun.findOne).toHaveBeenCalledWith(expect.objectContaining({
        where: { task_key: 'ytdlpUpdateFrequency', outcome: 'updated' },
      }));
      expect(latest.outcome).toBe('updated');
    });

    test('filters by statuses when asked', async () => {
      await runs.getLatestRun(taskKey, { statuses: ['success', 'error'] });
      expect(ScheduledTaskRun.findOne).toHaveBeenCalledWith(expect.objectContaining({
        where: { task_key: taskKey, status: ['success', 'error'] },
      }));
    });

    test('returns null when nothing has run', async () => {
      await expect(runs.getLatestRun(taskKey)).resolves.toBeNull();
    });
  });
});
