const express = require('express');
const http = require('http');
const request = require('supertest');

jest.mock('express-rate-limit', () => () => (_req, _res, next) => next());

const createChannelSearchRoutes = require('../channelSearch');

class SearchTimeoutError extends Error {
  constructor() { super('t'); this.name = 'SearchTimeoutError'; }
}
class SearchCanceledError extends Error {
  constructor() { super('c'); this.name = 'SearchCanceledError'; }
}

function buildApp({ verifyToken, searchChannels }) {
  const channelSearchModule = {
    ALLOWED_COUNTS: [10, 25, 50, 100],
    SearchTimeoutError,
    SearchCanceledError,
    searchChannels: searchChannels || jest.fn(),
  };
  const app = express();
  app.use(express.json());
  // pino-http guarantees req.log in production; stub here so route handlers can call it.
  app.use((req, _res, next) => {
    req.log = { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() };
    next();
  });
  app.use(createChannelSearchRoutes({ verifyToken, channelSearchModule }));
  return app;
}

describe('POST /api/channels/search validation', () => {
  const verifyToken = (_req, _res, next) => next();

  test('400 when query is missing', async () => {
    const app = buildApp({ verifyToken });
    const res = await request(app).post('/api/channels/search').send({});
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: expect.stringMatching(/query/i) });
  });

  test('400 when query is only whitespace', async () => {
    const app = buildApp({ verifyToken });
    const res = await request(app).post('/api/channels/search').send({ query: '   ' });
    expect(res.status).toBe(400);
  });

  test('400 when query exceeds 200 chars', async () => {
    const app = buildApp({ verifyToken });
    const res = await request(app).post('/api/channels/search').send({ query: 'x'.repeat(201) });
    expect(res.status).toBe(400);
  });

  test('400 when query contains control characters', async () => {
    const app = buildApp({ verifyToken });
    const res = await request(app).post('/api/channels/search').send({ query: 'hello\u0007' });
    expect(res.status).toBe(400);
  });

  test('400 when count is invalid', async () => {
    const app = buildApp({ verifyToken });
    const res = await request(app).post('/api/channels/search').send({ query: 'ok', count: 7 });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/channels/search behavior', () => {
  const verifyToken = (_req, _res, next) => next();

  test('200 with results on happy path, default count 25', async () => {
    const searchChannels = jest.fn().mockResolvedValueOnce([{ channelId: 'UCa', name: 'A' }]);
    const app = buildApp({ verifyToken, searchChannels });
    const res = await request(app).post('/api/channels/search').send({ query: 'minecraft' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ results: [{ channelId: 'UCa', name: 'A' }] });
    expect(searchChannels).toHaveBeenCalledWith('minecraft', 25, expect.objectContaining({
      signal: expect.anything(),
    }));
  });

  test('trims the query before searching', async () => {
    const searchChannels = jest.fn().mockResolvedValueOnce([]);
    const app = buildApp({ verifyToken, searchChannels });
    await request(app).post('/api/channels/search').send({ query: '  minecraft  ', count: 10 });
    expect(searchChannels).toHaveBeenCalledWith('minecraft', 10, expect.anything());
  });

  test('504 when module throws SearchTimeoutError', async () => {
    const app = buildApp({
      verifyToken,
      searchChannels: jest.fn().mockRejectedValueOnce(new SearchTimeoutError()),
    });
    const res = await request(app).post('/api/channels/search').send({ query: 'x' });
    expect(res.status).toBe(504);
    expect(res.body).toEqual({ error: 'Search timed out' });
  });

  test('499 when module throws SearchCanceledError', async () => {
    const app = buildApp({
      verifyToken,
      searchChannels: jest.fn().mockRejectedValueOnce(new SearchCanceledError()),
    });
    const res = await request(app).post('/api/channels/search').send({ query: 'x' });
    expect(res.status).toBe(499);
    expect(res.body).toEqual({ error: 'Search canceled' });
  });

  test('502 on generic error', async () => {
    const app = buildApp({
      verifyToken,
      searchChannels: jest.fn().mockRejectedValueOnce(new Error('boom')),
    });
    const res = await request(app).post('/api/channels/search').send({ query: 'x' });
    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: 'Search failed' });
  });

  test('requires auth via verifyToken', async () => {
    const verifyTokenDeny = (_req, res) => res.status(401).json({ error: 'Unauthorized' });
    const app = buildApp({ verifyToken: verifyTokenDeny });
    const res = await request(app).post('/api/channels/search').send({ query: 'x' });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/channels/search request cancellation', () => {
  const verifyToken = (_req, _res, next) => next();

  test('does not abort a normal request whose search resolves asynchronously', async () => {
    // On Node >= 16, req 'close' fires once the request body is consumed, not
    // only on client disconnect. Cancellation keyed to req 'close' aborts every
    // normal request whose search has any real latency.
    let capturedSignal;
    const searchChannels = jest.fn().mockImplementation((_q, _c, { signal }) => {
      capturedSignal = signal;
      return new Promise((resolve) => {
        setTimeout(() => resolve([{ channelId: 'UCa', name: 'A' }]), 25);
      });
    });
    const app = buildApp({ verifyToken, searchChannels });

    const res = await request(app).post('/api/channels/search').send({ query: 'slow' });

    expect(res.status).toBe(200);
    expect(capturedSignal.aborted).toBe(false);
  });

  test('aborts the in-flight search when the client disconnects', async () => {
    let capturedSignal;
    const searchChannels = jest.fn().mockImplementation((_q, _c, { signal }) => {
      capturedSignal = signal;
      return new Promise(() => {}); // stays pending; only the abort signal matters
    });
    const app = buildApp({ verifyToken, searchChannels });
    const server = app.listen(0);

    try {
      const port = server.address().port;
      await new Promise((resolve) => {
        const clientReq = http.request(
          { port, path: '/api/channels/search', method: 'POST', headers: { 'Content-Type': 'application/json' } },
          () => {}
        );
        clientReq.on('error', () => {}); // ECONNRESET from our own destroy
        clientReq.end(JSON.stringify({ query: 'slow' }));
        setTimeout(() => {
          clientReq.destroy();
          resolve();
        }, 50);
      });

      await new Promise((resolve, reject) => {
        const deadline = Date.now() + 1000;
        const poll = () => {
          if (capturedSignal && capturedSignal.aborted) return resolve();
          if (Date.now() > deadline) return reject(new Error('signal was not aborted after client disconnect'));
          setTimeout(poll, 10);
        };
        poll();
      });

      expect(capturedSignal.aborted).toBe(true);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
