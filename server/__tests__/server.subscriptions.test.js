/* eslint-env jest */
'use strict';

const express = require('express');
const request = require('supertest');

// Mock logger before requiring anything that imports it
jest.mock('../logger', () => require('../__mocks__/logger'));

// Mock the error classes and constants -- we need real classes for instanceof checks
const { ParseError } = require('../modules/subscriptionImport/takeoutParser');
const { FetchError } = require('../modules/subscriptionImport/cookiesFetcher');
const { ImportInProgressError } = require('../modules/subscriptionImport');

// Bypass rate limiting in tests
jest.mock('express-rate-limit', () => jest.fn(() => (req, res, next) => next()));

const createSubscriptionRoutes = require('../routes/subscriptions');

/**
 * Build a test Express app with the subscription routes mounted.
 * Injects a pass-through verifyToken and the given module mock.
 */
function buildApp(subscriptionImportModule) {
  const app = express();
  app.use(express.json());

  // Attach a mock req.log for request-scoped logging (pino-http convention)
  app.use((req, res, next) => {
    req.log = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
    req.username = 'testuser';
    next();
  });

  const verifyToken = (req, res, next) => next();

  const router = createSubscriptionRoutes({ verifyToken, subscriptionImportModule });
  app.use(router);

  return app;
}

