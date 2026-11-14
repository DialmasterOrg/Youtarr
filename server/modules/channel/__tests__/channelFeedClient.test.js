/* eslint-env jest */
const { EventEmitter } = require('events');

// Required once, into a `mock`-prefixed const; see mockFactories.js for the rules.
const mockFactories = require('./mockFactories');

jest.mock('../../../logger');
jest.mock('https', () => ({ request: jest.fn() }));
jest.mock('../../configModule', () => mockFactories.mockConfigModule());
jest.mock('../../youtubeExistenceCheck', () => ({ lookup: jest.fn() }));

const CHANNEL_ID = 'UCaaaaaaaaaaaaaaaaaaaaaa';
const MEGABYTE = 1024 * 1024;

const entry = (videoId, link) => `
 <entry>
  <yt:videoId>${videoId}</yt:videoId>
  <yt:channelId>${CHANNEL_ID}</yt:channelId>
  <link rel="alternate" href="${link}"/>
 </entry>`;

const feed = ({ feedChannelId = 'aaaaaaaaaaaaaaaaaaaaaa', entries = '', closed = true } = {}) =>
  `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns="http://www.w3.org/2005/Atom">
 <yt:channelId>${feedChannelId}</yt:channelId>${entries}
${closed ? '</feed>' : ''}`;

const TWO_ENTRIES =
  entry('AAAAAAAAAA1', 'https://www.youtube.com/watch?v=AAAAAAAAAA1') +
  entry('AAAAAAAAAA2', 'https://www.youtube.com/shorts/AAAAAAAAAA2');

