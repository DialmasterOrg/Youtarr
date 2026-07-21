/* eslint-env jest */

const { Op } = require('sequelize');
const mockFactories = require('./mockFactories');

jest.mock('fs');
jest.mock('child_process');
jest.mock('../../../logger');
jest.mock('../../../models/channel', () => mockFactories.mockChannelModel());
jest.mock('../../configModule', () => mockFactories.mockConfigModule());
jest.mock('../../filesystem', () => mockFactories.mockFilesystem());
jest.mock('../../m3uGenerator', () => ({
  generateChannelM3UInBackground: jest.fn(),
  deleteChannelM3UInBackground: jest.fn(),
}));

describe('channelCatalog', () => {
  let channelCatalog;
  let Channel;
  let logger;
  let m3uGenerator;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    Channel = require('../../../models/channel');
    Channel.findOne.mockResolvedValue(null);

    logger = require('../../../logger');
    m3uGenerator = require('../../m3uGenerator');

    channelCatalog = require('../channelCatalog');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('readChannels', () => {
    test('should read channels from file and fetch from database', async () => {
      const mockChannels = [
        {
          url: 'https://youtube.com/@channel1',
          uploader: 'Channel 1',
          channel_id: 'UC111',
          enabled: true,
          auto_download_enabled_tabs: 'video,short',
          available_tabs: 'videos,shorts,livestream',
          sub_folder: null,
          video_quality: null,
        },
        {
          url: 'https://youtube.com/@channel2',
          uploader: 'Channel 2',
          channel_id: 'UC222',
          enabled: true,
          auto_download_enabled_tabs: 'video',
          available_tabs: 'videos,shorts',
          sub_folder: null,
          video_quality: null,
        }
      ];

      Channel.findAll = jest.fn().mockResolvedValue(mockChannels);

      const result = await channelCatalog.readChannels();

      expect(Channel.findAll).toHaveBeenCalledWith({
        where: { enabled: true }
      });

      expect(result).toEqual([
        {
          url: 'https://youtube.com/@channel1',
          uploader: 'Channel 1',
          channel_id: 'UC111',
          auto_download_enabled_tabs: 'video,short',
          available_tabs: 'videos,shorts,livestream',
          sub_folder: null,
          video_quality: null,
          min_duration: null,
          max_duration: null,
          title_filter_regex: null,
          audio_format: null,
          terminated_at: null,
        },
        {
          url: 'https://youtube.com/@channel2',
          uploader: 'Channel 2',
          channel_id: 'UC222',
          auto_download_enabled_tabs: 'video',
          available_tabs: 'videos,shorts',
          sub_folder: null,
          video_quality: null,
          min_duration: null,
          max_duration: null,
          title_filter_regex: null,
          audio_format: null,
          terminated_at: null,
        }
      ]);
    });

    test('should handle missing channel in database', async () => {
      Channel.findAll = jest.fn().mockResolvedValue([]);

      const result = await channelCatalog.readChannels();

      expect(result).toEqual([]);
    });

    test('should use default value for auto_download_enabled_tabs when null', async () => {
      const mockChannels = [
        {
          url: 'https://youtube.com/@channel1',
          uploader: 'Channel 1',
          channel_id: 'UC111',
          enabled: true,
          auto_download_enabled_tabs: null
        }
      ];

      Channel.findAll = jest.fn().mockResolvedValue(mockChannels);

      const result = await channelCatalog.readChannels();

      expect(result[0].auto_download_enabled_tabs).toBe('video');
    });
  });

  describe('getChannelsPaginated', () => {
    beforeEach(() => {
      Channel.findAndCountAll = jest.fn().mockResolvedValue({
        rows: [],
        count: 0
      });
      Channel.findAll = jest.fn().mockResolvedValue([]);
    });

    test('returns paginated data with defaults applied', async () => {
      const mockChannels = [
        {
          url: 'https://youtube.com/@channel1',
          uploader: 'Channel 1',
          channel_id: 'UC111',
          auto_download_enabled_tabs: 'video'
        }
      ];

      Channel.findAndCountAll.mockResolvedValueOnce({
        rows: mockChannels,
        count: 25
      });
      Channel.findAll.mockResolvedValueOnce([
        { sub_folder: null },
        { sub_folder: '_Kids' },
      ]);

      const result = await channelCatalog.getChannelsPaginated({
        page: 2,
        pageSize: 10,
        sortBy: 'name',
        sortOrder: 'desc'
      });

      expect(Channel.findAndCountAll).toHaveBeenCalledWith(expect.objectContaining({
        limit: 10,
        offset: 10,
        order: [['uploader', 'DESC']]
      }));

      expect(result).toEqual({
        channels: [
          {
            url: 'https://youtube.com/@channel1',
            uploader: 'Channel 1',
            channel_id: 'UC111',
            auto_download_enabled_tabs: 'video',
            available_tabs: null,
            sub_folder: null,
            video_quality: null,
            min_duration: null,
            max_duration: null,
            title_filter_regex: null,
            audio_format: null,
            terminated_at: null,
          }
        ],
        total: 25,
        page: 2,
        pageSize: 10,
        totalPages: 3,
        subFolders: ['__default__', '_Kids']
      });
    });

    test('applies search filtering when a term is provided', async () => {
      await channelCatalog.getChannelsPaginated({ searchTerm: 'Tech' });

      expect(Channel.findAndCountAll).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          enabled: true,
          [Op.or]: expect.any(Array)
        })
      }));
    });

    test('applies sub-folder filtering for default folder key', async () => {
      await channelCatalog.getChannelsPaginated({ subFolder: '__default__' });

      expect(Channel.findAndCountAll).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          sub_folder: expect.objectContaining({ [Op.or]: [null, ''] })
        })
      }));
    });

    test('applies sub-folder filtering for specific folder name', async () => {
      await channelCatalog.getChannelsPaginated({ subFolder: '_Kids' });

      expect(Channel.findAndCountAll).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          sub_folder: '_Kids'
        })
      }));
    });
  });

  describe('writeChannels', () => {
    test('enables only newly added and disables removed channels', async () => {
      const channelUrls = [
        'https://youtube.com/@channel1',
        'https://youtube.com/@channel2'
      ];

      Channel.findAll = jest.fn().mockResolvedValue([
        { url: 'https://youtube.com/@channel1', enabled: true },
        { url: 'https://youtube.com/@channel3', enabled: true }
      ]);

      Channel.update = jest.fn().mockResolvedValue([1]);
      const channelProvisioning = require('../channelProvisioning');
      jest.spyOn(channelProvisioning, 'getChannelInfo').mockResolvedValue({
        id: 'UC_channel2_id'
      });

      await channelCatalog.writeChannels(channelUrls);

      expect(channelProvisioning.getChannelInfo).toHaveBeenCalledTimes(1);
      expect(channelProvisioning.getChannelInfo).toHaveBeenCalledWith(
        'https://youtube.com/@channel2',
        false,
        true
      );

      expect(Channel.update).toHaveBeenCalledWith(
        { enabled: true },
        { where: { channel_id: 'UC_channel2_id' } }
      );

      expect(Channel.update).toHaveBeenCalledWith(
        { enabled: false },
        { where: { url: ['https://youtube.com/@channel3'] } }
      );
    });

    test('should handle write error gracefully', async () => {
      Channel.findAll = jest
        .fn()
        .mockResolvedValue([{ url: 'https://youtube.com/@old', enabled: true }]);

      Channel.update = jest.fn().mockRejectedValue(new Error('DB Error'));

      const channelProvisioning = require('../channelProvisioning');
      jest.spyOn(channelProvisioning, 'getChannelInfo').mockResolvedValue({ id: 'UCnew' });

      await channelCatalog.writeChannels(['https://youtube.com/@new']);

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          err: expect.any(Error)
        }),
        'Error updating channels in database'
      );
    });
  });

  describe('updateChannelsByDelta', () => {
    test('enables existing channel without fetching from YouTube', async () => {
      // Mock existing channel
      const mockChannel = {
        channel_id: 'UCexisting',
        url: 'https://youtube.com/@existingChannel',
        update: jest.fn().mockResolvedValue(true)
      };

      Channel.findOne = jest.fn().mockResolvedValue(mockChannel);
      Channel.findAll = jest.fn().mockResolvedValue([]);
      Channel.update = jest.fn().mockResolvedValue([1]);
      const channelProvisioning = require('../channelProvisioning');
      jest.spyOn(channelProvisioning, 'getChannelInfo');

      await channelCatalog.updateChannelsByDelta({
        enableUrls: ['https://youtube.com/@existingChannel'],
        disableUrls: ['https://youtube.com/@oldChannel']
      });

      // Should find channel by URL
      expect(Channel.findOne).toHaveBeenCalledWith({ where: { url: 'https://youtube.com/@existingChannel' } });

      // Should NOT call getChannelInfo since channel exists
      expect(channelProvisioning.getChannelInfo).not.toHaveBeenCalled();

      // Should update the existing channel
      expect(mockChannel.update).toHaveBeenCalledWith({ enabled: true });

      // Should disable old channel
      expect(Channel.update).toHaveBeenCalledWith(
        { enabled: false },
        { where: { url: ['https://youtube.com/@oldChannel'] } }
      );
    });

    test('enables channel by channel_id when URL not found', async () => {
      // Mock channel found by channel_id, not URL
      const mockChannel = {
        channel_id: 'UCexisting',
        url: 'https://youtube.com/@differentUrl',
        update: jest.fn().mockResolvedValue(true)
      };

      Channel.findOne = jest.fn()
        .mockResolvedValueOnce(null) // Not found by URL
        .mockResolvedValueOnce(mockChannel); // Found by channel_id
      const channelProvisioning = require('../channelProvisioning');
      jest.spyOn(channelProvisioning, 'getChannelInfo');

      await channelCatalog.updateChannelsByDelta({
        enableUrls: [{ url: 'https://youtube.com/@userInputUrl', channel_id: 'UCexisting' }]
      });

      // Should try to find by URL first
      expect(Channel.findOne).toHaveBeenCalledWith({ where: { url: 'https://youtube.com/@userInputUrl' } });

      // Should try to find by channel_id second
      expect(Channel.findOne).toHaveBeenCalledWith({ where: { channel_id: 'UCexisting' } });

      // Should NOT call getChannelInfo since channel exists
      expect(channelProvisioning.getChannelInfo).not.toHaveBeenCalled();

      // Should update the existing channel
      expect(mockChannel.update).toHaveBeenCalledWith({ enabled: true });
    });

    test('fetches from YouTube when channel not found', async () => {
      Channel.findOne = jest.fn().mockResolvedValue(null);
      Channel.update = jest.fn().mockResolvedValue([1]);
      const channelProvisioning = require('../channelProvisioning');
      jest.spyOn(channelProvisioning, 'getChannelInfo').mockResolvedValue({
        id: 'UCnew'
      });

      await channelCatalog.updateChannelsByDelta({
        enableUrls: ['https://youtube.com/@newChannel']
      });

      // Should try to find channel
      expect(Channel.findOne).toHaveBeenCalledWith({ where: { url: 'https://youtube.com/@newChannel' } });

      // Should call getChannelInfo as fallback
      expect(channelProvisioning.getChannelInfo).toHaveBeenCalledWith(
        'https://youtube.com/@newChannel',
        false,
        true
      );

      // Should update with the fetched channel_id
      expect(Channel.update).toHaveBeenCalledWith(
        { enabled: true },
        { where: { channel_id: 'UCnew' } }
      );
    });

    test('propagates errors from getChannelInfo', async () => {
      Channel.findOne = jest.fn().mockResolvedValue(null); // Channel not found
      Channel.update = jest.fn();
      const channelProvisioning = require('../channelProvisioning');
      jest.spyOn(channelProvisioning, 'getChannelInfo').mockRejectedValueOnce(new Error('Failed'));

      await expect(
        channelCatalog.updateChannelsByDelta({ enableUrls: ['https://youtube.com/@new'] })
      ).rejects.toThrow('Failed');
    });
  });

  describe('channel m3u hooks', () => {
    describe('writeChannels', () => {
      test('regenerates m3u for newly enabled channels', async () => {
        Channel.findAll = jest.fn().mockResolvedValue([
          { url: 'https://youtube.com/@channel1', enabled: true }
        ]);
        Channel.update = jest.fn().mockResolvedValue([1]);
        const channelProvisioning = require('../channelProvisioning');
        jest.spyOn(channelProvisioning, 'getChannelInfo').mockResolvedValue({
          id: 'UCnew'
        });

        await channelCatalog.writeChannels([
          'https://youtube.com/@channel1',
          'https://youtube.com/@new'
        ]);

        expect(m3uGenerator.generateChannelM3UInBackground).toHaveBeenCalledWith('UCnew', expect.any(String));
      });

      test('deletes m3u files for channels being disabled with m3u enabled', async () => {
        Channel.findAll = jest
          .fn()
          .mockResolvedValueOnce([
            { url: 'https://youtube.com/@old', enabled: true, channel_id: 'UCold' }
          ]) // existing channels lookup
          .mockResolvedValueOnce([{ channel_id: 'UCold' }]); // disabling lookup (m3u_enabled channels)
        Channel.update = jest.fn().mockResolvedValue([1]);

        await channelCatalog.writeChannels([]);

        expect(Channel.findAll).toHaveBeenNthCalledWith(2, {
          where: { url: ['https://youtube.com/@old'], m3u_enabled: true },
          attributes: ['channel_id'],
        });
        expect(m3uGenerator.deleteChannelM3UInBackground).toHaveBeenCalledWith('UCold', expect.any(String));
      });
    });

    describe('updateChannelsByDelta', () => {
      test('regenerates m3u when falling back to a fresh YouTube fetch on enable', async () => {
        Channel.findOne = jest.fn().mockResolvedValue(null);
        Channel.update = jest.fn().mockResolvedValue([1]);
        const channelProvisioning = require('../channelProvisioning');
        jest.spyOn(channelProvisioning, 'getChannelInfo').mockResolvedValue({
          id: 'UCfallback'
        });

        await channelCatalog.updateChannelsByDelta({
          enableUrls: ['https://youtube.com/@fallback']
        });

        expect(m3uGenerator.generateChannelM3UInBackground).toHaveBeenCalledWith('UCfallback', expect.any(String));
      });

      test('regenerates m3u for re-enabled channel found in the database', async () => {
        const found = { channel_id: 'UC1', update: jest.fn().mockResolvedValue({}) };
        Channel.findOne = jest.fn().mockResolvedValue(found);

        await channelCatalog.updateChannelsByDelta({
          enableUrls: ['https://youtube.com/@chan']
        });

        expect(m3uGenerator.generateChannelM3UInBackground).toHaveBeenCalledWith('UC1', expect.any(String));
      });

      test('deletes m3u files for channels being disabled with m3u enabled', async () => {
        Channel.findAll = jest.fn().mockResolvedValue([{ channel_id: 'UCdisabled' }]);
        Channel.update = jest.fn().mockResolvedValue([1]);

        await channelCatalog.updateChannelsByDelta({
          disableUrls: ['https://youtube.com/@toDisable']
        });

        expect(Channel.findAll).toHaveBeenCalledWith({
          where: { url: ['https://youtube.com/@toDisable'], m3u_enabled: true },
          attributes: ['channel_id'],
        });
        expect(m3uGenerator.deleteChannelM3UInBackground).toHaveBeenCalledWith('UCdisabled', expect.any(String));
      });

      test('does not delete m3u for disabled channels without m3u enabled', async () => {
        Channel.findAll = jest.fn().mockResolvedValue([]);
        Channel.update = jest.fn().mockResolvedValue([1]);

        await channelCatalog.updateChannelsByDelta({
          disableUrls: ['https://youtube.com/@toDisable']
        });

        expect(m3uGenerator.deleteChannelM3UInBackground).not.toHaveBeenCalled();
      });
    });
  });
});
