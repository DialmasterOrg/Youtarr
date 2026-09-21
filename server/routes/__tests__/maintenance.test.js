/* eslint-env jest */

const express = require('express');
const request = require('supertest');

jest.mock('../../logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

describe('Maintenance routes', () => {
  let app;
  let mockVideosModule;
  let mockConfigModule;
  let mockScheduledTaskRuns;
  let mockVerifyToken;

  beforeEach(() => {
    jest.resetModules();

    mockVideosModule = {
      isBackfillRunning: jest.fn().mockReturnValue(false),
      tryStartBackfill: jest.fn()
    };
    mockConfigModule = {
      getConfig: jest.fn().mockReturnValue({})
    };
    mockScheduledTaskRuns = {
      getLatestRun: jest.fn().mockResolvedValue(null)
    };
    mockVerifyToken = (req, res, next) => next();

    const createMaintenanceRoutes = require('../maintenance');
    const rescanRunSummary = require('../../modules/rescanRunSummary');

    app = express();
    app.use(express.json());
    app.use(createMaintenanceRoutes({
      verifyToken: mockVerifyToken,
      videosModule: mockVideosModule,
      configModule: mockConfigModule,
      scheduledTaskRuns: mockScheduledTaskRuns,
      rescanRunSummary
    }));
  });

  describe('POST /api/maintenance/rescan-files', () => {
    test('returns 202 when started', async () => {
      mockVideosModule.tryStartBackfill.mockReturnValue({ started: true });

      const res = await request(app).post('/api/maintenance/rescan-files');

      expect(res.status).toBe(202);
      expect(res.body).toEqual({ status: 'started', trigger: 'manual' });
      expect(mockVideosModule.tryStartBackfill).toHaveBeenCalledWith({ trigger: 'manual' });
    });

    test('returns 409 when already running', async () => {
      mockVideosModule.tryStartBackfill.mockReturnValue({ started: false, reason: 'already-running' });

      const res = await request(app).post('/api/maintenance/rescan-files');

      expect(res.status).toBe(409);
      expect(res.body).toEqual({ error: 'Rescan already in progress' });
    });
  });

  describe('GET /api/maintenance/rescan-status', () => {
    test('returns running false and lastRun null when nothing has run', async () => {
      mockVideosModule.isBackfillRunning.mockReturnValue(false);
      mockConfigModule.getConfig.mockReturnValue({});

      const res = await request(app).get('/api/maintenance/rescan-status');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ running: false, lastRun: null });
    });

    test('asks only for runs that scanned, never a skipped occurrence', async () => {
      await request(app).get('/api/maintenance/rescan-status');

      expect(mockScheduledTaskRuns.getLatestRun).toHaveBeenCalledWith(
        'videoRescanFrequency',
        { statuses: ['success', 'error', 'interrupted'] }
      );
    });

    test('returns the latest recorded run', async () => {
      mockVideosModule.isBackfillRunning.mockReturnValue(true);
      mockScheduledTaskRuns.getLatestRun.mockResolvedValue({
        taskKey: 'videoRescanFrequency',
        trigger: 'manual',
        status: 'success',
        outcome: 'completed',
        message: 'Scanned 5 videos: 1 updated, 0 marked missing.',
        details: { videosScanned: 5, filesFoundOnDisk: 5, videosUpdated: 1, videosMarkedMissing: 0 },
        startedAt: '2026-05-04T15:00:00.000Z',
        finishedAt: '2026-05-04T15:01:00.000Z'
      });

      const res = await request(app).get('/api/maintenance/rescan-status');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        running: true,
        lastRun: {
          startedAt: '2026-05-04T15:00:00.000Z',
          completedAt: '2026-05-04T15:01:00.000Z',
          trigger: 'manual',
          status: 'completed',
          videosUpdated: 1,
          videosMarkedMissing: 0,
          videosScanned: 5,
          filesFoundOnDisk: 5,
          errorMessage: null
        }
      });
    });

    test('falls back to the legacy config value when no run is recorded', async () => {
      const lastRun = {
        startedAt: '2026-05-04T15:00:00.000Z',
        completedAt: '2026-05-04T15:01:00.000Z',
        trigger: 'manual',
        status: 'completed',
        videosUpdated: 1,
        videosMarkedMissing: 0,
        videosScanned: 5,
        filesFoundOnDisk: 5,
        errorMessage: null
      };
      mockConfigModule.getConfig.mockReturnValue({ rescanLastRun: lastRun });

      const res = await request(app).get('/api/maintenance/rescan-status');

      expect(res.body).toEqual({ running: false, lastRun });
    });
  });
});
