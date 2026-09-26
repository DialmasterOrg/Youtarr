/* eslint-env jest */

// Required once, into a `mock`-prefixed const; see mockFactories.js for the rules.
const mockFactories = require('./mockFactories');

jest.mock('../../../logger');
jest.mock('../../../models/channel', () => mockFactories.mockChannelModel());
jest.mock('../../../db', () => mockFactories.mockDb());
jest.mock('../tabVideoCounts', () => ({
  getStoredCounts: jest.fn((channel) => (channel.tab_video_counts ? JSON.parse(channel.tab_video_counts) : {})),
  countableTabs: jest.fn((channel) => (channel.terminated_at ? [] : channel.available_tabs.split(','))),
  refreshChannel: jest.fn().mockResolvedValue({ status: 'fresh' }),
}));

const CHANNEL_ID = 'UCHnyfMqiRRG1u-2MsSQLbXA';
const FETCHED_AT = '2026-09-25T04:45:00.000Z';

const makeChannel = (overrides = {}) => ({
  channel_id: CHANNEL_ID,
  available_tabs: 'videos,shorts',
  hidden_tabs: null,
  terminated_at: null,
  tab_video_counts: JSON.stringify({ video: { total: 449, fetchedAt: FETCHED_AT }, short: { total: 87, fetchedAt: FETCHED_AT } }),
  ...overrides,
});

describe('tabDownloadStats', () => {
  let tabDownloadStats;
  let sequelize;
  let Channel;
  let tabVideoCounts;

  const mockRows = ({ downloaded = [], listing = [] }) => {
    sequelize.query.mockImplementation((sql) => Promise.resolve(sql.includes('UNION ALL') ? downloaded : listing));
  };

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    ({ sequelize } = require('../../../db'));
    Channel = require('../../../models/channel');
    tabVideoCounts = require('../tabVideoCounts');
    tabDownloadStats = require('../tabDownloadStats');
  });

  describe('percentOf', () => {
    test('rounds down so a tab is not shown complete early', () => {
      expect(tabDownloadStats.percentOf(448, 449)).toBe(99);
    });

    test('caps at 100 when more downloads are counted than YouTube lists', () => {
      expect(tabDownloadStats.percentOf(452, 449)).toBe(100);
    });

    test('has no percent without a total', () => {
      expect(tabDownloadStats.percentOf(3, null)).toBeNull();
    });

    test('has no percent for an empty tab', () => {
      expect(tabDownloadStats.percentOf(0, 0)).toBeNull();
    });
  });

  describe('getForChannels', () => {
    test('combines stored totals with downloaded and ignored counts', async () => {
      mockRows({
        downloaded: [{ channel_id: CHANNEL_ID, media_type: 'video', downloaded: 120 }],
        listing: [{ channel_id: CHANNEL_ID, media_type: 'video', loaded: 300, ignored: 3 }],
      });

      const stats = await tabDownloadStats.getForChannels([makeChannel()]);

      expect(stats.get(CHANNEL_ID).videos).toEqual({ total: 449, fetchedAt: FETCHED_AT, downloaded: 120, ignored: 3, percent: 26 });
    });

    test('includes the loaded count when asked', async () => {
      mockRows({ listing: [{ channel_id: CHANNEL_ID, media_type: 'short', loaded: '50', ignored: '0' }] });

      const stats = await tabDownloadStats.getForChannels([makeChannel()], { includeLoaded: true });

      expect(stats.get(CHANNEL_ID).shorts.loaded).toBe(50);
    });

    test('skips the loaded-row count for the channel list', async () => {
      mockRows({});

      await tabDownloadStats.getForChannels([makeChannel()]);

      const sqls = sequelize.query.mock.calls.map(([sql]) => sql);
      expect(sqls.some((sql) => sql.includes('AS loaded'))).toBe(false);
    });

    test('leaves out hidden tabs', async () => {
      mockRows({});

      const stats = await tabDownloadStats.getForChannels([makeChannel({ hidden_tabs: 'shorts' })]);

      expect(Object.keys(stats.get(CHANNEL_ID))).toEqual(['videos']);
    });

    test('reports no total for a channel it cannot count', async () => {
      mockRows({});

      const stats = await tabDownloadStats.getForChannels([makeChannel({ terminated_at: new Date() })]);

      expect([stats.get(CHANNEL_ID).videos.total, stats.get(CHANNEL_ID).videos.percent]).toEqual([null, null]);
    });

    test('does not query for an empty channel list', async () => {
      await tabDownloadStats.getForChannels([]);

      expect(sequelize.query).not.toHaveBeenCalled();
    });

    test('binds channel ids as replacements', async () => {
      mockRows({});

      await tabDownloadStats.getForChannels([makeChannel()]);

      expect(sequelize.query.mock.calls[0][1].replacements.channelIds).toEqual([CHANNEL_ID]);
    });
  });

  describe('getChannelTabStats', () => {
    test('refreshes stale counts before reading', async () => {
      Channel.findOne.mockResolvedValue(makeChannel());
      mockRows({});

      await tabDownloadStats.getChannelTabStats(CHANNEL_ID);

      expect(tabVideoCounts.refreshChannel).toHaveBeenCalledWith(CHANNEL_ID, { onlyIfStale: true });
    });

    test('still returns stored counts when the refresh throws', async () => {
      tabVideoCounts.refreshChannel.mockRejectedValueOnce(new Error('boom'));
      Channel.findOne.mockResolvedValue(makeChannel());
      mockRows({});

      const result = await tabDownloadStats.getChannelTabStats(CHANNEL_ID);

      expect(result.tabs.videos.total).toBe(449);
    });

    test('returns null for an unknown channel', async () => {
      Channel.findOne.mockResolvedValue(null);

      expect(await tabDownloadStats.getChannelTabStats(CHANNEL_ID)).toBeNull();
    });
  });
});
