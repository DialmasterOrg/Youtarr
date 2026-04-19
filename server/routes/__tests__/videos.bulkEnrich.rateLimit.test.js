/* eslint-env jest */
'use strict';

// The sibling routes test mocks express-rate-limit to bypass it. This file
// intentionally does not — we are testing that the limiter engages.
const express = require('express');
const request = require('supertest');

jest.mock('../../logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const createVideoRoutes = require('../videos');

function buildApp({ enricherStub }) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.log = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
    // Express-rate-limit keys by IP; jsdom/supertest uses a stable loopback
    // address, which is what we want for per-key accounting.
    next();
  });
  const router = createVideoRoutes({
    verifyToken: (req, res, next) => next(),
    videosModule: {},
    downloadModule: {},
    videoOembedEnricher: enricherStub,
  });
  app.use(router);
  return app;
}

describe('POST /api/bulkEnrichVideos rate limiter', () => {
  it('returns 429 once the per-minute cap is exceeded', async () => {
    const enricherStub = {
      enrichByIds: jest.fn().mockResolvedValue({}),
    };
    const app = buildApp({ enricherStub });

    // The limiter is 20/min. Fire 20 allowed requests, then a 21st and
    // expect it to be rejected.
    for (let i = 0; i < 20; i++) {
      // eslint-disable-next-line no-await-in-loop
      const res = await request(app)
        .post('/api/bulkEnrichVideos')
        .send({ ids: [] });
      expect(res.status).toBe(200);
    }

    const overflow = await request(app)
      .post('/api/bulkEnrichVideos')
      .send({ ids: [] });

    expect(overflow.status).toBe(429);
    // The limiter handler returns the message string, not JSON.
    expect(overflow.text).toMatch(/Too many enrichment requests/i);
  }, 15000);
});