describe('Subscription import routes', () => {
  let mockModule;
  let app;

  beforeEach(() => {
    jest.clearAllMocks();

    mockModule = {
      parseTakeout: jest.fn(),
      fetchWithCookiesPreview: jest.fn(),
      startImport: jest.fn(),
      getActiveImport: jest.fn(),
      getImport: jest.fn(),
      listImports: jest.fn(),
      cancelImport: jest.fn(),
    };

    app = buildApp(mockModule);
  });

  // ----------------------------------------------------------------
  // POST /api/subscriptions/preview/takeout
  // ----------------------------------------------------------------
  describe('POST /api/subscriptions/preview/takeout', () => {
    const endpoint = '/api/subscriptions/preview/takeout';

    test('returns 200 with preview on success', async () => {
      const previewData = {
        source: 'takeout',
        totalFound: 2,
        alreadySubscribedCount: 1,
        channels: [
          { channelId: 'UC111', title: 'Channel A', alreadySubscribed: true },
          { channelId: 'UC222', title: 'Channel B', alreadySubscribed: false },
        ],
      };
      mockModule.parseTakeout.mockResolvedValue(previewData);

      const csvContent = 'Channel Id,Channel Url,Channel Title\nUC111,http://youtube.com/channel/UC111,Channel A';

      const res = await request(app)
        .post(endpoint)
        .attach('file', Buffer.from(csvContent), 'subscriptions.csv');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(previewData);
      expect(mockModule.parseTakeout).toHaveBeenCalledWith(expect.any(Buffer));
    });

    test('returns 400 when ParseError is thrown', async () => {
      mockModule.parseTakeout.mockRejectedValue(new ParseError('Invalid CSV: missing header'));

      const res = await request(app)
        .post(endpoint)
        .attach('file', Buffer.from('bad data'), 'bad.csv');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid CSV: missing header');
    });

    test('returns 500 when database cross-reference fails', async () => {
      mockModule.parseTakeout.mockRejectedValue(new Error('SequelizeConnectionError'));

      const res = await request(app)
        .post(endpoint)
        .attach('file', Buffer.from('valid csv'), 'subscriptions.csv');

      expect(res.status).toBe(500);
      expect(res.body.error).toBeTruthy();
    });

    test('returns 400 when no file is uploaded', async () => {
      const res = await request(app)
        .post(endpoint)
        .send();

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('No file uploaded');
    });
  });

  // ----------------------------------------------------------------
  // POST /api/subscriptions/preview/cookies
  // ----------------------------------------------------------------
  describe('POST /api/subscriptions/preview/cookies', () => {
    const endpoint = '/api/subscriptions/preview/cookies';

    test('returns 200 with preview on success', async () => {
      const previewData = {
        source: 'cookies',
        totalFound: 3,
        alreadySubscribedCount: 0,
        channels: [
          { channelId: 'UC333', title: 'Channel C', alreadySubscribed: false },
        ],
      };
      mockModule.fetchWithCookiesPreview.mockResolvedValue(previewData);

      const cookiesContent = '# Netscape HTTP Cookie File\n.youtube.com\tTRUE\t/\tTRUE\t0\tSID\tabc123';

      const res = await request(app)
        .post(endpoint)
        .attach('file', Buffer.from(cookiesContent), 'cookies.txt');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(previewData);
      expect(mockModule.fetchWithCookiesPreview).toHaveBeenCalledWith(expect.any(Buffer));
    });

    test('returns 502 when FetchError with BOT_CHECK code is thrown', async () => {
      mockModule.fetchWithCookiesPreview.mockRejectedValue(
        new FetchError({
          code: 'BOT_CHECK',
          userMessage: 'YouTube is asking for verification',
          details: 'sign in to confirm you are not a bot',
        })
      );

      const res = await request(app)
        .post(endpoint)
        .attach('file', Buffer.from('cookies'), 'cookies.txt');

      expect(res.status).toBe(502);
      expect(res.body.error).toBe('YouTube is asking for verification');
      expect(res.body.details).toBe('sign in to confirm you are not a bot');
    });

    test('returns 400 when FetchError with INVALID_FORMAT code is thrown', async () => {
      mockModule.fetchWithCookiesPreview.mockRejectedValue(
        new FetchError({
          code: 'INVALID_FORMAT',
          userMessage: 'The uploaded file is not a valid Netscape cookies file',
          details: '',
        })
      );

      const res = await request(app)
        .post(endpoint)
        .attach('file', Buffer.from('not cookies'), 'cookies.txt');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('The uploaded file is not a valid Netscape cookies file');
    });

    test('returns 500 when an unexpected error is thrown', async () => {
      mockModule.fetchWithCookiesPreview.mockRejectedValue(new Error('unexpected'));

      const res = await request(app)
        .post(endpoint)
        .attach('file', Buffer.from('cookies'), 'cookies.txt');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to fetch subscriptions');
    });
  });

  // ----------------------------------------------------------------
  // POST /api/subscriptions/imports
  // ----------------------------------------------------------------
  describe('POST /api/subscriptions/imports', () => {
    const endpoint = '/api/subscriptions/imports';

    test('returns 202 with jobId and total on success', async () => {
      mockModule.startImport.mockResolvedValue({ jobId: 'job-abc', total: 5 });

      const channels = [
        { channelId: 'UC111', url: 'http://youtube.com/channel/UC111', title: 'Ch A' },
        { channelId: 'UC222', url: 'http://youtube.com/channel/UC222', title: 'Ch B' },
      ];

      const res = await request(app)
        .post(endpoint)
        .send({ channels });

      expect(res.status).toBe(202);
      expect(res.body).toEqual({ jobId: 'job-abc', total: 5 });
      expect(mockModule.startImport).toHaveBeenCalledWith(channels, 'testuser');
    });

    test('returns 409 when ImportInProgressError is thrown', async () => {
      mockModule.startImport.mockRejectedValue(new ImportInProgressError('existing-job'));

      const res = await request(app)
        .post(endpoint)
        .send({ channels: [{ channelId: 'UC111' }] });

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/already in progress/);
    });

    test('returns 400 when channels array is empty', async () => {
      const res = await request(app)
        .post(endpoint)
        .send({ channels: [] });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/channels array is required/);
    });

    test('returns 400 when channels is missing', async () => {
      const res = await request(app)
        .post(endpoint)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/channels array is required/);
    });
  });

  // ----------------------------------------------------------------
  // GET /api/subscriptions/imports/active
  // ----------------------------------------------------------------
  describe('GET /api/subscriptions/imports/active', () => {
    const endpoint = '/api/subscriptions/imports/active';

    test('returns 200 with active import summary when running', async () => {
      const activeSummary = {
        jobId: 'job-xyz',
        total: 10,
        done: 3,
        cancelRequested: false,
        startedAt: 1700000000000,
      };
      mockModule.getActiveImport.mockReturnValue(activeSummary);

      const res = await request(app).get(endpoint);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(activeSummary);
    });

    test('returns 204 when no active import', async () => {
      mockModule.getActiveImport.mockReturnValue(null);

      const res = await request(app).get(endpoint);

      expect(res.status).toBe(204);
      expect(res.body).toEqual({});
    });
  });

  // ----------------------------------------------------------------
  // GET /api/subscriptions/imports/:jobId
  // ----------------------------------------------------------------
  describe('GET /api/subscriptions/imports/:jobId', () => {
    test('returns 200 with import details when found', async () => {
      const importData = {
        jobId: 'job-123',
        status: 'In Progress',
        total: 5,
        done: 2,
        results: [{ channelId: 'UC111', status: 'ok' }],
        startedAt: 1700000000000,
      };
      mockModule.getImport.mockResolvedValue(importData);

      const res = await request(app).get('/api/subscriptions/imports/job-123');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(importData);
      expect(mockModule.getImport).toHaveBeenCalledWith('job-123');
    });

    test('returns 404 when import not found', async () => {
      mockModule.getImport.mockResolvedValue(null);

      const res = await request(app).get('/api/subscriptions/imports/nonexistent');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Import not found');
    });
  });

  // ----------------------------------------------------------------
  // POST /api/subscriptions/imports/:jobId/cancel
  // ----------------------------------------------------------------
  describe('POST /api/subscriptions/imports/:jobId/cancel', () => {
    test('returns 200 with Cancelling status on success', async () => {
      mockModule.cancelImport.mockReturnValue(undefined);

      const res = await request(app).post('/api/subscriptions/imports/job-abc/cancel');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'Cancelling' });
      expect(mockModule.cancelImport).toHaveBeenCalledWith('job-abc');
    });

    test('returns 404 when no active import matches', async () => {
      mockModule.cancelImport.mockImplementation(() => {
        throw new Error('No active import with jobId: job-nope');
      });

      const res = await request(app).post('/api/subscriptions/imports/job-nope/cancel');

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/No active import/);
    });
  });

  // ----------------------------------------------------------------
  // GET /api/subscriptions/imports
  // ----------------------------------------------------------------
  describe('GET /api/subscriptions/imports', () => {
    test('returns 200 with list of imports', async () => {
      const importsList = [
        { jobId: 'job-1', status: 'Completed', timeInitiated: 1700000000000 },
        { jobId: 'job-2', status: 'Cancelled', timeInitiated: 1699000000000 },
      ];
      mockModule.listImports.mockResolvedValue(importsList);

      const res = await request(app).get('/api/subscriptions/imports');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ imports: importsList });
      expect(mockModule.listImports).toHaveBeenCalledWith(10);
    });
  });
});
