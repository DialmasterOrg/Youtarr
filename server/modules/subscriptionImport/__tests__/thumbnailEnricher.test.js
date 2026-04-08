'use strict';

const { PassThrough } = require('stream');

jest.mock('https');
jest.mock('../../../logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

function createMockResponse(statusCode, body, headers = {}) {
  const stream = new PassThrough();
  stream.statusCode = statusCode;
  stream.headers = headers;
  process.nextTick(() => {
    stream.end(body);
  });
  return stream;
}

let enrichWithThumbnails;
let https;
let logger;

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();

  https = require('https');
  logger = require('../../../logger');
  ({ enrichWithThumbnails } = require('../thumbnailEnricher'));
});

const CHANNEL_WITH_OG = `
<html>
<head>
<meta property="og:image" content="https://yt3.googleusercontent.com/ytc/thumb123=s900-c-k-c0x00ffffff-no-rj">
</head>
<body></body>
</html>
`;

const CHANNEL_WITHOUT_OG = `
<html>
<head>
<title>Some Channel</title>
</head>
<body></body>
</html>
`;

const SAMPLE_CHANNELS = [
  { channelId: 'UCabc123', title: 'Channel A', url: 'https://www.youtube.com/channel/UCabc123' },
  { channelId: 'UCdef456', title: 'Channel B', url: 'https://www.youtube.com/channel/UCdef456' },
];

