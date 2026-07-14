const express = require('express');
const http = require('http');
const request = require('supertest');

jest.mock('express-rate-limit', () => () => (_req, _res, next) => next());

const createVideoSearchRoutes = require('../videoSearch');

class SearchTimeoutError extends Error {
  constructor() { super('t'); this.name = 'SearchTimeoutError'; }
}
class SearchCanceledError extends Error {
  constructor() { super('c'); this.name = 'SearchCanceledError'; }
}

function buildApp({ verifyToken, searchVideos }) {
  const videoSearchModule = {
    ALLOWED_COUNTS: [10, 25, 50, 100],
    SearchTimeoutError,
    SearchCanceledError,
    searchVideos: searchVideos || jest.fn(),
  };
  const app = express();
  app.use(express.json());
  // pino-http guarantees req.log in production; stub here so route handlers can call it.
  app.use((req, _res, next) => {
    req.log = { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() };
    next();
  });
  app.use(createVideoSearchRoutes({ verifyToken, videoSearchModule }));
  return app;
}

describe('POST /api/videos/search validation', () => {
  const verifyToken = (_req, _res, next) => next();

  test('400 when query is missing', async () => {
    const app = buildApp({ verifyToken });
    const res = await request(app).post('/api/videos/search').send({});
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: expect.stringMatching(/query/i) });
  });

  test('400 when query exceeds 200 chars', async () => {
    const app = buildApp({ verifyToken });
    const res = await request(app).post('/api/videos/search').send({ query: 'x'.repeat(201) });
    expect(res.status).toBe(400);
  });

  test('400 when query contains control characters', async () => {
    const app = buildApp({ verifyToken });
    const res = await request(app).post('/api/videos/search').send({ query: 'hello\u0007' });
    expect(res.status).toBe(400);
  });

  test('400 when count is invalid', async () => {
    const app = buildApp({ verifyToken });
    const res = await request(app).post('/api/videos/search').send({ query: 'ok', count: 7 });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/videos/search behavior', () => {
  const verifyToken = (_req, _res, next) => next();

  test('200 with results on happy path', async () => {
    const app = buildApp({
      verifyToken,
      searchVideos: jest.fn().mockResolvedValueOnce([{ youtubeId: 'a', title: 'A' }]),
    });
    const res = await request(app).post('/api/videos/search').send({ query: 'minecraft', count: 25 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ results: [{ youtubeId: 'a', title: 'A' }] });
  });

  test('504 when module throws SearchTimeoutError', async () => {
    const app = buildApp({
      verifyToken,
      searchVideos: jest.fn().mockRejectedValueOnce(new SearchTimeoutError()),
    });
    const res = await request(app).post('/api/videos/search').send({ query: 'x' });
    expect(res.status).toBe(504);
    expect(res.body).toEqual({ error: 'Search timed out' });
  });

  test('499 when module throws SearchCanceledError', async () => {
    const app = buildApp({
      verifyToken,
      searchVideos: jest.fn().mockRejectedValueOnce(new SearchCanceledError()),
    });
    const res = await request(app).post('/api/videos/search').send({ query: 'x' });
    expect(res.status).toBe(499);
    expect(res.body).toEqual({ error: 'Search canceled' });
  });

  test('502 on generic error', async () => {
    const app = buildApp({
      verifyToken,
      searchVideos: jest.fn().mockRejectedValueOnce(new Error('boom')),
    });
    const res = await request(app).post('/api/videos/search').send({ query: 'x' });
    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: 'Search failed' });
  });

  test('passes AbortSignal to module', async () => {
    const searchVideos = jest.fn().mockResolvedValueOnce([]);
    const app = buildApp({ verifyToken, searchVideos });
    await request(app).post('/api/videos/search').send({ query: 'x' });
    const callOpts = searchVideos.mock.calls[0][2];
    expect(callOpts.signal).toBeInstanceOf(AbortSignal);
  });
});

describe('POST /api/videos/search request cancellation', () => {
  const verifyToken = (_req, _res, next) => next();

  test('does not abort a normal request whose search resolves asynchronously', async () => {
    // On Node >= 16, req 'close' fires once the request body is consumed, not
    // only on client disconnect. Cancellation keyed to req 'close' aborts every
    // normal request whose search has any real latency.
    let capturedSignal;
    const searchVideos = jest.fn().mockImplementation((_q, _c, { signal }) => {
      capturedSignal = signal;
      return new Promise((resolve) => {
        setTimeout(() => resolve([{ youtubeId: 'a', title: 'A' }]), 25);
      });
    });
    const app = buildApp({ verifyToken, searchVideos });

    const res = await request(app).post('/api/videos/search').send({ query: 'slow' });

    expect(res.status).toBe(200);
    expect(capturedSignal.aborted).toBe(false);
  });

  test('aborts the in-flight search when the client disconnects', async () => {
    let capturedSignal;
    const searchVideos = jest.fn().mockImplementation((_q, _c, { signal }) => {
      capturedSignal = signal;
      return new Promise(() => {}); // stays pending; only the abort signal matters
    });
    const app = buildApp({ verifyToken, searchVideos });
    const server = app.listen(0);

    try {
      const port = server.address().port;
      await new Promise((resolve) => {
        const clientReq = http.request(
          { port, path: '/api/videos/search', method: 'POST', headers: { 'Content-Type': 'application/json' } },
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
