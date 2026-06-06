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
    mockVerifyToken = (req, res, next) => next();

    const createMaintenanceRoutes = require('../maintenance');

    app = express();
    app.use(express.json());
    app.use(createMaintenanceRoutes({
      verifyToken: mockVerifyToken,
      videosModule: mockVideosModule,
      configModule: mockConfigModule
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

    test('returns running true and lastRun from config', async () => {
      mockVideosModule.isBackfillRunning.mockReturnValue(true);
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

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ running: true, lastRun });
    });
  });
});