describe('channelFeedClient', () => {
  let channelFeedClient;
  let https;
  let configModule;
  let youtubeExistenceCheck;

  // Answers each request on the next tick: an error, a timeout, or a response
  // with the given status whose body arrives as the given chunks.
  const mockFeedRequest = ({ status = 200, chunks = [''], error = null, timeout = false } = {}) => {
    const requests = [];
    https.request.mockImplementation((options, onResponse) => {
      const req = new EventEmitter();
      req.options = options;
      req.destroy = jest.fn((err) => {
        if (err) process.nextTick(() => req.emit('error', err));
      });
      req.end = jest.fn(() => {
        process.nextTick(() => {
          if (error) {
            req.emit('error', error);
            return;
          }
          if (timeout) {
            req.emit('timeout');
            return;
          }
          const res = new EventEmitter();
          res.statusCode = status;
          res.resume = jest.fn();
          res.destroy = jest.fn();
          onResponse(res);
          chunks.forEach((chunk) => res.emit('data', Buffer.from(chunk)));
          res.emit('end');
        });
      });
      requests.push(req);
      return req;
    });
    return requests;
  };

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    https = require('https');
    configModule = require('../../configModule');
    youtubeExistenceCheck = require('../../youtubeExistenceCheck');
    channelFeedClient = require('../channelFeedClient');
  });

  describe('parseFeed', () => {
    test('reads video ids and marks shorts', () => {
      expect(channelFeedClient.parseFeed(feed({ entries: TWO_ENTRIES }), CHANNEL_ID)).toEqual({
        ok: true,
        entries: [
          { youtubeId: 'AAAAAAAAAA1', isShort: false },
          { youtubeId: 'AAAAAAAAAA2', isShort: true },
        ],
      });
    });

    test('accepts a feed with no entries', () => {
      expect(channelFeedClient.parseFeed(feed(), CHANNEL_ID)).toEqual({ ok: true, entries: [] });
    });

    test('accepts a feed-level id that keeps its UC prefix', () => {
      const result = channelFeedClient.parseFeed(feed({ feedChannelId: CHANNEL_ID, entries: TWO_ENTRIES }), CHANNEL_ID);

      expect(result.ok).toBe(true);
    });

    test('rejects another channel\'s feed', () => {
      const result = channelFeedClient.parseFeed(
        feed({ feedChannelId: 'bbbbbbbbbbbbbbbbbbbbbb', entries: TWO_ENTRIES }),
        CHANNEL_ID
      );

      expect(result).toEqual({ ok: false, reason: 'wrong-channel' });
    });

    test('rejects an HTML error page', () => {
      const html = '<!DOCTYPE html><html lang=en><title>Error 404 (Not Found)!!1</title></html>';

      expect(channelFeedClient.parseFeed(html, CHANNEL_ID)).toEqual({ ok: false, reason: 'parse-error' });
    });

    test('rejects a feed cut off before </feed>', () => {
      const result = channelFeedClient.parseFeed(feed({ entries: TWO_ENTRIES, closed: false }), CHANNEL_ID);

      expect(result).toEqual({ ok: false, reason: 'parse-error' });
    });

    test('rejects an empty body', () => {
      expect(channelFeedClient.parseFeed('', CHANNEL_ID)).toEqual({ ok: false, reason: 'parse-error' });
    });

    test('skips an entry whose id is malformed', () => {
      const entries =
        entry('not-an-id', 'https://www.youtube.com/watch?v=not-an-id') +
        entry('AAAAAAAAAA1', 'https://www.youtube.com/watch?v=AAAAAAAAAA1');

      expect(channelFeedClient.parseFeed(feed({ entries }), CHANNEL_ID)).toEqual({
        ok: true,
        entries: [{ youtubeId: 'AAAAAAAAAA1', isShort: false }],
      });
    });

    test('takes the channel id from the feed header, not from an entry', () => {
      const xml = `<feed>${entry('AAAAAAAAAA1', 'https://www.youtube.com/watch?v=AAAAAAAAAA1')}</feed>`;

      expect(channelFeedClient.parseFeed(xml, CHANNEL_ID)).toEqual({ ok: false, reason: 'parse-error' });
    });
  });

  describe('supportsChannel', () => {
    test('accepts a UC channel id', () => {
      expect(channelFeedClient.supportsChannel(CHANNEL_ID)).toBe(true);
    });

    test.each([
      ['a playlist id', 'UULFaaaaaaaaaaaaaaaaaaaaaa'],
      ['a handle', '@somechannel'],
      ['a short id', 'UCabc'],
      ['null', null],
    ])('rejects %s', (_label, channelId) => {
      expect(channelFeedClient.supportsChannel(channelId)).toBe(false);
    });
  });

  describe('fetchChannelFeed', () => {
    test('returns the entries of a valid feed', async () => {
      mockFeedRequest({ chunks: [feed({ entries: TWO_ENTRIES })] });

      await expect(channelFeedClient.fetchChannelFeed(CHANNEL_ID)).resolves.toEqual({
        ok: true,
        entries: [
          { youtubeId: 'AAAAAAAAAA1', isShort: false },
          { youtubeId: 'AAAAAAAAAA2', isShort: true },
        ],
      });
    });

    test('reads a feed that arrives in several chunks', async () => {
      const xml = feed({ entries: TWO_ENTRIES });
      mockFeedRequest({ chunks: [xml.slice(0, 120), xml.slice(120)] });

      const result = await channelFeedClient.fetchChannelFeed(CHANNEL_ID);

      expect(result.entries).toHaveLength(2);
    });

    test('asks YouTube for the channel feed', async () => {
      const requests = mockFeedRequest({ chunks: [feed()] });

      await channelFeedClient.fetchChannelFeed(CHANNEL_ID);

      expect(requests[0].options).toEqual(expect.objectContaining({
        host: 'www.youtube.com',
        path: `/feeds/videos.xml?channel_id=${CHANNEL_ID}`,
        method: 'GET',
        timeout: 15000,
        lookup: youtubeExistenceCheck.lookup,
      }));
    });

    test('sends no cookies', async () => {
      const requests = mockFeedRequest({ chunks: [feed()] });

      await channelFeedClient.fetchChannelFeed(CHANNEL_ID);

      expect(Object.keys(requests[0].options.headers)).toEqual(['User-Agent']);
    });

    test.each([
      ['a playlist id', 'UULFaaaaaaaaaaaaaaaaaaaaaa'],
      ['an id with a query string', `${CHANNEL_ID}&x=1`],
      ['a handle', '@somechannel'],
      ['nothing', undefined],
    ])('makes no request for %s', async (_label, channelId) => {
      mockFeedRequest();

      await expect(channelFeedClient.fetchChannelFeed(channelId)).resolves.toEqual({
        ok: false,
        reason: 'invalid-channel-id',
      });
      expect(https.request).not.toHaveBeenCalled();
    });

    test('reports a 404 as http-error with its status', async () => {
      mockFeedRequest({ status: 404, chunks: ['<html>Error 404</html>'] });

      await expect(channelFeedClient.fetchChannelFeed(CHANNEL_ID)).resolves.toEqual({
        ok: false,
        reason: 'http-error',
        status: 404,
      });
    });

    test('reports a 500 as http-error with its status', async () => {
      mockFeedRequest({ status: 500 });

      await expect(channelFeedClient.fetchChannelFeed(CHANNEL_ID)).resolves.toEqual({
        ok: false,
        reason: 'http-error',
        status: 500,
      });
    });

    test('reports a timeout', async () => {
      mockFeedRequest({ timeout: true });

      await expect(channelFeedClient.fetchChannelFeed(CHANNEL_ID)).resolves.toEqual({
        ok: false,
        reason: 'timeout',
      });
    });

    test('reports a connection error', async () => {
      mockFeedRequest({ error: Object.assign(new Error('getaddrinfo EAI_AGAIN'), { code: 'EAI_AGAIN' }) });

      await expect(channelFeedClient.fetchChannelFeed(CHANNEL_ID)).resolves.toEqual({
        ok: false,
        reason: 'network',
      });
    });

    test('reports a request that could not be started', async () => {
      https.request.mockImplementation(() => {
        throw new Error('socket hang up');
      });

      await expect(channelFeedClient.fetchChannelFeed(CHANNEL_ID)).resolves.toEqual({
        ok: false,
        reason: 'network',
      });
    });

    test('stops reading past 1 MB', async () => {
      mockFeedRequest({ chunks: ['x'.repeat(MEGABYTE - 10), 'x'.repeat(20), feed({ entries: TWO_ENTRIES })] });

      await expect(channelFeedClient.fetchChannelFeed(CHANNEL_ID)).resolves.toEqual({
        ok: false,
        reason: 'too-large',
      });
    });

    test('reports a 200 that is not this channel\'s feed', async () => {
      mockFeedRequest({ chunks: [feed({ feedChannelId: 'bbbbbbbbbbbbbbbbbbbbbb' })] });

      await expect(channelFeedClient.fetchChannelFeed(CHANNEL_ID)).resolves.toEqual({
        ok: false,
        reason: 'wrong-channel',
      });
    });

    test('asks for IPv4 by default', async () => {
      const requests = mockFeedRequest({ chunks: [feed()] });

      await channelFeedClient.fetchChannelFeed(CHANNEL_ID);

      expect(requests[0].options.family).toBe(4);
    });

    test('asks for IPv6 when ytdlpIpFamily is ipv6', async () => {
      configModule.getConfig.mockReturnValue({ ytdlpIpFamily: 'ipv6' });
      const requests = mockFeedRequest({ chunks: [feed()] });

      await channelFeedClient.fetchChannelFeed(CHANNEL_ID);

      expect(requests[0].options.family).toBe(6);
    });

    test('leaves the family out for auto', async () => {
      configModule.getConfig.mockReturnValue({ ytdlpIpFamily: 'auto' });
      const requests = mockFeedRequest({ chunks: [feed()] });

      await channelFeedClient.fetchChannelFeed(CHANNEL_ID);

      expect(requests[0].options).not.toHaveProperty('family');
    });
  });

  describe('fetchMembersFeed', () => {
    test('asks YouTube for the channel\'s members-only uploads feed', async () => {
      const requests = mockFeedRequest({ chunks: [feed({ feedChannelId: CHANNEL_ID })] });

      await channelFeedClient.fetchMembersFeed(CHANNEL_ID);

      expect(requests[0].options).toEqual(expect.objectContaining({
        host: 'www.youtube.com',
        path: '/feeds/videos.xml?playlist_id=UUMOaaaaaaaaaaaaaaaaaaaaaa',
        method: 'GET',
      }));
    });

    test('returns the entries of a feed that names the channel with its UC prefix', async () => {
      mockFeedRequest({ chunks: [feed({ feedChannelId: CHANNEL_ID, entries: TWO_ENTRIES })] });

      await expect(channelFeedClient.fetchMembersFeed(CHANNEL_ID)).resolves.toEqual({
        ok: true,
        entries: [
          { youtubeId: 'AAAAAAAAAA1', isShort: false },
          { youtubeId: 'AAAAAAAAAA2', isShort: true },
        ],
      });
    });

    test('reports a 404 as http-error with its status', async () => {
      mockFeedRequest({ status: 404, chunks: ['<html>Error 404</html>'] });

      await expect(channelFeedClient.fetchMembersFeed(CHANNEL_ID)).resolves.toEqual({
        ok: false,
        reason: 'http-error',
        status: 404,
      });
    });

    test('makes no request for an id that is not a channel id', async () => {
      mockFeedRequest();

      await expect(channelFeedClient.fetchMembersFeed(`${CHANNEL_ID}&x=1`)).resolves.toEqual({
        ok: false,
        reason: 'invalid-channel-id',
      });
      expect(https.request).not.toHaveBeenCalled();
    });

    test('reports a 200 that is another channel\'s feed', async () => {
      mockFeedRequest({ chunks: [feed({ feedChannelId: 'UCbbbbbbbbbbbbbbbbbbbbbb' })] });

      await expect(channelFeedClient.fetchMembersFeed(CHANNEL_ID)).resolves.toEqual({
        ok: false,
        reason: 'wrong-channel',
      });
    });
  });
});
