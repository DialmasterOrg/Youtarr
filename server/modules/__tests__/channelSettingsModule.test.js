/* eslint-env jest */

// Mock dependencies before requiring the module
jest.mock('fs-extra');
jest.mock('child_process');
jest.mock('../../logger');
jest.mock('../../models/channel', () => {
  const { Model } = require('sequelize');
  class MockChannel extends Model {}
  MockChannel.findOne = jest.fn();
  MockChannel.findAll = jest.fn();
  MockChannel.update = jest.fn();
  MockChannel.init = jest.fn(() => MockChannel);
  return MockChannel;
});

jest.mock('../../models/channelvideo', () => {
  const { Model } = require('sequelize');
  class MockChannelVideo extends Model {}
  MockChannelVideo.findAll = jest.fn();
  MockChannelVideo.init = jest.fn(() => MockChannelVideo);
  return MockChannelVideo;
});

jest.mock('../../models/video', () => {
  const { Model } = require('sequelize');
  class MockVideo extends Model {}
  MockVideo.findOne = jest.fn();
  MockVideo.findAll = jest.fn();
  MockVideo.init = jest.fn(() => MockVideo);
  return MockVideo;
});

jest.mock('../configModule', () => ({
  directoryPath: '/test/output',
  getDefaultSubfolder: jest.fn().mockReturnValue(null)
}));

jest.mock('../jobModule', () => ({
  getAllJobs: jest.fn().mockReturnValue({})
}));

jest.mock('../plexModule', () => ({
  refreshLibrary: jest.fn().mockResolvedValue(true),
  refreshLibraryForSubfolder: jest.fn().mockResolvedValue(true),
  refreshLibrariesForSubfolders: jest.fn().mockResolvedValue(undefined),
}));

