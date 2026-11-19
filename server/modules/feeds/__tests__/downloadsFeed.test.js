/* eslint-env jest */
jest.mock('../../../models', () => ({ Video: { findAll: jest.fn() } }));
jest.mock('../../configModule', () => ({ getConfig: jest.fn(), updateConfig: jest.fn() }));
jest.mock('../../../logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const { Op } = require('sequelize');

const SAVED_TOKEN = 'a'.repeat(64);
const ORIGIN = 'https://youtarr.example.com';
const DOWNLOADED_AT = new Date('2026-11-05T12:29:00.000Z');

const makeRow = (overrides = {}) => ({
  youtubeId: 'dQw4w9WgXcQ',
  youTubeVideoName: 'A video',
  youTubeChannelName: 'A channel',
  duration: 754,
  originalDate: '20261103',
  description: 'About this video',
  youtube_removed: false,
  last_downloaded_at: DOWNLOADED_AT,
  ...overrides,
});

describe('downloadsFeed', () => {
  let downloadsFeed;
  let Video;
  let configModule;

  const useConfig = (config) => configModule.getConfig.mockReturnValue(config);

  const renderWith = async (rows, config = {}) => {
    useConfig(config);
    Video.findAll.mockResolvedValue(rows);
    return downloadsFeed.renderFeed(ORIGIN);
  };

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    Video = require('../../../models').Video;
    configModule = require('../../configModule');
    downloadsFeed = require('../downloadsFeed');
  });

  describe('isAuthorized', () => {
    test('accepts the saved token while the feed is on', () => {
      useConfig({ downloadsFeedEnabled: true, downloadsFeedToken: SAVED_TOKEN });

      expect(downloadsFeed.isAuthorized(SAVED_TOKEN)).toBe(true);
    });

    test('refuses a different token', () => {
      useConfig({ downloadsFeedEnabled: true, downloadsFeedToken: SAVED_TOKEN });

      expect(downloadsFeed.isAuthorized('b'.repeat(64))).toBe(false);
    });

    test('refuses the saved token while the feed is off', () => {
      useConfig({ downloadsFeedEnabled: false, downloadsFeedToken: SAVED_TOKEN });

      expect(downloadsFeed.isAuthorized(SAVED_TOKEN)).toBe(false);
    });

    test.each([undefined, ''])('refuses every value when the saved token is %p', (saved) => {
      useConfig({ downloadsFeedEnabled: true, downloadsFeedToken: saved });

      expect(downloadsFeed.isAuthorized('')).toBe(false);
      expect(downloadsFeed.isAuthorized(undefined)).toBe(false);
    });

    test('refuses a repeated query parameter, which arrives as an array', () => {
      useConfig({ downloadsFeedEnabled: true, downloadsFeedToken: SAVED_TOKEN });

      expect(downloadsFeed.isAuthorized([SAVED_TOKEN])).toBe(false);
    });
  });

  describe('getOrCreateToken', () => {
    test('returns the saved token without writing the config', () => {
      useConfig({ downloadsFeedToken: SAVED_TOKEN });

      expect(downloadsFeed.getOrCreateToken()).toBe(SAVED_TOKEN);
      expect(configModule.updateConfig).not.toHaveBeenCalled();
    });

    test('creates and saves a long random token when none exists', () => {
      useConfig({ plexApiKey: 'keep-me' });

      const token = downloadsFeed.getOrCreateToken();

      expect(token).toMatch(/^[0-9a-f]{64}$/);
      expect(configModule.updateConfig).toHaveBeenCalledWith({
        plexApiKey: 'keep-me',
        downloadsFeedToken: token,
      });
    });
  });

  describe('regenerateToken', () => {
    test('replaces the saved token and keeps the other settings', () => {
      useConfig({ plexApiKey: 'keep-me', downloadsFeedToken: SAVED_TOKEN });

      const token = downloadsFeed.regenerateToken();

      expect(token).toMatch(/^[0-9a-f]{64}$/);
      expect(token).not.toBe(SAVED_TOKEN);
      expect(configModule.updateConfig).toHaveBeenCalledWith({
        plexApiKey: 'keep-me',
        downloadsFeedToken: token,
      });
    });
  });

  test('never logs a new token', () => {
    const logger = require('../../../logger');
    useConfig({});

    const token = downloadsFeed.regenerateToken();

    expect(JSON.stringify(logger.info.mock.calls)).not.toContain(token);
  });

  describe('renderFeed', () => {
    test('lists present, downloaded videos with the newest download first', async () => {
      await renderWith([], { downloadsFeedItemLimit: 25, downloadsFeedMediaTypes: ['video', 'short'] });

      expect(Video.findAll).toHaveBeenCalledWith(expect.objectContaining({
        where: {
          removed: false,
          last_downloaded_at: { [Op.ne]: null },
          media_type: { [Op.in]: ['video', 'short'] },
        },
        order: [['last_downloaded_at', 'DESC'], ['id', 'DESC']],
        limit: 25,
        raw: true,
      }));
    });

    test('falls back to the defaults when the settings are missing', async () => {
      await renderWith([], {});

      expect(Video.findAll).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          media_type: { [Op.in]: ['video', 'short', 'livestream'] },
        }),
        limit: 50,
      }));
    });

    test('uses the origin as the feed link', async () => {
      const xml = await renderWith([]);

      expect(xml).toContain(`<link>${ORIGIN}</link>`);
    });

    test('dates the feed from its newest item, so a repeat fetch gives identical bytes', async () => {
      const newest = new Date('2026-11-06T08:00:00.000Z');
      const rows = [makeRow({ last_downloaded_at: newest }), makeRow({ youtubeId: 'olderVideo1' })];

      const first = await renderWith(rows);
      const second = await renderWith(rows);

      expect(first).toContain(`<lastBuildDate>${newest.toUTCString()}</lastBuildDate>`);
      expect(second).toBe(first);
    });

    test('has no build date while the feed is empty', async () => {
      expect(await renderWith([])).not.toContain('lastBuildDate');
    });

    test('dates each item by its download, not its upload', async () => {
      const xml = await renderWith([makeRow()]);

      expect(xml).toContain(`<pubDate>${DOWNLOADED_AT.toUTCString()}</pubDate>`);
    });

    test('identifies an item by video ID only, because the download date can be rewritten', async () => {
      const first = await renderWith([makeRow()]);
      const redownloaded = await renderWith([makeRow({ last_downloaded_at: new Date('2027-01-01T00:00:00Z') })]);
      const guid = '<guid isPermaLink="false">youtarr:video:dQw4w9WgXcQ</guid>';

      expect(first).toContain(guid);
      expect(redownloaded).toContain(guid);
    });

    test('names the channel as the item creator', async () => {
      expect(await renderWith([makeRow()])).toContain('<dc:creator>A channel</dc:creator>');
    });

    describe('item link', () => {
      test('opens YouTube when no template is set', async () => {
        const xml = await renderWith([makeRow()], { downloadsFeedLinkTemplate: '' });

        expect(xml).toContain('<link>https://www.youtube.com/watch?v=dQw4w9WgXcQ</link>');
      });

      test('follows the configured template', async () => {
        const xml = await renderWith([makeRow()], {
          downloadsFeedLinkTemplate: 'https://youtarr.example.com/videos?video={youtubeId}',
        });

        expect(xml).toContain('<link>https://youtarr.example.com/videos?video=dQw4w9WgXcQ</link>');
      });

      test('opens YouTube when a hand-edited template is invalid', async () => {
        const xml = await renderWith([makeRow()], { downloadsFeedLinkTemplate: 'not a url' });

        expect(xml).toContain('<link>https://www.youtube.com/watch?v=dQw4w9WgXcQ</link>');
      });

      test('leaves out a row whose ID cannot form a link', async () => {
        const xml = await renderWith([makeRow({ youtubeId: 'bad id!' })]);

        expect(xml).not.toContain('<item>');
      });
    });

    describe('thumbnail', () => {
      test('comes from YouTube for a video still on YouTube', async () => {
        const xml = await renderWith([makeRow()]);

        expect(xml).toContain('<media:thumbnail url="https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg"/>');
      });

      test('comes from Youtarr for a video removed from YouTube', async () => {
        const xml = await renderWith([makeRow({ youtube_removed: 1 })]);

        expect(xml).toContain(`<media:thumbnail url="${ORIGIN}/images/videothumb-dQw4w9WgXcQ.jpg"/>`);
      });
    });

    describe('item body', () => {
      // The body is HTML inside an XML text value, so it is encoded twice.
      const bodyOf = (xml) => xml.match(/<item>[\s\S]*?<description>([\s\S]*?)<\/description>/)[1];

      test('links the thumbnail to the item link', async () => {
        const body = bodyOf(await renderWith([makeRow()]));

        expect(body).toContain('&lt;a href=&quot;https://www.youtube.com/watch?v=dQw4w9WgXcQ&quot;&gt;');
        expect(body).toContain('&lt;img src=&quot;https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg&quot;');
      });

      test('shows the channel, length and upload date', async () => {
        const body = bodyOf(await renderWith([makeRow()]));

        expect(body).toContain('A channel | 12:34 | Uploaded 2026-11-03');
      });

      test('skips a length and upload date it does not have', async () => {
        const body = bodyOf(await renderWith([makeRow({ duration: null, originalDate: null })]));

        expect(body).toContain('&lt;p&gt;A channel&lt;/p&gt;');
      });

      test('turns line breaks in the description into HTML line breaks', async () => {
        const body = bodyOf(await renderWith([makeRow({ description: 'One\r\n\r\nTwo' })]));

        expect(body).toContain('One&lt;br/&gt;Two');
      });

      test('cuts a long description', async () => {
        const body = bodyOf(await renderWith([makeRow({ description: 'x'.repeat(1000) })]));

        expect(body).toContain(`${'x'.repeat(300)}...`);
        expect(body).not.toContain('x'.repeat(301));
      });

      test('leaves out an empty description', async () => {
        const body = bodyOf(await renderWith([makeRow({ description: null })]));

        expect(body).toBe(
          '&lt;p&gt;&lt;a href=&quot;https://www.youtube.com/watch?v=dQw4w9WgXcQ&quot;&gt;' +
          '&lt;img src=&quot;https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg&quot; alt=&quot;A video&quot;/&gt;' +
          '&lt;/a&gt;&lt;/p&gt;&lt;p&gt;A channel | 12:34 | Uploaded 2026-11-03&lt;/p&gt;'
        );
      });

      test('never lets a title or description add its own HTML', async () => {
        const body = bodyOf(await renderWith([makeRow({
          youTubeVideoName: '"><script>alert(1)</script>',
          description: '<img src=x onerror=alert(1)>',
        })]));

        expect(body).not.toContain('&lt;script');
        expect(body).not.toContain('&lt;img src=x');
        expect(body).toContain('&amp;lt;script&amp;gt;');
        expect(body).toContain('&amp;lt;img src=x');
      });
    });
  });
});
