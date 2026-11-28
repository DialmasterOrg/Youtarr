/* eslint-env jest */
const express = require('express');
const request = require('supertest');
const { createRateLimiter } = require('../rateLimiter');

function appWith(limiter) {
  const app = express();
  app.get('/', limiter, (_req, res) => res.json({ ok: true }));
  return app;
}

describe('createRateLimiter', () => {
  test('answers a limited request with the error as JSON and the standard headers only', async () => {
    const app = appWith(createRateLimiter({ max: 1, error: 'Slow down' }));

    expect((await request(app).get('/')).status).toBe(200);
    const limited = await request(app).get('/');

    expect(limited.status).toBe(429);
    expect(limited.body).toEqual({ error: 'Slow down' });
    // One request per the default 60 second window.
    expect(limited.headers).toHaveProperty('ratelimit-policy', '1;w=60');
    expect(limited.headers).not.toHaveProperty('x-ratelimit-limit');
  });

  test('uses the status code the caller sets', async () => {
    const app = appWith(createRateLimiter({ max: 1, statusCode: 503, error: 'Slow down' }));

    await request(app).get('/');
    const limited = await request(app).get('/');

    expect(limited.status).toBe(503);
    expect(limited.body).toEqual({ error: 'Slow down' });
  });

  test('sends a message as given when no error is set', async () => {
    const app = appWith(createRateLimiter({ max: 1, message: 'Plain text' }));

    await request(app).get('/');
    const limited = await request(app).get('/');

    expect(limited.status).toBe(429);
    expect(limited.text).toBe('Plain text');
  });

  test('counts requests per key when a key generator is given', async () => {
    const app = appWith(createRateLimiter({ max: 1, keyGenerator: (req) => req.get('x-key'), error: 'Slow down' }));
    const get = (key) => request(app).get('/').set('x-key', key);

    expect((await get('a')).status).toBe(200);
    expect((await get('b')).status).toBe(200);
    expect((await get('a')).status).toBe(429);
  });
});

describe('createRateLimiter validate option', () => {
  const keyGenerator = () => 'key';
  let rateLimit;
  let create;

  beforeEach(() => {
    jest.resetModules();
    rateLimit = jest.fn();
    jest.doMock('express-rate-limit', () => rateLimit);
    create = require('../rateLimiter').createRateLimiter;
  });

  afterEach(() => jest.dontMock('express-rate-limit'));

  test.each([
    ['turns off only the proxy check by default', {}, { trustProxy: false }],
    ['also turns off the IP check for a custom key', { keyGenerator }, { trustProxy: false, ip: false }],
    ['merges a caller override over the defaults', { keyGenerator, validate: { trustProxy: true } }, { trustProxy: true, ip: false }],
    ['keeps a caller boolean as given', { validate: false }, false],
  ])('%s', (_name, options, expected) => {
    create(options);
    expect(rateLimit.mock.calls[0][0].validate).toEqual(expected);
  });
});
