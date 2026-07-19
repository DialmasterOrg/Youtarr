/* eslint-env jest */

// Required once, into a `mock`-prefixed const; see mockFactories.js for the rules.
const mockFactories = require('./mockFactories');

jest.mock('../../../logger');
jest.mock('../../../models/channel', () => mockFactories.mockChannelModel());

describe('channelIdentity', () => {
  let channelIdentity;
  let Channel;

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

    Channel = require('../../../models/channel');
    Channel.findOne.mockResolvedValue(null);

    channelIdentity = require('../channelIdentity');
  });

  describe('resolveChannelUrlFromId', () => {
    test('builds canonical URL from UC channel id', () => {
      const url = channelIdentity.resolveChannelUrlFromId('UCabc123');
      expect(url).toBe('https://www.youtube.com/channel/UCabc123');
    });

    test('converts UU uploads id to UC channel URL', () => {
      const url = channelIdentity.resolveChannelUrlFromId('UUabc123');
      expect(url).toBe('https://www.youtube.com/channel/UCabc123');
    });
  });

  describe('findChannelByUrlOrId', () => {
    test('should find channel by URL and return canonical URL', async () => {
      const mockChannel = { ...mockChannelData, channel_id: 'UC123456' };
      Channel.findOne.mockResolvedValue(mockChannel);

      const result = await channelIdentity.findChannelByUrlOrId('https://www.youtube.com/@test');

      expect(Channel.findOne).toHaveBeenCalledWith({
        where: { url: 'https://www.youtube.com/@test' }
      });
      expect(result.foundChannel).toBe(mockChannel);
      expect(result.channelId).toBe('UC123456');
      expect(result.channelUrl).toBe('https://www.youtube.com/channel/UC123456');
    });

    test('should find channel by ID', async () => {
      const mockChannel = { ...mockChannelData };
      Channel.findOne.mockResolvedValue(mockChannel);

      const result = await channelIdentity.findChannelByUrlOrId('UC123456');

      expect(Channel.findOne).toHaveBeenCalledWith({
        where: { channel_id: 'UC123456' }
      });
      expect(result.foundChannel).toBe(mockChannel);
      expect(result.channelId).toBe('UC123456');
      expect(result.channelUrl).toBe('https://www.youtube.com/channel/UC123456');
    });

    test('should return null when channel not found', async () => {
      Channel.findOne.mockResolvedValue(null);

      const result = await channelIdentity.findChannelByUrlOrId('UC999999');

      expect(result.foundChannel).toBeNull();
      expect(result.channelUrl).toBe('https://www.youtube.com/channel/UC999999');
    });

    test('should normalize UU uploads id to UC channel URL when not found in DB', async () => {
      Channel.findOne.mockResolvedValue(null);

      const result = await channelIdentity.findChannelByUrlOrId('UUxyz789');

      expect(result.foundChannel).toBeNull();
      expect(result.channelId).toBe('UUxyz789');
      expect(result.channelUrl).toBe('https://www.youtube.com/channel/UCxyz789');
    });

    test('should return original URL when channel not found by URL', async () => {
      Channel.findOne.mockResolvedValue(null);

      const result = await channelIdentity.findChannelByUrlOrId('https://www.youtube.com/@nonexistent');

      expect(result.foundChannel).toBeNull();
      expect(result.channelUrl).toBe('https://www.youtube.com/@nonexistent');
      expect(result.channelId).toBe('');
    });
  });
});