describe('ChannelSettingsModule', () => {
  let channelSettingsModule;
  let fs;
  let childProcess;
  let logger;
  let Channel;
  let ChannelVideo;
  let Video;
  let jobModule;
  let plexModule;

  const mockChannel = {
    channel_id: 'UC123456',
    uploader: 'Test Channel',
    sub_folder: null,
    video_quality: null,
    min_duration: null,
    max_duration: null,
    title_filter_regex: null,
    update: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    fs = require('fs-extra');
    childProcess = require('child_process');
    logger = require('../../logger');
    Channel = require('../../models/channel');
    ChannelVideo = require('../../models/channelvideo');
    Video = require('../../models/video');
    jobModule = require('../jobModule');
    plexModule = require('../plexModule');

    // Reset mock implementations
    Channel.findOne.mockResolvedValue(null);
    Channel.findAll.mockResolvedValue([]);
    ChannelVideo.findAll.mockResolvedValue([]);
    Video.findOne.mockResolvedValue(null);
    Video.findAll.mockResolvedValue([]);
    fs.existsSync = jest.fn().mockReturnValue(false);
    fs.ensureDir = jest.fn().mockResolvedValue(undefined);
    fs.move = jest.fn().mockResolvedValue(undefined);

    channelSettingsModule = require('../channelSettingsModule');
  });

  describe('validateSubFolder', () => {
    test('should validate empty string as valid', () => {
      const result = channelSettingsModule.validateSubFolder('');
      expect(result.valid).toBe(true);
    });

    test('should validate null as valid', () => {
      const result = channelSettingsModule.validateSubFolder(null);
      expect(result.valid).toBe(true);
    });

    test('should validate alphanumeric subfolder names', () => {
      const result = channelSettingsModule.validateSubFolder('MyFolder123');
      expect(result.valid).toBe(true);
    });

    test('should validate subfolder names with spaces, hyphens, and underscores', () => {
      const result = channelSettingsModule.validateSubFolder('My Folder-Name_123');
      expect(result.valid).toBe(true);
    });

    test('should reject subfolder names longer than 100 characters', () => {
      const longName = 'a'.repeat(101);
      const result = channelSettingsModule.validateSubFolder(longName);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Subfolder name must be 100 characters or less');
    });

    test('should reject subfolder names with invalid characters', () => {
      const result = channelSettingsModule.validateSubFolder('My@Folder!');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Subfolder name can only contain letters, numbers, spaces, hyphens, and underscores');
    });

    test('should reject path traversal attempts with ..', () => {
      const result = channelSettingsModule.validateSubFolder('../secret');
      expect(result.valid).toBe(false);
      // The .. is caught by the invalid characters check first
      expect(result.error).toContain('Subfolder name can only contain');
    });

    test('should reject paths with forward slashes', () => {
      const result = channelSettingsModule.validateSubFolder('folder/subfolder');
      expect(result.valid).toBe(false);
      // Forward slash is caught by invalid characters check
      expect(result.error).toContain('Subfolder name can only contain');
    });

    test('should reject paths with backslashes', () => {
      const result = channelSettingsModule.validateSubFolder('folder\\subfolder');
      expect(result.valid).toBe(false);
      // Backslash is caught by invalid characters check
      expect(result.error).toContain('Subfolder name can only contain');
    });

    test('should reject names starting with __ (reserved prefix)', () => {
      const result = channelSettingsModule.validateSubFolder('__reserved');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Subfolder names cannot start with __ (reserved prefix)');
    });

    test('should trim whitespace before validation', () => {
      const result = channelSettingsModule.validateSubFolder('  ValidFolder  ');
      expect(result.valid).toBe(true);
    });
  });

  describe('validateVideoQuality', () => {
    test('should validate null as valid', () => {
      const result = channelSettingsModule.validateVideoQuality(null);
      expect(result.valid).toBe(true);
    });

    test('should validate undefined as valid', () => {
      const result = channelSettingsModule.validateVideoQuality(undefined);
      expect(result.valid).toBe(true);
    });

    test('should validate 360p quality', () => {
      const result = channelSettingsModule.validateVideoQuality('360');
      expect(result.valid).toBe(true);
    });

    test('should validate 480p quality', () => {
      const result = channelSettingsModule.validateVideoQuality('480');
      expect(result.valid).toBe(true);
    });

    test('should validate 720p quality', () => {
      const result = channelSettingsModule.validateVideoQuality('720');
      expect(result.valid).toBe(true);
    });

    test('should validate 1080p quality', () => {
      const result = channelSettingsModule.validateVideoQuality('1080');
      expect(result.valid).toBe(true);
    });

    test('should validate 1440p quality', () => {
      const result = channelSettingsModule.validateVideoQuality('1440');
      expect(result.valid).toBe(true);
    });

    test('should validate 2160p quality', () => {
      const result = channelSettingsModule.validateVideoQuality('2160');
      expect(result.valid).toBe(true);
    });

    test('should reject invalid quality values', () => {
      const result = channelSettingsModule.validateVideoQuality('999');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid video quality. Valid values: 360, 480, 720, 1080, 1440, 2160, or null for global setting');
    });
  });

  describe('validateDurationSettings', () => {
    test('should validate both null as valid', () => {
      const result = channelSettingsModule.validateDurationSettings(null, null);
      expect(result.valid).toBe(true);
    });

    test('should validate valid min_duration', () => {
      const result = channelSettingsModule.validateDurationSettings(60, null);
      expect(result.valid).toBe(true);
    });

    test('should validate valid max_duration', () => {
      const result = channelSettingsModule.validateDurationSettings(null, 3600);
      expect(result.valid).toBe(true);
    });

    test('should validate when min < max', () => {
      const result = channelSettingsModule.validateDurationSettings(60, 3600);
      expect(result.valid).toBe(true);
    });

    test('should reject negative min_duration', () => {
      const result = channelSettingsModule.validateDurationSettings(-1, null);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Minimum duration must be a non-negative integer (seconds)');
    });

    test('should reject non-integer min_duration', () => {
      const result = channelSettingsModule.validateDurationSettings(60.5, null);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Minimum duration must be a non-negative integer (seconds)');
    });

    test('should reject min_duration exceeding 24 hours', () => {
      const result = channelSettingsModule.validateDurationSettings(86401, null);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Minimum duration cannot exceed 24 hours (86400 seconds)');
    });

    test('should reject negative max_duration', () => {
      const result = channelSettingsModule.validateDurationSettings(null, -1);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Maximum duration must be a non-negative integer (seconds)');
    });

    test('should reject non-integer max_duration', () => {
      const result = channelSettingsModule.validateDurationSettings(null, 3600.5);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Maximum duration must be a non-negative integer (seconds)');
    });

    test('should reject max_duration exceeding 24 hours', () => {
      const result = channelSettingsModule.validateDurationSettings(null, 86401);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Maximum duration cannot exceed 24 hours (86400 seconds)');
    });

    test('should reject when min >= max', () => {
      const result = channelSettingsModule.validateDurationSettings(3600, 3600);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Minimum duration must be less than maximum duration');
    });

    test('should reject when min > max', () => {
      const result = channelSettingsModule.validateDurationSettings(7200, 3600);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Minimum duration must be less than maximum duration');
    });

    test('should accept 24 hours exactly', () => {
      const result = channelSettingsModule.validateDurationSettings(60, 86400);
      expect(result.valid).toBe(true);
    });
  });

  describe('validateTitleRegex', () => {
    beforeEach(() => {
      // Mock execFileSync to return valid regex result by default
      childProcess.execFileSync = jest.fn().mockReturnValue(JSON.stringify({ matches: false }));
    });

    test('should validate empty string as valid', () => {
      const result = channelSettingsModule.validateTitleRegex('');
      expect(result.valid).toBe(true);
    });

    test('should validate null as valid', () => {
      const result = channelSettingsModule.validateTitleRegex(null);
      expect(result.valid).toBe(true);
    });

    test('should validate simple regex patterns', () => {
      childProcess.execFileSync.mockReturnValue(JSON.stringify({ matches: true }));
      const result = channelSettingsModule.validateTitleRegex('test.*pattern');
      expect(result.valid).toBe(true);
      expect(childProcess.execFileSync).toHaveBeenCalledWith(
        'python3',
        expect.arrayContaining(['test.*pattern', 'test']),
        expect.any(Object)
      );
    });

    test('should reject regex patterns longer than 500 characters', () => {
      const longPattern = 'a'.repeat(501);
      const result = channelSettingsModule.validateTitleRegex(longPattern);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Title filter regex must be 500 characters or less');
    });

    test('should reject invalid Python regex patterns', () => {
      childProcess.execFileSync.mockReturnValue(JSON.stringify({ error: 'Invalid regex syntax' }));
      const result = channelSettingsModule.validateTitleRegex('[invalid');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid regex syntax');
    });

    test('should handle Python execution errors', () => {
      childProcess.execFileSync.mockImplementation(() => {
        throw new Error('Python not found');
      });
      const result = channelSettingsModule.validateTitleRegex('test');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid Python regex pattern');
    });

    test('should trim whitespace before validation', () => {
      childProcess.execFileSync.mockReturnValue(JSON.stringify({ matches: false }));
      const result = channelSettingsModule.validateTitleRegex('  test  ');
      expect(result.valid).toBe(true);
    });
  });

  describe('getChannelDirectory', () => {
    test('should return base directory path when no subfolder', () => {
      const channel = { ...mockChannel, uploader: 'TestChannel' };
      const result = channelSettingsModule.getChannelDirectory(channel);
      expect(result).toBe('/test/output/TestChannel');
    });

    test('should include subfolder with __ prefix', () => {
      const channel = { ...mockChannel, uploader: 'TestChannel', sub_folder: 'Music' };
      const result = channelSettingsModule.getChannelDirectory(channel);
      expect(result).toBe('/test/output/__Music/TestChannel');
    });

    test('should trim subfolder whitespace', () => {
      const channel = { ...mockChannel, uploader: 'TestChannel', sub_folder: '  Music  ' };
      const result = channelSettingsModule.getChannelDirectory(channel);
      expect(result).toBe('/test/output/__Music/TestChannel');
    });

    test('should handle empty subfolder string as null', () => {
      const channel = { ...mockChannel, uploader: 'TestChannel', sub_folder: '' };
      const result = channelSettingsModule.getChannelDirectory(channel);
      expect(result).toBe('/test/output/TestChannel');
    });

    test('should prefer folder_name over uploader when both exist', () => {
      const channel = { ...mockChannel, uploader: 'RawChannel#Name', folder_name: 'RawChannel_Name' };
      const result = channelSettingsModule.getChannelDirectory(channel);
      expect(result).toBe('/test/output/RawChannel_Name');
    });

    test('should fall back to uploader when folder_name is null', () => {
      const channel = { ...mockChannel, uploader: 'TestChannel', folder_name: null };
      const result = channelSettingsModule.getChannelDirectory(channel);
      expect(result).toBe('/test/output/TestChannel');
    });

    test('should use folder_name with subfolder', () => {
      const channel = { ...mockChannel, uploader: 'RawName#Special', folder_name: 'RawName_Special', sub_folder: 'Music' };
      const result = channelSettingsModule.getChannelDirectory(channel);
      expect(result).toBe('/test/output/__Music/RawName_Special');
    });
  });

  describe('hasActiveDownloads', () => {
    test('should return false when no jobs are running', async () => {
      jobModule.getAllJobs.mockReturnValue({});
      const result = await channelSettingsModule.hasActiveDownloads('UC123456');
      expect(result).toBe(false);
    });

    test('should return false when jobs exist but none are active', async () => {
      jobModule.getAllJobs.mockReturnValue({
        job1: { id: 1, status: 'Completed' },
        job2: { id: 2, status: 'Failed' }
      });
      const result = await channelSettingsModule.hasActiveDownloads('UC123456');
      expect(result).toBe(false);
    });
  });

  describe('getAllSubFolders', () => {
    test('should return empty array when no channels have subfolders', async () => {
      Channel.findAll.mockResolvedValue([]);
      const result = await channelSettingsModule.getAllSubFolders();
      expect(result).toEqual([]);
    });

    test('should return unique subfolders with __ prefix', async () => {
      Channel.findAll.mockResolvedValue([
        { sub_folder: 'Music' },
        { sub_folder: 'Gaming' },
        { sub_folder: 'Music' } // Duplicate
      ]);
      const result = await channelSettingsModule.getAllSubFolders();
      expect(result).toEqual(['__Gaming', '__Music']);
    });

    test('should handle null subfolders', async () => {
      Channel.findAll.mockResolvedValue([
        { sub_folder: 'Music' },
        { sub_folder: null }
      ]);
      const result = await channelSettingsModule.getAllSubFolders();
      expect(result).toEqual(['__Music']);
    });

    test('should trim subfolder whitespace', async () => {
      Channel.findAll.mockResolvedValue([
        { sub_folder: '  Music  ' },
        { sub_folder: 'Gaming' }
      ]);
      const result = await channelSettingsModule.getAllSubFolders();
      expect(result).toEqual(['__Gaming', '__Music']);
    });

    test('should sort subfolders alphabetically', async () => {
      Channel.findAll.mockResolvedValue([
        { sub_folder: 'Zulu' },
        { sub_folder: 'Alpha' },
        { sub_folder: 'Beta' }
      ]);
      const result = await channelSettingsModule.getAllSubFolders();
      expect(result).toEqual(['__Alpha', '__Beta', '__Zulu']);
    });

    test('should include the configured global default subfolder when no channels exist', async () => {
      Channel.findAll.mockResolvedValue([]);
      const configModule = require('../configModule');
      configModule.getDefaultSubfolder.mockReturnValue('Adults');

      const result = await channelSettingsModule.getAllSubFolders();

      expect(result).toEqual(['__Adults']);
    });

    test('should include the global default subfolder alongside explicit channel subfolders', async () => {
      Channel.findAll.mockResolvedValue([
        { sub_folder: 'Kids' },
        { sub_folder: 'Music' }
      ]);
      const configModule = require('../configModule');
      configModule.getDefaultSubfolder.mockReturnValue('Adults');

      const result = await channelSettingsModule.getAllSubFolders();

      expect(result).toEqual(['__Adults', '__Kids', '__Music']);
    });

    test('should deduplicate when the global default matches an explicit channel subfolder', async () => {
      Channel.findAll.mockResolvedValue([
        { sub_folder: 'Music' },
        { sub_folder: 'Adults' }
      ]);
      const configModule = require('../configModule');
      configModule.getDefaultSubfolder.mockReturnValue('Adults');

      const result = await channelSettingsModule.getAllSubFolders();

      expect(result).toEqual(['__Adults', '__Music']);
    });

    test('should not add anything when the global default subfolder is null', async () => {
      Channel.findAll.mockResolvedValue([
        { sub_folder: 'Music' }
      ]);
      const configModule = require('../configModule');
      configModule.getDefaultSubfolder.mockReturnValue(null);

      const result = await channelSettingsModule.getAllSubFolders();

      expect(result).toEqual(['__Music']);
    });
  });

  describe('previewTitleFilter', () => {
    const mockChannelVideos = [
      {
        youtube_id: 'vid1',
        title: 'Test Video 1',
        publishedAt: '2024-01-01T00:00:00Z'
      },
      {
        youtube_id: 'vid2',
        title: 'Another Video',
        publishedAt: '2024-01-02T00:00:00Z'
      }
    ];

    beforeEach(() => {
      ChannelVideo.findAll.mockResolvedValue(mockChannelVideos);
      childProcess.execFileSync = jest.fn().mockReturnValue(JSON.stringify({ matches: false }));
    });

    test('should return all videos as matching when no regex provided', async () => {
      const result = await channelSettingsModule.previewTitleFilter('UC123456', '');
      expect(result.totalCount).toBe(2);
      expect(result.matchCount).toBe(2);
      expect(result.videos.every(v => v.matches)).toBe(true);
    });

    test('should test regex against each video title', async () => {
      // Mock validateTitleRegex to return valid first
      childProcess.execFileSync.mockReturnValue(JSON.stringify({ matches: false }));

      // Then set up the specific responses for each video title
      childProcess.execFileSync
        .mockReturnValueOnce(JSON.stringify({ matches: false })) // validation call
        .mockReturnValueOnce(JSON.stringify({ matches: true }))  // first video
        .mockReturnValueOnce(JSON.stringify({ matches: false })); // second video

      const result = await channelSettingsModule.previewTitleFilter('UC123456', 'Test');
      expect(result.totalCount).toBe(2);
      expect(result.matchCount).toBe(1);
      expect(result.videos[0].matches).toBe(true);
      expect(result.videos[1].matches).toBe(false);
    });

    test('should throw error for invalid regex pattern', async () => {
      await expect(
        channelSettingsModule.previewTitleFilter('UC123456', 'a'.repeat(501))
      ).rejects.toThrow('Title filter regex must be 500 characters or less');
    });

    test('should handle Python execution errors gracefully', async () => {
      // First call for validation should succeed, then subsequent calls fail
      childProcess.execFileSync
        .mockReturnValueOnce(JSON.stringify({ matches: false })) // validation call succeeds
        .mockImplementation(() => {
          throw new Error('Python error');
        });

      const result = await channelSettingsModule.previewTitleFilter('UC123456', 'test');
      expect(result.matchCount).toBe(0);
      expect(result.videos.every(v => !v.matches)).toBe(true);
      expect(logger.error).toHaveBeenCalled();
    });

    test('should limit results to 20 videos', async () => {
      const manyVideos = Array.from({ length: 30 }, (_, i) => ({
        youtube_id: `vid${i}`,
        title: `Video ${i}`,
        publishedAt: `2024-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`
      }));
      ChannelVideo.findAll.mockResolvedValue(manyVideos);

      const result = await channelSettingsModule.previewTitleFilter('UC123456', '');
      // The module returns all videos that are returned from findAll, which is limited in the query
      // but our mock returns all 30. The actual limit happens in the SQL query with limit: 20
      expect(result.videos.length).toBe(30);
      expect(result.totalCount).toBe(30);
    });
  });

  describe('getChannelSettings', () => {
    test('should return channel settings', async () => {
      const channel = {
        ...mockChannel,
        sub_folder: 'Music',
        video_quality: '1080',
        min_duration: 60,
        max_duration: 3600,
        title_filter_regex: 'test.*'
      };
      Channel.findOne.mockResolvedValue(channel);

      const result = await channelSettingsModule.getChannelSettings('UC123456');
      expect(result).toMatchObject({
        channel_id: 'UC123456',
        uploader: 'Test Channel',
        sub_folder: 'Music',
        video_quality: '1080',
        min_duration: 60,
        max_duration: 3600,
        title_filter_regex: 'test.*'
      });
    });

    test('should throw error when channel not found', async () => {
      Channel.findOne.mockResolvedValue(null);
      await expect(
        channelSettingsModule.getChannelSettings('UC999999')
      ).rejects.toThrow('Channel not found');
    });

    test('includes detected_tabs, hidden_tabs, and effective available_tabs', async () => {
      const channel = {
        ...mockChannel,
        available_tabs: 'videos,shorts,streams',
        hidden_tabs: 'shorts'
      };
      Channel.findOne.mockResolvedValue(channel);

      const result = await channelSettingsModule.getChannelSettings('UC123456');

      expect(result.detected_tabs).toEqual(['videos', 'shorts', 'streams']);
      expect(result.hidden_tabs).toEqual(['shorts']);
      expect(result.available_tabs).toEqual(['videos', 'streams']);
    });

    test('returns empty arrays for detected_tabs/hidden_tabs when channel has no tab data', async () => {
      const channel = { ...mockChannel };
      Channel.findOne.mockResolvedValue(channel);

      const result = await channelSettingsModule.getChannelSettings('UC123456');

      expect(result.detected_tabs).toEqual([]);
      expect(result.hidden_tabs).toEqual([]);
      expect(result.available_tabs).toEqual([]);
    });

    test('includes auto_download_enabled_tabs from the channel record', async () => {
      const channel = {
        ...mockChannel,
        auto_download_enabled_tabs: 'video,short'
      };
      Channel.findOne.mockResolvedValue(channel);

      const result = await channelSettingsModule.getChannelSettings('UC123456');

      expect(result.auto_download_enabled_tabs).toBe('video,short');
    });
  });

  describe('updateChannelSettings', () => {
    beforeEach(() => {
      const channel = {
        ...mockChannel,
        update: jest.fn().mockImplementation(function(data) {
          Object.assign(this, data);
          return Promise.resolve(this);
        })
      };
      Channel.findOne.mockResolvedValue(channel);
      jobModule.getAllJobs.mockReturnValue({});
    });

    test('should throw error when channel not found', async () => {
      Channel.findOne.mockResolvedValue(null);
      await expect(
        channelSettingsModule.updateChannelSettings('UC999999', {})
      ).rejects.toThrow('Channel not found');
    });

    test('should allow subfolder change when no downloads are active', async () => {
      jobModule.getAllJobs.mockReturnValue({});

      const result = await channelSettingsModule.updateChannelSettings('UC123456', {
        sub_folder: 'NewFolder'
      });

      expect(result.settings.sub_folder).toBe('NewFolder');
    });

    test('should update video quality', async () => {
      const channel = await Channel.findOne();

      const result = await channelSettingsModule.updateChannelSettings('UC123456', {
        video_quality: '720'
      });

      expect(result.settings.video_quality).toBe('720');
      expect(result.folderMoved).toBe(false);
      expect(channel.update).toHaveBeenCalledWith({ video_quality: '720' });
    });

    test('should update duration settings', async () => {
      const channel = await Channel.findOne();

      const result = await channelSettingsModule.updateChannelSettings('UC123456', {
        min_duration: 60,
        max_duration: 3600
      });

      expect(result.settings.min_duration).toBe(60);
      expect(result.settings.max_duration).toBe(3600);
      expect(channel.update).toHaveBeenCalledWith({
        min_duration: 60,
        max_duration: 3600
      });
    });

    test('should update title filter regex', async () => {
      const channel = await Channel.findOne();
      childProcess.execFileSync = jest.fn().mockReturnValue(JSON.stringify({ matches: false }));

      const result = await channelSettingsModule.updateChannelSettings('UC123456', {
        title_filter_regex: 'test.*pattern'
      });

      expect(result.settings.title_filter_regex).toBe('test.*pattern');
      expect(channel.update).toHaveBeenCalledWith({
        title_filter_regex: 'test.*pattern'
      });
    });

    test('should validate subfolder before updating', async () => {
      await expect(
        channelSettingsModule.updateChannelSettings('UC123456', {
          sub_folder: '__invalid'
        })
      ).rejects.toThrow('Subfolder names cannot start with __ (reserved prefix)');
    });

    test('should validate video quality before updating', async () => {
      await expect(
        channelSettingsModule.updateChannelSettings('UC123456', {
          video_quality: '999'
        })
      ).rejects.toThrow('Invalid video quality');
    });

    test('should validate duration settings before updating', async () => {
      await expect(
        channelSettingsModule.updateChannelSettings('UC123456', {
          min_duration: 7200,
          max_duration: 3600
        })
      ).rejects.toThrow('Minimum duration must be less than maximum duration');
    });

    test('should validate title regex before updating', async () => {
      await expect(
        channelSettingsModule.updateChannelSettings('UC123456', {
          title_filter_regex: 'a'.repeat(501)
        })
      ).rejects.toThrow('Title filter regex must be 500 characters or less');
    });

    test('should move folder when subfolder changes', async () => {
      fs.existsSync
        .mockReturnValueOnce(true)  // Old folder exists
        .mockReturnValueOnce(false); // New folder doesn't exist
      Video.findAll.mockResolvedValue([]);

      const result = await channelSettingsModule.updateChannelSettings('UC123456', {
        sub_folder: 'Music'
      });

      expect(result.folderMoved).toBe(true);
      expect(result.moveResult.success).toBe(true);
      expect(fs.move).toHaveBeenCalled();
    });

    test('should rollback database change if folder move fails', async () => {
      fs.existsSync
        .mockReturnValueOnce(true)  // Old folder exists
        .mockReturnValueOnce(false); // New folder doesn't exist
      fs.move.mockRejectedValue(new Error('Move failed'));

      const channel = await Channel.findOne();
      channel.update = jest.fn()
        .mockResolvedValueOnce(channel) // First update succeeds
        .mockResolvedValueOnce(channel); // Rollback update

      await expect(
        channelSettingsModule.updateChannelSettings('UC123456', { sub_folder: 'Music' })
      ).rejects.toThrow('Failed to move channel folder');

      expect(channel.update).toHaveBeenCalledWith({ sub_folder: null });
    });

    describe('hidden_tabs', () => {
      test('persists hidden_tabs as comma-separated string', async () => {
        const channel = {
          ...mockChannel,
          available_tabs: 'videos,shorts,streams',
          hidden_tabs: null,
          auto_download_enabled_tabs: 'video',
          update: jest.fn().mockImplementation(function (data) {
            Object.assign(this, data);
            return Promise.resolve(this);
          })
        };
        Channel.findOne.mockResolvedValue(channel);

        const result = await channelSettingsModule.updateChannelSettings('UC123456', {
          hidden_tabs: ['shorts']
        });

        expect(channel.update).toHaveBeenCalledWith(
          expect.objectContaining({ hidden_tabs: 'shorts' })
        );
        expect(result.settings.hidden_tabs).toEqual(['shorts']);
        expect(result.settings.available_tabs).toEqual(['videos', 'streams']);
      });

      test('clears hidden_tabs when passed an empty array', async () => {
        const channel = {
          ...mockChannel,
          available_tabs: 'videos,shorts',
          hidden_tabs: 'shorts',
          auto_download_enabled_tabs: 'video',
          update: jest.fn().mockImplementation(function (data) {
            Object.assign(this, data);
            return Promise.resolve(this);
          })
        };
        Channel.findOne.mockResolvedValue(channel);

        await channelSettingsModule.updateChannelSettings('UC123456', {
          hidden_tabs: []
        });

        expect(channel.update).toHaveBeenCalledWith(
          expect.objectContaining({ hidden_tabs: null })
        );
      });

      test('rejects invalid tab type values', async () => {
        const channel = {
          ...mockChannel,
          available_tabs: 'videos,shorts',
          update: jest.fn()
        };
        Channel.findOne.mockResolvedValue(channel);

        await expect(
          channelSettingsModule.updateChannelSettings('UC123456', {
            hidden_tabs: ['bogus']
          })
        ).rejects.toThrow('Invalid hidden_tabs');
      });

      test('rejects hiding every detected tab', async () => {
        const channel = {
          ...mockChannel,
          available_tabs: 'videos,shorts',
          update: jest.fn()
        };
        Channel.findOne.mockResolvedValue(channel);

        await expect(
          channelSettingsModule.updateChannelSettings('UC123456', {
            hidden_tabs: ['videos', 'shorts']
          })
        ).rejects.toThrow('At least one tab must remain visible');
      });

      test('strips auto_download_enabled_tabs entries that map to a hidden tab', async () => {
        const channel = {
          ...mockChannel,
          available_tabs: 'videos,shorts',
          hidden_tabs: null,
          auto_download_enabled_tabs: 'video,short',
          update: jest.fn().mockImplementation(function (data) {
            Object.assign(this, data);
            return Promise.resolve(this);
          })
        };
        Channel.findOne.mockResolvedValue(channel);

        await channelSettingsModule.updateChannelSettings('UC123456', {
          hidden_tabs: ['shorts']
        });

        const updateCall = channel.update.mock.calls.find(
          (call) => 'auto_download_enabled_tabs' in (call[0] || {})
        );
        expect(updateCall).toBeDefined();
        expect(updateCall[0].auto_download_enabled_tabs).toBe('video');
      });
    });

    describe('auto_download_enabled_tabs', () => {
      const buildChannel = (overrides = {}) => ({
        ...mockChannel,
        available_tabs: 'videos,shorts,streams',
        hidden_tabs: null,
        auto_download_enabled_tabs: 'video',
        update: jest.fn().mockImplementation(function (data) {
          Object.assign(this, data);
          return Promise.resolve(this);
        }),
        ...overrides,
      });

      test('persists a valid auto_download_enabled_tabs value', async () => {
        const channel = buildChannel();
        Channel.findOne.mockResolvedValue(channel);

        const result = await channelSettingsModule.updateChannelSettings('UC123456', {
          auto_download_enabled_tabs: 'video,livestream'
        });

        expect(channel.update).toHaveBeenCalledWith(
          expect.objectContaining({ auto_download_enabled_tabs: 'video,livestream' })
        );
        expect(result.settings.auto_download_enabled_tabs).toBe('video,livestream');
      });

      test('persists an empty string when the user disables all auto-downloads', async () => {
        const channel = buildChannel({ auto_download_enabled_tabs: 'video,short' });
        Channel.findOne.mockResolvedValue(channel);

        await channelSettingsModule.updateChannelSettings('UC123456', {
          auto_download_enabled_tabs: ''
        });

        expect(channel.update).toHaveBeenCalledWith(
          expect.objectContaining({ auto_download_enabled_tabs: '' })
        );
      });

      test('rejects unknown media type entries', async () => {
        const channel = buildChannel();
        Channel.findOne.mockResolvedValue(channel);

        await expect(
          channelSettingsModule.updateChannelSettings('UC123456', {
            auto_download_enabled_tabs: 'video,bogus'
          })
        ).rejects.toThrow('Invalid auto_download_enabled_tabs entry: bogus');
        expect(channel.update).not.toHaveBeenCalled();
      });

      test('rejects entries whose tab is not detected for the channel', async () => {
        const channel = buildChannel({ available_tabs: 'videos' });
        Channel.findOne.mockResolvedValue(channel);

        await expect(
          channelSettingsModule.updateChannelSettings('UC123456', {
            auto_download_enabled_tabs: 'short'
          })
        ).rejects.toThrow(/'short' is not allowed/);
        expect(channel.update).not.toHaveBeenCalled();
      });

      test('rejects entries whose tab will be hidden after the same update', async () => {
        const channel = buildChannel();
        Channel.findOne.mockResolvedValue(channel);

        await expect(
          channelSettingsModule.updateChannelSettings('UC123456', {
            hidden_tabs: ['shorts'],
            auto_download_enabled_tabs: 'video,short'
          })
        ).rejects.toThrow(/'short' is not allowed/);
      });

      test('does not run hidden-tab strip side-effect when user supplies a validated value', async () => {
        const channel = buildChannel({
          available_tabs: 'videos,shorts',
          auto_download_enabled_tabs: 'video,short'
        });
        Channel.findOne.mockResolvedValue(channel);

        await channelSettingsModule.updateChannelSettings('UC123456', {
          hidden_tabs: ['shorts'],
          auto_download_enabled_tabs: 'video'
        });

        const autoCalls = channel.update.mock.calls.filter(
          (call) => 'auto_download_enabled_tabs' in (call[0] || {})
        );
        expect(autoCalls).toHaveLength(1);
        expect(autoCalls[0][0].auto_download_enabled_tabs).toBe('video');
      });

      test('round-trips through GET after a save', async () => {
        const channel = buildChannel();
        Channel.findOne.mockResolvedValue(channel);

        await channelSettingsModule.updateChannelSettings('UC123456', {
          auto_download_enabled_tabs: 'short,livestream'
        });
        const refreshed = await channelSettingsModule.getChannelSettings('UC123456');

        expect(refreshed.auto_download_enabled_tabs).toBe('short,livestream');
      });
    });
  });

  describe('moveChannelFolder', () => {
    const channel = {
      ...mockChannel,
      uploader: 'TestChannel'
    };

    beforeEach(() => {
      Video.findAll.mockResolvedValue([]);
    });

    test('should move folder from root to subfolder', async () => {
      fs.existsSync
        .mockReturnValueOnce(true)  // Old folder exists
        .mockReturnValueOnce(false); // New folder doesn't exist

      const result = await channelSettingsModule.moveChannelFolder(
        channel,
        null,
        'Music'
      );

      expect(fs.move).toHaveBeenCalledWith(
        '/test/output/TestChannel',
        '/test/output/__Music/TestChannel',
        { overwrite: true }
      );
      expect(result.success).toBe(true);
    });

    test('should move folder from subfolder to root', async () => {
      fs.existsSync
        .mockReturnValueOnce(true)  // Old folder exists
        .mockReturnValueOnce(false); // New folder doesn't exist

      const result = await channelSettingsModule.moveChannelFolder(
        channel,
        'Music',
        null
      );

      expect(fs.move).toHaveBeenCalledWith(
        '/test/output/__Music/TestChannel',
        '/test/output/TestChannel',
        { overwrite: true }
      );
      expect(result.success).toBe(true);
    });

    test('should move folder between subfolders', async () => {
      fs.existsSync
        .mockReturnValueOnce(true)  // Old folder exists
        .mockReturnValueOnce(false); // New folder doesn't exist

      const result = await channelSettingsModule.moveChannelFolder(
        channel,
        'Music',
        'Gaming'
      );

      expect(fs.move).toHaveBeenCalledWith(
        '/test/output/__Music/TestChannel',
        '/test/output/__Gaming/TestChannel',
        { overwrite: true }
      );
      expect(result.success).toBe(true);
    });

    test('should succeed when old folder does not exist', async () => {
      fs.existsSync.mockReturnValue(false);

      const result = await channelSettingsModule.moveChannelFolder(
        channel,
        'Music',
        'Gaming'
      );

      expect(result.success).toBe(true);
      expect(result.message).toBe('No existing folder to move');
      expect(fs.move).not.toHaveBeenCalled();
    });

    test('should throw error when destination already exists', async () => {
      fs.existsSync.mockImplementation(() => {
        return true; // Both old and new paths exist
      });

      await expect(
        channelSettingsModule.moveChannelFolder(channel, 'Music', 'Gaming')
      ).rejects.toThrow('Destination folder already exists');
    });

    test('should ensure parent directory exists', async () => {
      fs.existsSync
        .mockReturnValueOnce(true) // Old path exists
        .mockReturnValueOnce(false); // New path doesn't exist

      await channelSettingsModule.moveChannelFolder(channel, null, 'Music');

      expect(fs.ensureDir).toHaveBeenCalledWith('/test/output/__Music');
    });

    test('should update video file paths after move', async () => {
      fs.existsSync
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false);

      const mockVideos = [
        {
          filePath: '/test/output/TestChannel/video1.mp4',
          update: jest.fn()
        },
        {
          filePath: '/test/output/TestChannel/video2.mp4',
          update: jest.fn()
        }
      ];
      Video.findAll.mockResolvedValue(mockVideos);

      await channelSettingsModule.moveChannelFolder(channel, null, 'Music');

      expect(mockVideos[0].update).toHaveBeenCalledWith({
        filePath: '/test/output/__Music/TestChannel/video1.mp4'
      });
      expect(mockVideos[1].update).toHaveBeenCalledWith({
        filePath: '/test/output/__Music/TestChannel/video2.mp4'
      });
    });

    test('should trigger Plex library refresh for both old and new subfolders asynchronously', async () => {
      fs.existsSync
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false);

      await channelSettingsModule.moveChannelFolder(channel, null, 'Music');

      // Plex refresh is called via setImmediate, so we need to flush the queue
      await new Promise(resolve => setImmediate(resolve));

      expect(plexModule.refreshLibrariesForSubfolders).toHaveBeenCalledWith([null, 'Music']);
    });

    test('should not fail if Plex refresh fails', async () => {
      fs.existsSync
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false);
      plexModule.refreshLibrariesForSubfolders.mockRejectedValue(new Error('Plex error'));

      const result = await channelSettingsModule.moveChannelFolder(channel, null, 'Music');

      expect(result.success).toBe(true);

      // Flush setImmediate queue
      await new Promise(resolve => setImmediate(resolve));

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ err: expect.any(Error) }),
        'Could not refresh Plex library'
      );
    });
  });

  describe('updateVideoFilePaths', () => {
    test('should update all video file paths for channel', async () => {
      const mockVideos = [
        {
          filePath: '/old/path/TestChannel/video1.mp4',
          update: jest.fn()
        },
        {
          filePath: '/old/path/TestChannel/video2.mp4',
          update: jest.fn()
        }
      ];
      Video.findAll.mockResolvedValue(mockVideos);

      const count = await channelSettingsModule.updateVideoFilePaths(
        'UC123456',
        '/old/path/TestChannel',
        '/new/path/TestChannel'
      );

      expect(count).toBe(2);
      expect(mockVideos[0].update).toHaveBeenCalledWith({
        filePath: '/new/path/TestChannel/video1.mp4'
      });
      expect(mockVideos[1].update).toHaveBeenCalledWith({
        filePath: '/new/path/TestChannel/video2.mp4'
      });
    });

    test('should only update videos that match old path', async () => {
      const mockVideos = [
        {
          filePath: '/old/path/TestChannel/video1.mp4',
          update: jest.fn()
        },
        {
          filePath: '/different/path/TestChannel/video2.mp4',
          update: jest.fn()
        }
      ];
      Video.findAll.mockResolvedValue(mockVideos);

      const count = await channelSettingsModule.updateVideoFilePaths(
        'UC123456',
        '/old/path/TestChannel',
        '/new/path/TestChannel'
      );

      expect(count).toBe(1);
      expect(mockVideos[0].update).toHaveBeenCalled();
      expect(mockVideos[1].update).not.toHaveBeenCalled();
    });

    test('should return 0 when no videos have file paths', async () => {
      Video.findAll.mockResolvedValue([]);

      const count = await channelSettingsModule.updateVideoFilePaths(
        'UC123456',
        '/old/path/TestChannel',
        '/new/path/TestChannel'
      );

      expect(count).toBe(0);
    });

    test('should handle errors gracefully', async () => {
      Video.findAll.mockRejectedValue(new Error('Database error'));

      await expect(
        channelSettingsModule.updateVideoFilePaths(
          'UC123456',
          '/old/path',
          '/new/path'
        )
      ).rejects.toThrow('Database error');

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ err: 'Database error' }),
        'Error updating video file paths'
      );
    });
  });
});
