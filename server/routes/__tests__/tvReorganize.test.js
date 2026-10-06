/* eslint-env jest */
const express = require('express');
const request = require('supertest');

jest.mock('../../logger', () => ({ error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() }));

function refusal(message, status, code) {
  return Object.assign(new Error(message), { status, code });
}

const CHANGE = { type: 'channelLayout', channelId: 'UC1', layout: 'tv' };

describe('reorganize routes', () => {
  let app;
  let reorganize;
  let watchStatusHolds;
  let watchStatusPushBack;

  beforeEach(() => {
    jest.resetModules();
    reorganize = {
      preview: jest.fn().mockResolvedValue({ revision: 'rev', needed: true }),
      start: jest.fn().mockResolvedValue({ operationId: 3, applied: false }),
      getActive: jest.fn().mockResolvedValue(null),
      getOperation: jest.fn().mockResolvedValue({ id: 3, status: 'running' }),
      retry: jest.fn().mockResolvedValue({ operationId: 3 }),
    };
    watchStatusHolds = {
      describeHolds: jest.fn().mockResolvedValue([{ id: 1 }]),
      countHolds: jest.fn().mockResolvedValue({ pending: 1, failed: 0 }),
      reopenHold: jest.fn().mockResolvedValue({ id: 1 }),
      dismissHold: jest.fn().mockResolvedValue(true),
    };
    watchStatusPushBack = { pushPendingHolds: jest.fn().mockResolvedValue({ pushed: 1, notIndexed: 0, failed: 0 }) };
    const createRoutes = require('../tvReorganize');
    app = express();
    app.use(express.json());
    app.use(createRoutes({ verifyToken: (req, res, next) => next(), reorganize, watchStatusHolds, watchStatusPushBack }));
  });

  describe('POST /api/tv/reorganize/preview', () => {
    test('returns the preview for the change', async () => {
      const res = await request(app).post('/api/tv/reorganize/preview').send({ change: CHANGE });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ revision: 'rev', needed: true });
      expect(reorganize.preview).toHaveBeenCalledWith(CHANGE);
    });

    test('requires a change object', async () => {
      const res = await request(app).post('/api/tv/reorganize/preview').send({ change: 'tv' });
      expect(res.status).toBe(400);
      expect(reorganize.preview).not.toHaveBeenCalled();
    });

    test('passes a refusal through with its status', async () => {
      reorganize.preview.mockRejectedValueOnce(refusal('Channel not found', 404));
      const res = await request(app).post('/api/tv/reorganize/preview').send({ change: CHANGE });
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Channel not found' });
    });

    test('returns 500 for an unexpected failure', async () => {
      reorganize.preview.mockRejectedValueOnce(new Error('db'));
      const res = await request(app).post('/api/tv/reorganize/preview').send({ change: CHANGE });
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Failed to preview the reorganize' });
    });
  });

  describe('POST /api/tv/reorganize', () => {
    test('starts the reorganize with 202', async () => {
      const res = await request(app).post('/api/tv/reorganize').send({ change: CHANGE, revision: 'rev' });
      expect(res.status).toBe(202);
      expect(res.body).toEqual({ operationId: 3, applied: false });
      expect(reorganize.start).toHaveBeenCalledWith(CHANGE, 'rev');
    });

    test('answers 200 when the change applied with nothing to move', async () => {
      reorganize.start.mockResolvedValueOnce({ operationId: null, applied: true });
      const res = await request(app).post('/api/tv/reorganize').send({ change: CHANGE, revision: 'rev' });
      expect(res.status).toBe(200);
    });

    test('requires the revision', async () => {
      const res = await request(app).post('/api/tv/reorganize').send({ change: CHANGE });
      expect(res.status).toBe(400);
    });

    test('passes a stale preview through with its code', async () => {
      reorganize.start.mockRejectedValueOnce(refusal('Review the move again.', 409, 'STALE_PREVIEW'));
      const res = await request(app).post('/api/tv/reorganize').send({ change: CHANGE, revision: 'old' });
      expect(res.status).toBe(409);
      expect(res.body).toEqual({ error: 'Review the move again.', code: 'STALE_PREVIEW' });
    });
  });

  describe('operations', () => {
    test('returns the running operation', async () => {
      reorganize.getActive.mockResolvedValueOnce({ id: 3 });
      const res = await request(app).get('/api/tv/operations/active');
      expect(res.body).toEqual({ operation: { id: 3 } });
    });

    test('returns an operation by id', async () => {
      const res = await request(app).get('/api/tv/operations/3');
      expect(res.status).toBe(200);
      expect(reorganize.getOperation).toHaveBeenCalledWith(3);
    });

    test('returns 404 for an unknown operation', async () => {
      reorganize.getOperation.mockResolvedValueOnce(null);
      const res = await request(app).get('/api/tv/operations/9');
      expect(res.status).toBe(404);
    });

    test('rejects an invalid operation id', async () => {
      const res = await request(app).get('/api/tv/operations/abc');
      expect(res.status).toBe(400);
    });

    test('retries an operation\'s failed videos with 202', async () => {
      const res = await request(app).post('/api/tv/operations/3/retry');
      expect(res.status).toBe(202);
      expect(reorganize.retry).toHaveBeenCalledWith(3);
    });
  });

  describe('watch-state restores', () => {
    test('lists pending and failed restores with counts by default', async () => {
      const res = await request(app).get('/api/tv/holds');
      expect(res.body).toEqual({ holds: [{ id: 1 }], counts: { pending: 1, failed: 0 } });
      expect(watchStatusHolds.describeHolds).toHaveBeenCalledWith({ states: ['pending', 'failed'] });
    });

    test('lists the requested states', async () => {
      await request(app).get('/api/tv/holds?state=failed');
      expect(watchStatusHolds.describeHolds).toHaveBeenCalledWith({ states: ['failed'] });
    });

    test('rejects an unknown state', async () => {
      const res = await request(app).get('/api/tv/holds?state=lost');
      expect(res.status).toBe(400);
    });

    test('retries a restore by reopening and pushing it now', async () => {
      const res = await request(app).post('/api/tv/holds/1/retry');
      expect(res.status).toBe(200);
      expect(watchStatusHolds.reopenHold).toHaveBeenCalledWith(1);
      expect(watchStatusPushBack.pushPendingHolds).toHaveBeenCalledWith({ holdIds: [1] });
    });

    test('returns 404 when retrying an unknown restore', async () => {
      watchStatusHolds.reopenHold.mockResolvedValueOnce(null);
      const res = await request(app).post('/api/tv/holds/9/retry');
      expect(res.status).toBe(404);
    });

    test('dismisses a restore', async () => {
      const res = await request(app).post('/api/tv/holds/1/dismiss');
      expect(res.status).toBe(204);
    });

    test('returns 404 when dismissing an unknown restore', async () => {
      watchStatusHolds.dismissHold.mockResolvedValueOnce(false);
      const res = await request(app).post('/api/tv/holds/9/dismiss');
      expect(res.status).toBe(404);
    });
  });
});