describe('enrichWithThumbnails', () => {
  test('enriches channels with thumbnailUrl when og:image found in response body', async () => {
    https.get.mockImplementation((_url, _opts, callback) => {
      const res = createMockResponse(200, CHANNEL_WITH_OG);
      callback(res);
      const req = { destroy: jest.fn(), on: jest.fn() };
      return req;
    });

    const result = await enrichWithThumbnails(SAMPLE_CHANNELS);

    expect(result).toHaveLength(2);
    expect(result[0].channelId).toBe('UCabc123');
    expect(result[0].thumbnailUrl).toBe(
      'https://yt3.googleusercontent.com/ytc/thumb123=s900-c-k-c0x00ffffff-no-rj'
    );
    expect(result[1].channelId).toBe('UCdef456');
    expect(result[1].thumbnailUrl).toBe(
      'https://yt3.googleusercontent.com/ytc/thumb123=s900-c-k-c0x00ffffff-no-rj'
    );
    // Original fields preserved
    expect(result[0].title).toBe('Channel A');
    expect(result[0].url).toBe('https://www.youtube.com/channel/UCabc123');
  });

  test('sets thumbnailUrl to null when response lacks og:image meta tag', async () => {
    https.get.mockImplementation((_url, _opts, callback) => {
      const res = createMockResponse(200, CHANNEL_WITHOUT_OG);
      callback(res);
      const req = { destroy: jest.fn(), on: jest.fn() };
      return req;
    });

    const result = await enrichWithThumbnails([SAMPLE_CHANNELS[0]]);

    expect(result[0].thumbnailUrl).toBeNull();
  });

  test('sets thumbnailUrl to null on HTTP 4xx response', async () => {
    https.get.mockImplementation((_url, _opts, callback) => {
      const res = createMockResponse(404, 'Not Found');
      callback(res);
      const req = { destroy: jest.fn(), on: jest.fn() };
      return req;
    });

    const result = await enrichWithThumbnails([SAMPLE_CHANNELS[0]]);

    expect(result[0].thumbnailUrl).toBeNull();
    expect(logger.warn).toHaveBeenCalled();
  });

  test('sets thumbnailUrl to null on HTTP 5xx response', async () => {
    https.get.mockImplementation((_url, _opts, callback) => {
      const res = createMockResponse(500, 'Internal Server Error');
      callback(res);
      const req = { destroy: jest.fn(), on: jest.fn() };
      return req;
    });

    const result = await enrichWithThumbnails([SAMPLE_CHANNELS[0]]);

    expect(result[0].thumbnailUrl).toBeNull();
    expect(logger.warn).toHaveBeenCalled();
  });

  test('sets thumbnailUrl to null on request timeout', async () => {
    https.get.mockImplementation(() => {
      const req = {
        destroy: jest.fn(),
        on: jest.fn((event, handler) => {
          if (event === 'timeout') {
            // Trigger the timeout handler synchronously for testing
            process.nextTick(handler);
          }
          return req;
        }),
      };
      return req;
    });

    const result = await enrichWithThumbnails([SAMPLE_CHANNELS[0]]);

    expect(result[0].thumbnailUrl).toBeNull();
    expect(logger.warn).toHaveBeenCalled();
  });

  test('sets thumbnailUrl to null on request error', async () => {
    https.get.mockImplementation(() => {
      const req = {
        destroy: jest.fn(),
        on: jest.fn((event, handler) => {
          if (event === 'error') {
            process.nextTick(() => handler(new Error('ECONNREFUSED')));
          }
          return req;
        }),
      };
      return req;
    });

    const result = await enrichWithThumbnails([SAMPLE_CHANNELS[0]]);

    expect(result[0].thumbnailUrl).toBeNull();
    expect(logger.warn).toHaveBeenCalled();
  });

  test('never throws to caller even when all channels fail', async () => {
    https.get.mockImplementation(() => {
      const req = {
        destroy: jest.fn(),
        on: jest.fn((event, handler) => {
          if (event === 'error') {
            process.nextTick(() => handler(new Error('Network failure')));
          }
          return req;
        }),
      };
      return req;
    });

    const channels = [
      { channelId: 'UC1', title: 'Ch1', url: 'https://www.youtube.com/channel/UC1' },
      { channelId: 'UC2', title: 'Ch2', url: 'https://www.youtube.com/channel/UC2' },
      { channelId: 'UC3', title: 'Ch3', url: 'https://www.youtube.com/channel/UC3' },
    ];

    // Should not throw
    await expect(enrichWithThumbnails(channels)).resolves.toBeDefined();

    const result = await enrichWithThumbnails(channels);
    expect(result).toHaveLength(3);
    result.forEach((ch) => expect(ch.thumbnailUrl).toBeNull());
  });

  test('handles empty channels array', async () => {
    const result = await enrichWithThumbnails([]);
    expect(result).toEqual([]);
    expect(https.get).not.toHaveBeenCalled();
  });

  test('respects concurrency cap', async () => {
    let inFlight = 0;
    let peak = 0;

    // We need 20 channels to see the cap in action
    const manyChannels = Array.from({ length: 20 }, (_, i) => ({
      channelId: `UC${i}`,
      title: `Channel ${i}`,
      url: `https://www.youtube.com/channel/UC${i}`,
    }));

    // Track in-flight using a controlled promise
    const resolvers = [];

    https.get.mockImplementation((_url, _opts, callback) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);

      const req = { destroy: jest.fn(), on: jest.fn().mockReturnThis() };

      // Each fetch waits until we manually resolve it
      const p = new Promise((resolve) => resolvers.push(resolve));

      p.then(() => {
        inFlight -= 1;
        const res = createMockResponse(200, CHANNEL_WITH_OG);
        callback(res);
      });

      return req;
    });

    const enrichPromise = enrichWithThumbnails(manyChannels);

    // Allow the queue to fill up to the concurrency limit
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));

    // Peak should be <= THUMBNAIL_CONCURRENCY (8)
    expect(peak).toBeLessThanOrEqual(8);
    expect(peak).toBeGreaterThan(0);

    // Resolve all pending fetches so the test completes
    while (resolvers.length > 0) {
      const batch = resolvers.splice(0, resolvers.length);
      batch.forEach((resolve) => resolve());
      await new Promise((r) => setImmediate(r));
    }

    await enrichPromise;
  });

  test('follows one level of redirect (3xx with Location header)', async () => {
    let callCount = 0;

    https.get.mockImplementation((url, _opts, callback) => {
      callCount += 1;
      if (callCount === 1) {
        // First call: 301 redirect
        const res = createMockResponse(301, '', {
          location: 'https://www.youtube.com/channel/UCabc123_redirected',
        });
        callback(res);
      } else {
        // Second call (redirect target): 200 with og:image
        const res = createMockResponse(200, CHANNEL_WITH_OG);
        callback(res);
      }
      const req = { destroy: jest.fn(), on: jest.fn().mockReturnThis() };
      return req;
    });

    const result = await enrichWithThumbnails([SAMPLE_CHANNELS[0]]);

    expect(result[0].thumbnailUrl).toBe(
      'https://yt3.googleusercontent.com/ytc/thumb123=s900-c-k-c0x00ffffff-no-rj'
    );
    expect(callCount).toBe(2);
  });
});
