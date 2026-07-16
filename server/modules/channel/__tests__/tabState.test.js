/* eslint-env jest */

// Required once, into a `mock`-prefixed const; see mockFactories.js for the rules.
const mockFactories = require('./mockFactories');

jest.mock('../../../logger');
jest.mock('../../../models/channel', () => mockFactories.mockChannelModel());
jest.mock('../../../db', () => mockFactories.mockDb());

describe('tabState', () => {
  let tabState;
  let logger;

  const mockChannelData = {
    channel_id: 'UC123456',
    title: 'Test Channel',
    description: 'Test Description',
    uploader: 'Test Uploader',
    url: 'https://www.youtube.com/@testchannel',
    lastFetchedByTab: JSON.stringify({ video: new Date('2024-01-01').toISOString() })
  };

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    logger = require('../../../logger');

    tabState = require('../tabState');
  });

  describe('getLastFetchedForTab', () => {
    test('should return last fetched timestamp for a specific tab', () => {
      const channel = {
        ...mockChannelData,
        lastFetchedByTab: JSON.stringify({
          video: '2024-01-01T00:00:00.000Z',
          short: '2024-01-02T00:00:00.000Z'
        })
      };

      const result = tabState.getLastFetchedForTab(channel, 'video');
      expect(result).toEqual(new Date('2024-01-01T00:00:00.000Z'));
    });

    test('should return null when tab has never been fetched', () => {
      const channel = {
        ...mockChannelData,
        lastFetchedByTab: JSON.stringify({
          video: '2024-01-01T00:00:00.000Z'
        })
      };

      const result = tabState.getLastFetchedForTab(channel, 'short');
      expect(result).toBeNull();
    });

    test('should return null when channel has no lastFetchedByTab', () => {
      const channel = {
        ...mockChannelData,
        lastFetchedByTab: null
      };

      const result = tabState.getLastFetchedForTab(channel, 'video');
      expect(result).toBeNull();
    });

    test('should return null when channel is null', () => {
      const result = tabState.getLastFetchedForTab(null, 'video');
      expect(result).toBeNull();
    });

    test('should handle invalid JSON gracefully', () => {
      const channel = {
        ...mockChannelData,
        lastFetchedByTab: 'invalid json'
      };

      const result = tabState.getLastFetchedForTab(channel, 'video');
      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          err: expect.any(Error),
          channelId: mockChannelData.channel_id,
          mediaType: 'video'
        }),
        'Error parsing lastFetchedByTab'
      );
    });
  });

  describe('setLastFetchedForTab', () => {
    test('should update last fetched timestamp for a specific tab', async () => {
      const { sequelize } = require('../../../db');
      const mockChannel = {
        ...mockChannelData,
        channel_id: 'UC123',
        reload: jest.fn()
      };
      const timestamp = new Date('2024-01-15T12:00:00.000Z');

      sequelize.query.mockResolvedValue([]);

      await tabState.setLastFetchedForTab(mockChannel, 'video', timestamp);

      expect(sequelize.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE channels'),
        {
          replacements: {
            jsonPath: '$.video',
            timestamp: '2024-01-15T12:00:00.000Z',
            channelId: 'UC123'
          }
        }
      );
      expect(mockChannel.reload).toHaveBeenCalled();
    });

    test('should handle null channel gracefully', async () => {
      const { sequelize } = require('../../../db');
      const timestamp = new Date();

      await tabState.setLastFetchedForTab(null, 'video', timestamp);

      expect(sequelize.query).not.toHaveBeenCalled();
    });

    test('should handle channel without channel_id', async () => {
      const { sequelize } = require('../../../db');
      const mockChannel = {
        ...mockChannelData,
        channel_id: null,
        reload: jest.fn()
      };
      const timestamp = new Date();

      await tabState.setLastFetchedForTab(mockChannel, 'video', timestamp);

      expect(sequelize.query).not.toHaveBeenCalled();
    });

    test('should use atomic JSON_SET for concurrent updates', async () => {
      const { sequelize } = require('../../../db');
      const mockChannel = {
        ...mockChannelData,
        channel_id: 'UC123',
        reload: jest.fn()
      };
      const timestamp = new Date('2024-01-15T12:00:00.000Z');

      sequelize.query.mockResolvedValue([]);

      await tabState.setLastFetchedForTab(mockChannel, 'short', timestamp);

      // Verify it uses JSON_SET with COALESCE to handle NULL
      const sqlQuery = sequelize.query.mock.calls[0][0];
      expect(sqlQuery).toContain('JSON_SET');
      expect(sqlQuery).toContain('COALESCE(lastFetchedByTab, \'{}\')');
      expect(sequelize.query).toHaveBeenCalledWith(
        expect.any(String),
        {
          replacements: {
            jsonPath: '$.short',
            timestamp: '2024-01-15T12:00:00.000Z',
            channelId: 'UC123'
          }
        }
      );
    });
  });

  describe('computeEffectiveTabs', () => {
    test('returns detected tabs when nothing hidden', () => {
      const result = tabState.computeEffectiveTabs('videos,shorts,streams', null);
      expect(result).toEqual(['videos', 'shorts', 'streams']);
    });

    test('filters out hidden tabs', () => {
      const result = tabState.computeEffectiveTabs('videos,shorts,streams', 'shorts');
      expect(result).toEqual(['videos', 'streams']);
    });

    test('filters multiple hidden tabs', () => {
      const result = tabState.computeEffectiveTabs('videos,shorts,streams', 'shorts,streams');
      expect(result).toEqual(['videos']);
    });

    test('returns empty array when all detected are hidden', () => {
      const result = tabState.computeEffectiveTabs('videos,shorts', 'videos,shorts');
      expect(result).toEqual([]);
    });

    test('returns empty array when available_tabs is null', () => {
      const result = tabState.computeEffectiveTabs(null, null);
      expect(result).toEqual([]);
    });

    test('ignores hidden entries that are not in detected set', () => {
      const result = tabState.computeEffectiveTabs('videos', 'shorts,streams');
      expect(result).toEqual(['videos']);
    });

    test('trims whitespace in both lists', () => {
      const result = tabState.computeEffectiveTabs(' videos , shorts ', ' shorts ');
      expect(result).toEqual(['videos']);
    });
  });
});
