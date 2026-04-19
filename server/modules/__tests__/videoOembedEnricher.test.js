/* eslint-env jest */

jest.mock('../download/tempPathManager', () => ({
  getTempBasePath: jest.fn(() => '/tmp/youtarr-downloads'),
}));

jest.mock('../../logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock('https', () => ({ get: jest.fn() }));

const https = require('https');
const { EventEmitter } = require('events');
const enricher = require('../videoOembedEnricher');

/**
 * Test double for http.IncomingMessage. Emits data + end on next tick
 * so response listeners have attached first.
 */
function makeResponse(statusCode, body) {
  const res = new EventEmitter();
  res.statusCode = statusCode;
  res.resume = jest.fn();
  res.destroy = jest.fn();
  setImmediate(() => {
    if (body) res.emit('data', Buffer.from(body));
    res.emit('end');
  });
  return res;
}

function stubHttpsGet(responses) {
  // responses: { [videoId]: { status, body } | 'error' | 'timeout' | undefined (=> 404) }
  https.get.mockImplementation((url, _options, cb) => {
    const match = String(url).match(/v%3D([A-Za-z0-9_-]{11})/);
    const id = match ? match[1] : null;
    const plan = id ? responses[id] : null;

    const req = new EventEmitter();
    req.destroy = jest.fn();

    if (plan === 'error') {
      setImmediate(() => req.emit('error', new Error('connect refused')));
      return req;
    }
    if (plan === 'timeout') {
      setImmediate(() => req.emit('timeout'));
      return req;
    }
    if (!plan) {
      setImmediate(() => cb(makeResponse(404, null)));
      return req;
    }
    setImmediate(() => cb(makeResponse(plan.status, plan.body)));
    return req;
  });
}

/**
 * A rate limiter that never waits. Lets the dedup / cap / error-handling
 * tests run synchronously without burning wall-clock time.
 */
const noopRateLimiter = { waitForSlot: () => Promise.resolve() };

describe('videoOembedEnricher', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('enrichByIds', () => {
    it('returns empty object when ids is empty or invalid', async () => {
      expect(await enricher.enrichByIds([], { rateLimiter: noopRateLimiter })).toEqual({});
      expect(await enricher.enrichByIds(null, { rateLimiter: noopRateLimiter })).toEqual({});
      expect(await enricher.enrichByIds(undefined, { rateLimiter: noopRateLimiter })).toEqual({});
    });

    it('drops invalid-format ids before fetching', async () => {
      stubHttpsGet({});
      const result = await enricher.enrichByIds(
        ['too-short', 12345, null, '', 'has spaces!!'],
        { rateLimiter: noopRateLimiter }
      );
      expect(result).toEqual({});
      expect(https.get).not.toHaveBeenCalled();
    });

    it('fetches title and channelName for valid ids', async () => {
      stubHttpsGet({
        aaaaaaaaaaa: {
          status: 200,
          body: JSON.stringify({ title: 'Video A', author_name: 'Channel A' }),
        },
        bbbbbbbbbbb: {
          status: 200,
          body: JSON.stringify({ title: 'Video B', author_name: 'Channel B' }),
        },
      });
      const result = await enricher.enrichByIds(
        ['aaaaaaaaaaa', 'bbbbbbbbbbb'],
        { rateLimiter: noopRateLimiter }
      );
      expect(result).toEqual({
        aaaaaaaaaaa: { title: 'Video A', channelName: 'Channel A' },
        bbbbbbbbbbb: { title: 'Video B', channelName: 'Channel B' },
      });
    });

    it('omits ids whose oembed response is 404', async () => {
      stubHttpsGet({
        aaaaaaaaaaa: {
          status: 200,
          body: JSON.stringify({ title: 'Only Me', author_name: 'Ch' }),
        },
        bbbbbbbbbbb: { status: 404, body: null },
      });
      const result = await enricher.enrichByIds(
        ['aaaaaaaaaaa', 'bbbbbbbbbbb'],
        { rateLimiter: noopRateLimiter }
      );
      expect(result).toEqual({
        aaaaaaaaaaa: { title: 'Only Me', channelName: 'Ch' },
      });
    });

    it('omits ids whose oembed response is malformed JSON', async () => {
      stubHttpsGet({
        aaaaaaaaaaa: { status: 200, body: 'not-json{{{' },
      });
      const result = await enricher.enrichByIds(
        ['aaaaaaaaaaa'],
        { rateLimiter: noopRateLimiter }
      );
      expect(result).toEqual({});
    });

    it('omits ids whose fetch errors out', async () => {
      stubHttpsGet({
        aaaaaaaaaaa: 'error',
        bbbbbbbbbbb: {
          status: 200,
          body: JSON.stringify({ title: 'B', author_name: 'CB' }),
        },
      });
      const result = await enricher.enrichByIds(
        ['aaaaaaaaaaa', 'bbbbbbbbbbb'],
        { rateLimiter: noopRateLimiter }
      );
      expect(result).toEqual({ bbbbbbbbbbb: { title: 'B', channelName: 'CB' } });
    });

    it('deduplicates ids before fetching', async () => {
      stubHttpsGet({
        aaaaaaaaaaa: {
          status: 200,
          body: JSON.stringify({ title: 'A', author_name: 'CA' }),
        },
      });
      const result = await enricher.enrichByIds(
        ['aaaaaaaaaaa', 'aaaaaaaaaaa', 'aaaaaaaaaaa'],
        { rateLimiter: noopRateLimiter }
      );
      expect(result).toEqual({ aaaaaaaaaaa: { title: 'A', channelName: 'CA' } });
      expect(https.get).toHaveBeenCalledTimes(1);
    });

    it('caps outbound fetches at OEMBED_MAX_IDS_PER_REQUEST when given many unique ids', async () => {
      // Build OEMBED_MAX_IDS_PER_REQUEST + 20 genuinely distinct 11-char ids
      // so that neither dedup nor format-filtering can hide a missing cap.
      const over = enricher.OEMBED_MAX_IDS_PER_REQUEST + 20;
      const chars = 'abcdefghijklmnopqrstuvwxyz0123456789_-';
      const ids = [];
      for (let i = 0; i < over; i++) {
        // Deterministic 11-char id derived from i, guaranteed unique for i < chars.length^2.
        const a = chars[Math.floor(i / chars.length) % chars.length];
        const b = chars[i % chars.length];
        ids.push(`${a}${b}aaaaaaaaa`);
      }
      // Safety: they must actually be unique.
      expect(new Set(ids).size).toBe(over);

      const responses = {};
      ids.forEach((id) => {
        responses[id] = {
          status: 200,
          body: JSON.stringify({ title: id, author_name: 'c' }),
        };
      });
      stubHttpsGet(responses);

      const result = await enricher.enrichByIds(ids, { rateLimiter: noopRateLimiter });

      expect(Object.keys(result)).toHaveLength(enricher.OEMBED_MAX_IDS_PER_REQUEST);
      expect(https.get).toHaveBeenCalledTimes(enricher.OEMBED_MAX_IDS_PER_REQUEST);
    });
  });

  describe('createRateLimiter', () => {
    it('rejects non-positive rps', () => {
      expect(() => enricher.createRateLimiter({ rps: 0 })).toThrow();
      expect(() => enricher.createRateLimiter({ rps: -1 })).toThrow();
      expect(() => enricher.createRateLimiter({})).toThrow();
    });

    it('does not wait on the first slot', async () => {
      let slept = 0;
      let clock = 1000;
      const limiter = enricher.createRateLimiter({
        rps: 3,
        now: () => clock,
        sleep: (ms) => { slept += ms; clock += ms; return Promise.resolve(); },
      });

      await limiter.waitForSlot();
      expect(slept).toBe(0);
    });

    it('spaces consecutive slots by at least 1000/rps ms', async () => {
      let clock = 1000;
      let slept = 0;
      const limiter = enricher.createRateLimiter({
        rps: 3,
        now: () => clock,
        sleep: (ms) => { slept += ms; clock += ms; return Promise.resolve(); },
      });
      const minInterval = Math.ceil(1000 / 3);

      await limiter.waitForSlot(); // fires immediately
      await limiter.waitForSlot();
      expect(slept).toBe(minInterval);

      await limiter.waitForSlot();
      expect(slept).toBe(minInterval * 2);

      await limiter.waitForSlot();
      expect(slept).toBe(minInterval * 3);
    });

    it('does not wait when caller is already past the next slot', async () => {
      let clock = 1000;
      let slept = 0;
      const limiter = enricher.createRateLimiter({
        rps: 3,
        now: () => clock,
        sleep: (ms) => { slept += ms; clock += ms; return Promise.resolve(); },
      });

      await limiter.waitForSlot();      // slot at t=1000
      clock += 5000;                     // caller stalls; next slot already due
      await limiter.waitForSlot();       // should not sleep

      expect(slept).toBe(0);
    });
  });
});
