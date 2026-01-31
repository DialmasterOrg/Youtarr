/* eslint-env jest */

// Mock dependencies before requiring the module under test
jest.mock('../../models/channel', () => {
  const { Model } = require('sequelize');
  class MockChannel extends Model {}
  MockChannel.findAll = jest.fn();
  MockChannel.init = jest.fn(() => MockChannel);
  return MockChannel;
});

jest.mock('../configModule', () => ({
  directoryPath: '/mock/youtube/output',
  config: {
    preferredResolution: '1080'
  },
  getDefaultSubfolder: jest.fn().mockReturnValue(null)
}));

const channelDownloadGrouper = require('../channelDownloadGrouper');
const Channel = require('../../models/channel');
const configModule = require('../configModule');
const path = require('path');

describe('ChannelDownloadGrouper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('ChannelFilterConfig', () => {
    const { ChannelFilterConfig } = channelDownloadGrouper;

    describe('constructor', () => {
      it('should create instance with all parameters', () => {
        const filterConfig = new ChannelFilterConfig(300, 3600, 'test.*regex');

        expect(filterConfig.minDuration).toBe(300);
        expect(filterConfig.maxDuration).toBe(3600);
        expect(filterConfig.titleFilterRegex).toBe('test.*regex');
      });

      it('should create instance with null parameters', () => {
        const filterConfig = new ChannelFilterConfig(null, null, null);

        expect(filterConfig.minDuration).toBeNull();
        expect(filterConfig.maxDuration).toBeNull();
        expect(filterConfig.titleFilterRegex).toBeNull();
      });

      it('should create instance with default parameters', () => {
        const filterConfig = new ChannelFilterConfig();

        expect(filterConfig.minDuration).toBeNull();
        expect(filterConfig.maxDuration).toBeNull();
        expect(filterConfig.titleFilterRegex).toBeNull();
      });
    });

    describe('buildFilterKey', () => {
      it('should build unique key with all filters', () => {
        const filterConfig = new ChannelFilterConfig(300, 3600, 'test.*regex');
        const key = filterConfig.buildFilterKey();

        expect(key).toBe('{"min":300,"max":3600,"regex":"test.*regex","audio":null}');
      });

      it('should build unique key with null values', () => {
        const filterConfig = new ChannelFilterConfig(null, null, null);
        const key = filterConfig.buildFilterKey();

        expect(key).toBe('{"min":null,"max":null,"regex":null,"audio":null}');
      });

      it('should build different keys for different filters', () => {
        const filter1 = new ChannelFilterConfig(300, null, null);
        const filter2 = new ChannelFilterConfig(null, 3600, null);

        expect(filter1.buildFilterKey()).not.toBe(filter2.buildFilterKey());
      });

      it('should build same key for identical filters', () => {
        const filter1 = new ChannelFilterConfig(300, 3600, 'regex');
        const filter2 = new ChannelFilterConfig(300, 3600, 'regex');

        expect(filter1.buildFilterKey()).toBe(filter2.buildFilterKey());
      });
    });

    describe('hasFilters', () => {
      it('should return true when minDuration is set', () => {
        const filterConfig = new ChannelFilterConfig(300, null, null);
        expect(filterConfig.hasFilters()).toBe(true);
      });

      it('should return true when maxDuration is set', () => {
        const filterConfig = new ChannelFilterConfig(null, 3600, null);
        expect(filterConfig.hasFilters()).toBe(true);
      });

      it('should return true when titleFilterRegex is set', () => {
        const filterConfig = new ChannelFilterConfig(null, null, 'test');
        expect(filterConfig.hasFilters()).toBe(true);
      });

      it('should return true when all filters are set', () => {
        const filterConfig = new ChannelFilterConfig(300, 3600, 'test');
        expect(filterConfig.hasFilters()).toBe(true);
      });

      it('should return false when no filters are set', () => {
        const filterConfig = new ChannelFilterConfig(null, null, null);
        expect(filterConfig.hasFilters()).toBe(false);
      });

      it('should return false for default constructor', () => {
        const filterConfig = new ChannelFilterConfig();
        expect(filterConfig.hasFilters()).toBe(false);
      });
    });

    describe('fromChannel', () => {
      it('should create filter config from channel record', () => {
        const channel = {
          min_duration: 300,
          max_duration: 3600,
          title_filter_regex: 'test.*regex'
        };

        const filterConfig = ChannelFilterConfig.fromChannel(channel);

        expect(filterConfig.minDuration).toBe(300);
        expect(filterConfig.maxDuration).toBe(3600);
        expect(filterConfig.titleFilterRegex).toBe('test.*regex');
      });

      it('should handle channel with null filters', () => {
        const channel = {
          min_duration: null,
          max_duration: null,
          title_filter_regex: null
        };

        const filterConfig = ChannelFilterConfig.fromChannel(channel);

        expect(filterConfig.minDuration).toBeNull();
        expect(filterConfig.maxDuration).toBeNull();
        expect(filterConfig.titleFilterRegex).toBeNull();
      });

      it('should handle partial filters', () => {
        const channel = {
          min_duration: 300,
          max_duration: null,
          title_filter_regex: null
        };

        const filterConfig = ChannelFilterConfig.fromChannel(channel);

        expect(filterConfig.minDuration).toBe(300);
        expect(filterConfig.maxDuration).toBeNull();
        expect(filterConfig.titleFilterRegex).toBeNull();
      });
    });
  });

  describe('getEnabledChannelsWithSettings', () => {
    it('should fetch enabled channels with correct attributes', async () => {
      const mockChannels = [
        {
          channel_id: 'channel1',
          uploader: 'Uploader 1',
          sub_folder: null,
          video_quality: '1080',
          auto_download_enabled_tabs: 'all',
          min_duration: null,
          max_duration: null,
          title_filter_regex: null,
          audio_format: null
        }
      ];

      Channel.findAll.mockResolvedValue(mockChannels);

      const result = await channelDownloadGrouper.getEnabledChannelsWithSettings();

      expect(Channel.findAll).toHaveBeenCalledWith({
        where: { enabled: true },
        attributes: [
          'channel_id',
          'uploader',
          'sub_folder',
          'video_quality',
          'auto_download_enabled_tabs',
          'min_duration',
          'max_duration',
          'title_filter_regex',
          'audio_format'
        ]
      });
      expect(result).toEqual(mockChannels);
    });

    it('should return empty array when no enabled channels exist', async () => {
      Channel.findAll.mockResolvedValue([]);

      const result = await channelDownloadGrouper.getEnabledChannelsWithSettings();

      expect(result).toEqual([]);
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      Channel.findAll.mockRejectedValue(error);

      await expect(
        channelDownloadGrouper.getEnabledChannelsWithSettings()
      ).rejects.toThrow('Database error');
    });
  });

  describe('groupChannels', () => {
    it('should group channels by quality only when no other differences', () => {
      const channels = [
        {
          channel_id: 'channel1',
          video_quality: '1080',
          sub_folder: null,
          min_duration: null,
          max_duration: null,
          title_filter_regex: null
        },
        {
          channel_id: 'channel2',
          video_quality: '1080',
          sub_folder: null,
          min_duration: null,
          max_duration: null,
          title_filter_regex: null
        }
      ];

      const groups = channelDownloadGrouper.groupChannels(channels, '1080');

      expect(groups).toHaveLength(1);
      expect(groups[0].quality).toBe('1080');
      expect(groups[0].subFolder).toBeNull();
      expect(groups[0].channels).toHaveLength(2);
    });

    it('should group channels separately when quality differs', () => {
      const channels = [
        {
          channel_id: 'channel1',
          video_quality: '1080',
          sub_folder: null,
          min_duration: null,
          max_duration: null,
          title_filter_regex: null
        },
        {
          channel_id: 'channel2',
          video_quality: '720',
          sub_folder: null,
          min_duration: null,
          max_duration: null,
          title_filter_regex: null
        }
      ];

      const groups = channelDownloadGrouper.groupChannels(channels, '1080');

      expect(groups).toHaveLength(2);
      expect(groups[0].quality).toBe('1080');
      expect(groups[0].channels).toHaveLength(1);
      expect(groups[1].quality).toBe('720');
      expect(groups[1].channels).toHaveLength(1);
    });

    it('should use global quality when channel quality is null', () => {
      const channels = [
        {
          channel_id: 'channel1',
          video_quality: null,
          sub_folder: null,
          min_duration: null,
          max_duration: null,
          title_filter_regex: null
        }
      ];

      const groups = channelDownloadGrouper.groupChannels(channels, '720');

      expect(groups).toHaveLength(1);
      expect(groups[0].quality).toBe('720');
    });

    it('should use channel quality over global quality', () => {
      const channels = [
        {
          channel_id: 'channel1',
          video_quality: '480',
          sub_folder: null,
          min_duration: null,
          max_duration: null,
          title_filter_regex: null
        }
      ];

      const groups = channelDownloadGrouper.groupChannels(channels, '1080');

      expect(groups).toHaveLength(1);
      expect(groups[0].quality).toBe('480');
    });

    it('should group channels separately when subfolder differs', () => {
      const channels = [
        {
          channel_id: 'channel1',
          video_quality: '1080',
          sub_folder: 'Category1',
          min_duration: null,
          max_duration: null,
          title_filter_regex: null
        },
        {
          channel_id: 'channel2',
          video_quality: '1080',
          sub_folder: 'Category2',
          min_duration: null,
          max_duration: null,
          title_filter_regex: null
        }
      ];

      const groups = channelDownloadGrouper.groupChannels(channels, '1080');

      expect(groups).toHaveLength(2);
      expect(groups[0].subFolder).toBe('Category1');
      expect(groups[1].subFolder).toBe('Category2');
    });

    it('should trim subfolder whitespace', () => {
      const channels = [
        {
          channel_id: 'channel1',
          video_quality: '1080',
          sub_folder: '  Category1  ',
          min_duration: null,
          max_duration: null,
          title_filter_regex: null
        },
        {
          channel_id: 'channel2',
          video_quality: '1080',
          sub_folder: 'Category1',
          min_duration: null,
          max_duration: null,
          title_filter_regex: null
        }
      ];

      const groups = channelDownloadGrouper.groupChannels(channels, '1080');

      expect(groups).toHaveLength(1);
      expect(groups[0].subFolder).toBe('Category1');
      expect(groups[0].channels).toHaveLength(2);
    });

    it('should treat null and empty subfolder as same (root)', () => {
      const channels = [
        {
          channel_id: 'channel1',
          video_quality: '1080',
          sub_folder: null,
          min_duration: null,
          max_duration: null,
          title_filter_regex: null
        },
        {
          channel_id: 'channel2',
          video_quality: '1080',
          sub_folder: '',
          min_duration: null,
          max_duration: null,
          title_filter_regex: null
        }
      ];

      const groups = channelDownloadGrouper.groupChannels(channels, '1080');

      expect(groups).toHaveLength(1);
      expect(groups[0].subFolder).toBeNull();
      expect(groups[0].channels).toHaveLength(2);
    });

    it('should group channels separately when filters differ', () => {
      const channels = [
        {
          channel_id: 'channel1',
          video_quality: '1080',
          sub_folder: null,
          min_duration: 300,
          max_duration: null,
          title_filter_regex: null
        },
        {
          channel_id: 'channel2',
          video_quality: '1080',
          sub_folder: null,
          min_duration: null,
          max_duration: null,
          title_filter_regex: null
        }
      ];

      const groups = channelDownloadGrouper.groupChannels(channels, '1080');

      expect(groups).toHaveLength(2);
      expect(groups[0].filterConfig.minDuration).toBe(300);
      expect(groups[1].filterConfig.minDuration).toBeNull();
    });

    it('should group channels together when all settings match', () => {
      const channels = [
        {
          channel_id: 'channel1',
          video_quality: '1080',
          sub_folder: 'Tech',
          min_duration: 300,
          max_duration: 3600,
          title_filter_regex: 'test'
        },
        {
          channel_id: 'channel2',
          video_quality: '1080',
          sub_folder: 'Tech',
          min_duration: 300,
          max_duration: 3600,
          title_filter_regex: 'test'
        }
      ];

      const groups = channelDownloadGrouper.groupChannels(channels, '1080');

      expect(groups).toHaveLength(1);
      expect(groups[0].channels).toHaveLength(2);
      expect(groups[0].quality).toBe('1080');
      expect(groups[0].subFolder).toBe('Tech');
      expect(groups[0].filterConfig.minDuration).toBe(300);
      expect(groups[0].filterConfig.maxDuration).toBe(3600);
      expect(groups[0].filterConfig.titleFilterRegex).toBe('test');
    });

    it('should handle empty channels array', () => {
      const groups = channelDownloadGrouper.groupChannels([], '1080');

      expect(groups).toHaveLength(0);
    });

    it('should default to 1080 when no global quality provided', () => {
      const channels = [
        {
          channel_id: 'channel1',
          video_quality: null,
          sub_folder: null,
          min_duration: null,
          max_duration: null,
          title_filter_regex: null
        }
      ];

      const groups = channelDownloadGrouper.groupChannels(channels, null);

      expect(groups).toHaveLength(1);
      expect(groups[0].quality).toBe('1080');
    });
  });

  describe('groupChannelsBySubfolderOnly', () => {
    it('should group channels by subfolder only', () => {
      const channels = [
        {
          channel_id: 'channel1',
          video_quality: '1080',
          sub_folder: 'Tech',
          min_duration: null,
          max_duration: null,
          title_filter_regex: null
        },
        {
          channel_id: 'channel2',
          video_quality: '720',
          sub_folder: 'Tech',
          min_duration: null,
          max_duration: null,
          title_filter_regex: null
        }
      ];

      const groups = channelDownloadGrouper.groupChannelsBySubfolderOnly(channels);

      expect(groups).toHaveLength(1);
      expect(groups[0].subFolder).toBe('Tech');
      expect(groups[0].channels).toHaveLength(2);
    });

    it('should still respect filter differences', () => {
      const channels = [
        {
          channel_id: 'channel1',
          video_quality: '1080',
          sub_folder: 'Tech',
          min_duration: 300,
          max_duration: null,
          title_filter_regex: null
        },
        {
          channel_id: 'channel2',
          video_quality: '720',
          sub_folder: 'Tech',
          min_duration: null,
          max_duration: null,
          title_filter_regex: null
        }
      ];

      const groups = channelDownloadGrouper.groupChannelsBySubfolderOnly(channels);

      expect(groups).toHaveLength(2);
    });

    it('should group channels with same subfolder and filters regardless of quality', () => {
      const channels = [
        {
          channel_id: 'channel1',
          video_quality: '1080',
          sub_folder: 'Tech',
          min_duration: 300,
          max_duration: 3600,
          title_filter_regex: 'test'
        },
        {
          channel_id: 'channel2',
          video_quality: '720',
          sub_folder: 'Tech',
          min_duration: 300,
          max_duration: 3600,
          title_filter_regex: 'test'
        }
      ];

      const groups = channelDownloadGrouper.groupChannelsBySubfolderOnly(channels);

      expect(groups).toHaveLength(1);
      expect(groups[0].channels).toHaveLength(2);
    });

    it('should handle null subfolder', () => {
      const channels = [
        {
          channel_id: 'channel1',
          video_quality: '1080',
          sub_folder: null,
          min_duration: null,
          max_duration: null,
          title_filter_regex: null
        }
      ];

      const groups = channelDownloadGrouper.groupChannelsBySubfolderOnly(channels);

      expect(groups).toHaveLength(1);
      expect(groups[0].subFolder).toBeNull();
    });
  });

  describe('buildOutputPathTemplate', () => {
    it('should build root level path when subfolder is null', () => {
      const template = channelDownloadGrouper.buildOutputPathTemplate(null);

      // Template uses .NB for byte-based truncation to avoid path length issues with UTF-8
      const expectedPath = path.join(
        '/mock/youtube/output',
        '%(uploader,channel,uploader_id).80B',
        '%(uploader,channel,uploader_id).80B - %(title).76B - %(id)s',
        '%(uploader,channel,uploader_id).80B - %(title).76B [%(id)s].%(ext)s'
      );

      expect(template).toBe(expectedPath);
    });

    it('should build subfolder path with __ prefix', () => {
      const template = channelDownloadGrouper.buildOutputPathTemplate('Tech');

      // Template uses .NB for byte-based truncation to avoid path length issues with UTF-8
      const expectedPath = path.join(
        '/mock/youtube/output',
        '__Tech',
        '%(uploader,channel,uploader_id).80B',
        '%(uploader,channel,uploader_id).80B - %(title).76B - %(id)s',
        '%(uploader,channel,uploader_id).80B - %(title).76B [%(id)s].%(ext)s'
      );

      expect(template).toBe(expectedPath);
    });

    it('should handle subfolder with special characters', () => {
      const template = channelDownloadGrouper.buildOutputPathTemplate('My Folder');

      expect(template).toContain('__My Folder');
    });

    it('should use configModule.directoryPath', () => {
      const template = channelDownloadGrouper.buildOutputPathTemplate(null);

      expect(template).toContain('/mock/youtube/output');
    });
  });

  describe('buildThumbnailPathTemplate', () => {
    it('should build root level thumbnail path when subfolder is null', () => {
      const template = channelDownloadGrouper.buildThumbnailPathTemplate(null);

      // Template uses .NB for byte-based truncation to avoid path length issues with UTF-8
      const expectedPath = path.join(
        '/mock/youtube/output',
        '%(uploader,channel,uploader_id).80B',
        '%(uploader,channel,uploader_id).80B - %(title).76B - %(id)s',
        'poster'
      );

      expect(template).toBe(expectedPath);
    });

    it('should build subfolder thumbnail path with __ prefix', () => {
      const template = channelDownloadGrouper.buildThumbnailPathTemplate('Tech');

      // Template uses .NB for byte-based truncation to avoid path length issues with UTF-8
      const expectedPath = path.join(
        '/mock/youtube/output',
        '__Tech',
        '%(uploader,channel,uploader_id).80B',
        '%(uploader,channel,uploader_id).80B - %(title).76B - %(id)s',
        'poster'
      );

      expect(template).toBe(expectedPath);
    });

    it('should end path with poster folder', () => {
      const template = channelDownloadGrouper.buildThumbnailPathTemplate('Gaming');

      expect(template).toMatch(/poster$/);
    });
  });

  describe('generateDownloadGroups', () => {
    it('should generate groups with output paths', async () => {
      const mockChannels = [
        {
          channel_id: 'channel1',
          uploader: 'Uploader 1',
          video_quality: '1080',
          sub_folder: null,
          min_duration: null,
          max_duration: null,
          title_filter_regex: null
        }
      ];

      Channel.findAll.mockResolvedValue(mockChannels);

      const groups = await channelDownloadGrouper.generateDownloadGroups();

      expect(groups).toHaveLength(1);
      expect(groups[0].quality).toBe('1080');
      expect(groups[0].outputPath).toBeDefined();
      expect(groups[0].thumbnailPath).toBeDefined();
      expect(groups[0].channels).toHaveLength(1);
      expect(groups[0].filterConfig).toBeDefined();
    });

    it('should use override quality for all channels when provided', async () => {
      const mockChannels = [
        {
          channel_id: 'channel1',
          video_quality: '1080',
          sub_folder: null,
          min_duration: null,
          max_duration: null,
          title_filter_regex: null
        },
        {
          channel_id: 'channel2',
          video_quality: '720',
          sub_folder: null,
          min_duration: null,
          max_duration: null,
          title_filter_regex: null
        }
      ];

      Channel.findAll.mockResolvedValue(mockChannels);

      const groups = await channelDownloadGrouper.generateDownloadGroups('480');

      expect(groups).toHaveLength(1);
      expect(groups[0].quality).toBe('480');
      expect(groups[0].channels).toHaveLength(2);
    });

    it('should respect per-channel quality when no override', async () => {
      const mockChannels = [
        {
          channel_id: 'channel1',
          video_quality: '1080',
          sub_folder: null,
          min_duration: null,
          max_duration: null,
          title_filter_regex: null
        },
        {
          channel_id: 'channel2',
          video_quality: '720',
          sub_folder: null,
          min_duration: null,
          max_duration: null,
          title_filter_regex: null
        }
      ];

      Channel.findAll.mockResolvedValue(mockChannels);

      const groups = await channelDownloadGrouper.generateDownloadGroups();

      expect(groups).toHaveLength(2);
      expect(groups.find(g => g.quality === '1080')).toBeDefined();
      expect(groups.find(g => g.quality === '720')).toBeDefined();
    });

    it('should use config preferred resolution when available', async () => {
      const mockChannels = [
        {
          channel_id: 'channel1',
          video_quality: null,
          sub_folder: null,
          min_duration: null,
          max_duration: null,
          title_filter_regex: null
        }
      ];

      Channel.findAll.mockResolvedValue(mockChannels);
      configModule.config.preferredResolution = '720';

      const groups = await channelDownloadGrouper.generateDownloadGroups();

      expect(groups).toHaveLength(1);
      expect(groups[0].quality).toBe('720');
    });

    it('should still apply filters when override quality is used', async () => {
      const mockChannels = [
        {
          channel_id: 'channel1',
          video_quality: '1080',
          sub_folder: null,
          min_duration: 300,
          max_duration: null,
          title_filter_regex: null
        },
        {
          channel_id: 'channel2',
          video_quality: '720',
          sub_folder: null,
          min_duration: null,
          max_duration: null,
          title_filter_regex: null
        }
      ];

      Channel.findAll.mockResolvedValue(mockChannels);

      const groups = await channelDownloadGrouper.generateDownloadGroups('480');

      expect(groups).toHaveLength(2);
      expect(groups[0].filterConfig.minDuration).toBe(300);
      expect(groups[1].filterConfig.minDuration).toBeNull();
    });

    it('should generate correct output and thumbnail paths', async () => {
      const mockChannels = [
        {
          channel_id: 'channel1',
          video_quality: '1080',
          sub_folder: 'Tech',
          min_duration: null,
          max_duration: null,
          title_filter_regex: null
        }
      ];

      Channel.findAll.mockResolvedValue(mockChannels);

      const groups = await channelDownloadGrouper.generateDownloadGroups();

      expect(groups[0].outputPath).toContain('__Tech');
      expect(groups[0].thumbnailPath).toContain('__Tech');
      expect(groups[0].thumbnailPath).toMatch(/poster$/);
    });

    it('should handle empty channels array', async () => {
      Channel.findAll.mockResolvedValue([]);

      const groups = await channelDownloadGrouper.generateDownloadGroups();

      expect(groups).toHaveLength(0);
    });

    it('should maintain filter config in groups', async () => {
      const mockChannels = [
        {
          channel_id: 'channel1',
          video_quality: '1080',
          sub_folder: null,
          min_duration: 300,
          max_duration: 3600,
          title_filter_regex: 'test.*'
        }
      ];

      Channel.findAll.mockResolvedValue(mockChannels);

      const groups = await channelDownloadGrouper.generateDownloadGroups();

      expect(groups[0].filterConfig.minDuration).toBe(300);
      expect(groups[0].filterConfig.maxDuration).toBe(3600);
      expect(groups[0].filterConfig.titleFilterRegex).toBe('test.*');
    });
  });
});
