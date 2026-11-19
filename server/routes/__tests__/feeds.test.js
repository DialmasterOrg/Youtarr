/* eslint-env jest */
const express = require('express');
const supertest = require('supertest');
const createFeedRoutes = require('../feeds');

const FEED_XML = '<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"></rss>';
const FEED_TOKEN = 'a'.repeat(64);
const FEED_PATH = `/feeds/downloads.xml?token=${FEED_TOKEN}`;

function makeApp(overrides = {}) {
  const downloadsFeed = {
    isAuthorized: jest.fn((token) => token === FEED_TOKEN),
    renderFeed: jest.fn().mockResolvedValue(FEED_XML),
    getOrCreateToken: jest.fn(() => FEED_TOKEN),
    regenerateToken: jest.fn(() => 'b'.repeat(64)),
    ...overrides.downloadsFeed,
  };
  const verifyToken = overrides.verifyToken || ((_req, _res, next) => next());
  const feedLimiter = overrides.feedLimiter || ((_req, _res, next) => next());
  const log = { error: jest.fn() };

  const app = express();
  app.set('trust proxy', true);
  app.use((req, _res, next) => {
    req.log = log;
    next();
  });
  app.use(createFeedRoutes({ verifyToken, feedLimiter, downloadsFeed }));
  // The real app serves the SPA for any path no route answers.
  app.get('*', (_req, res) => res.send('<html>spa</html>'));
  return { app, downloadsFeed, log };
}

const refuseSession = (_req, res) => res.status(403).json({ error: 'No token provided' });

describe('GET /feeds/downloads.xml', () => {
  test('returns the feed as RSS for the right token', async () => {
    const { app } = makeApp();

    const res = await supertest(app).get(FEED_PATH);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/rss+xml; charset=utf-8');
    expect(res.text).toBe(FEED_XML);
  });

  test('does not need a login session, because RSS readers cannot log in', async () => {
    const { app } = makeApp({ verifyToken: refuseSession });

    const res = await supertest(app).get(FEED_PATH);

    expect(res.status).toBe(200);
  });

  test('builds links from the address the reader used', async () => {
    const { app, downloadsFeed } = makeApp();

    await supertest(app).get(FEED_PATH).set('Host', 'youtarr.example.com');

    expect(downloadsFeed.renderFeed).toHaveBeenCalledWith('http://youtarr.example.com');
  });

  test('uses https when a trusted proxy says the reader used https', async () => {
    const { app, downloadsFeed } = makeApp();

    await supertest(app)
      .get(FEED_PATH)
      .set('Host', 'youtarr.example.com')
      .set('X-Forwarded-Proto', 'https');

    expect(downloadsFeed.renderFeed).toHaveBeenCalledWith('https://youtarr.example.com');
  });

  test('answers 404 for a wrong token without building the feed', async () => {
    const { app, downloadsFeed } = makeApp();

    const res = await supertest(app).get('/feeds/downloads.xml?token=wrong');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Feed not found' });
    expect(downloadsFeed.renderFeed).not.toHaveBeenCalled();
  });

  test('answers 404 without a token', async () => {
    const { app } = makeApp();

    const res = await supertest(app).get('/feeds/downloads.xml');

    expect(res.status).toBe(404);
  });

  test('passes a repeated token parameter through for the feed to refuse', async () => {
    const { app, downloadsFeed } = makeApp();

    await supertest(app).get(`/feeds/downloads.xml?token=${FEED_TOKEN}&token=x`);

    expect(downloadsFeed.isAuthorized).toHaveBeenCalledWith([FEED_TOKEN, 'x']);
  });

  test('answers 304 when the reader already has this version', async () => {
    const { app } = makeApp();
    const first = await supertest(app).get(FEED_PATH);

    const second = await supertest(app).get(FEED_PATH).set('If-None-Match', first.headers.etag);

    expect(first.headers.etag).toBeTruthy();
    expect(second.status).toBe(304);
  });

  test('keeps the response out of shared caches and makes readers revalidate', async () => {
    const { app } = makeApp();

    const res = await supertest(app).get(FEED_PATH);

    expect(res.headers['cache-control']).toBe('private, no-cache');
  });

  test('logs and reports a failure to build the feed', async () => {
    const error = new Error('database unavailable');
    const { app, log } = makeApp({
      downloadsFeed: { renderFeed: jest.fn().mockRejectedValue(error) },
    });

    const res = await supertest(app).get(FEED_PATH);

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Failed to build the feed' });
    expect(log.error).toHaveBeenCalledWith({ err: error }, 'Failed to build the downloads feed');
  });
});

describe('the /feeds namespace', () => {
  test('answers 404 for an unknown feed instead of serving the app', async () => {
    const { app } = makeApp();

    const res = await supertest(app).get('/feeds/other.xml');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Feed not found' });
  });

  test('applies the rate limit to every feed request', async () => {
    const feedLimiter = (_req, res) => res.status(429).json({ error: 'Too many feed requests' });
    const { app, downloadsFeed } = makeApp({ feedLimiter });

    const res = await supertest(app).get(FEED_PATH);

    expect(res.status).toBe(429);
    expect(downloadsFeed.renderFeed).not.toHaveBeenCalled();
  });
});

describe('GET /api/feeds/downloads/token', () => {
  test('returns the token', async () => {
    const { app } = makeApp();

    const res = await supertest(app).get('/api/feeds/downloads/token');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ token: FEED_TOKEN });
  });

  test('requires a login session', async () => {
    const { app, downloadsFeed } = makeApp({ verifyToken: refuseSession });

    const res = await supertest(app).get('/api/feeds/downloads/token');

    expect(res.status).toBe(403);
    expect(downloadsFeed.getOrCreateToken).not.toHaveBeenCalled();
  });

  test('logs and reports a failure to save a new token', async () => {
    const error = new Error('disk full');
    const { app, log } = makeApp({
      downloadsFeed: { getOrCreateToken: jest.fn(() => { throw error; }) },
    });

    const res = await supertest(app).get('/api/feeds/downloads/token');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Failed to read the feed token' });
    expect(log.error).toHaveBeenCalledWith({ err: error }, 'Failed to read the downloads feed token');
  });
});

describe('POST /api/feeds/downloads/regenerate-token', () => {
  test('returns the new token', async () => {
    const { app } = makeApp();

    const res = await supertest(app).post('/api/feeds/downloads/regenerate-token');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ token: 'b'.repeat(64) });
  });

  test('requires a login session', async () => {
    const { app, downloadsFeed } = makeApp({ verifyToken: refuseSession });

    const res = await supertest(app).post('/api/feeds/downloads/regenerate-token');

    expect(res.status).toBe(403);
    expect(downloadsFeed.regenerateToken).not.toHaveBeenCalled();
  });

  test('logs and reports a failure to save the new token', async () => {
    const error = new Error('disk full');
    const { app, log } = makeApp({
      downloadsFeed: { regenerateToken: jest.fn(() => { throw error; }) },
    });

    const res = await supertest(app).post('/api/feeds/downloads/regenerate-token');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Failed to create a new feed URL' });
    expect(log.error).toHaveBeenCalledWith({ err: error }, 'Failed to regenerate the downloads feed token');
  });
});
