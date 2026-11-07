/* eslint-env jest */
const express = require('express');
const supertest = require('supertest');

jest.mock('../../modules/download/ytdlpValidator', () => ({
  dryRun: jest.fn(),
}));

const ytdlpValidator = require('../../modules/download/ytdlpValidator');
const createYtdlpOptionsRoutes = require('../ytdlpOptions');

function makeApp({ verifyToken } = {}) {
  const app = express();
  app.use(express.json());
  const verify = verifyToken || ((_req, _res, next) => next());
  const passthroughLimiter = (_req, _res, next) => next();
  app.use(createYtdlpOptionsRoutes({
    verifyToken: verify,
    ytdlpValidationRateLimiter: passthroughLimiter,
  }));
  return app;
}

describe('POST /api/ytdlp/validate-args', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns 401 when verifyToken rejects', async () => {
    const app = makeApp({
      verifyToken: (_req, res) => res.status(401).json({ error: 'unauthorized' }),
    });
    const res = await supertest(app).post('/api/ytdlp/validate-args').send({ args: '' });
    expect(res.status).toBe(401);
  });

  test('returns 400 when args is not a string', async () => {
    const app = makeApp();
    const res = await supertest(app).post('/api/ytdlp/validate-args').send({ args: 42 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/string/i);
  });

  test('returns 400 when args exceeds 2000 characters', async () => {
    const app = makeApp();
    const longArgs = '--no-mtime '.repeat(200);
    const res = await supertest(app).post('/api/ytdlp/validate-args').send({ args: longArgs });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/2000/);
  });

  test('returns 400 on an unterminated quote', async () => {
    const app = makeApp();
    const res = await supertest(app)
      .post('/api/ytdlp/validate-args')
      .send({ args: '--user-agent \'unterminated' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/quote/i);
  });

  test('returns 400 with the offending flag on blocked input, and never runs the dry-run', async () => {
    const app = makeApp();
    const res = await supertest(app)
      .post('/api/ytdlp/validate-args')
      .send({ args: '--exec rm' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('--exec');
    expect(res.body.customArgsCheck.blocked[0].option).toBe('--exec');
    expect(ytdlpValidator.dryRun).not.toHaveBeenCalled();
  });

  test('returns both parse errors and blocked flags when the input has both', async () => {
    const app = makeApp();
    const res = await supertest(app)
      .post('/api/ytdlp/validate-args')
      .send({ args: 'stray --exec rm' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/"stray"/);
    expect(res.body.customArgsCheck.errors[0]).toMatch(/"stray"/);
    expect(res.body.customArgsCheck.blocked[0].option).toBe('--exec');
  });

  test('returns 200 { ok: true } with canonical args handed to the dry-run', async () => {
    ytdlpValidator.dryRun.mockResolvedValueOnce({ ok: true, stderr: '' });
    const app = makeApp();
    const res = await supertest(app)
      .post('/api/ytdlp/validate-args')
      .send({ args: '-N 4' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.message).toMatch(/parsed/i);
    expect(ytdlpValidator.dryRun).toHaveBeenCalledWith(['--concurrent-fragments', '4']);
  });

  test('returns warnings for an accepted-but-risky flag', async () => {
    ytdlpValidator.dryRun.mockResolvedValueOnce({ ok: true, stderr: '' });
    const app = makeApp();
    const res = await supertest(app)
      .post('/api/ytdlp/validate-args')
      .send({ args: '--extract-audio' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.warnings[0].option).toBe('--extract-audio');
  });

  test('returns 200 { ok: false, stderr } when yt-dlp argparse rejects an allowed flag value', async () => {
    ytdlpValidator.dryRun.mockResolvedValueOnce({
      ok: false,
      stderr: 'yt-dlp: error: invalid int value',
    });
    const app = makeApp();
    const res = await supertest(app)
      .post('/api/ytdlp/validate-args')
      .send({ args: '--retries abc' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(false);
    expect(res.body.stderr).toContain('invalid int value');
  });
});

describe('POST /api/ytdlp/validate-args — rate limiter wiring', () => {
  test('invokes the provided rate limiter middleware before the handler', async () => {
    const limiter = jest.fn((_req, res) =>
      res.status(429).json({ error: 'too many' })
    );
    const app = express();
    app.use(express.json());
    app.use(createYtdlpOptionsRoutes({
      verifyToken: (_req, _res, next) => next(),
      ytdlpValidationRateLimiter: limiter,
    }));
    const res = await supertest(app)
      .post('/api/ytdlp/validate-args')
      .send({ args: '--no-mtime' });
    expect(res.status).toBe(429);
    expect(limiter).toHaveBeenCalled();
  });
});
