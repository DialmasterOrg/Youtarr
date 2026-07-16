/* eslint-env jest */

const mockFactories = require('./mockFactories');

jest.mock('fs');
jest.mock('child_process');
jest.mock('uuid');
jest.mock('../../../logger');
jest.mock('../../../models/channel', () => mockFactories.mockChannelModel());
jest.mock('../../configModule', () => mockFactories.mockConfigModule());
jest.mock('../../filesystem', () => mockFactories.mockFilesystem());
jest.mock('../../youtubeApi', () => mockFactories.mockYoutubeApi());

describe('channelMetadataFetcher', () => {
  let channelMetadataFetcher;
  let fs;
  let childProcess;
  let uuid;
  let logger;
  let Channel;
  let filesystem;
  let youtubeApi;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    fs = require('fs');
    fs.readFileSync = jest.fn().mockReturnValue('');
    fs.writeFileSync = jest.fn();
    fs.existsSync = jest.fn().mockReturnValue(false);
    fs.copySync = jest.fn();
    fs.createWriteStream = jest.fn().mockReturnValue({
      on: jest.fn(),
      write: jest.fn(),
      end: jest.fn()
    });
    fs.promises = {
      readFile: jest.fn(),
      writeFile: jest.fn(),
      unlink: jest.fn(),
      rename: jest.fn()
    };

    childProcess = require('child_process');
    childProcess.spawn = jest.fn();
    childProcess.execSync = jest.fn();

    uuid = require('uuid');
    uuid.v4.mockReturnValue('test-uuid-1234');

    logger = require('../../../logger');

    Channel = require('../../../models/channel');
    Channel.findOne.mockResolvedValue(null);

    filesystem = require('../../filesystem');

    youtubeApi = require('../../youtubeApi');
    youtubeApi.isAvailable.mockReturnValue(false);
    youtubeApi.getApiKey.mockReturnValue(null);

    channelMetadataFetcher = require('../channelMetadataFetcher');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('resolveChannelFolderName', () => {
    let originalFetchChannelMetadata;

    beforeEach(() => {
      // Store original method so we can mock it per-test
      originalFetchChannelMetadata = channelMetadataFetcher.fetchChannelMetadata;
    });

    afterEach(() => {
      // Restore original method
      channelMetadataFetcher.fetchChannelMetadata = originalFetchChannelMetadata;
    });

    test('should return folder_name when available (fast path)', async () => {
      const channel = {
        channel_id: 'UC123',
        folder_name: 'Sanitized Channel Name',
        uploader: 'Original Uploader Name'
      };

      // Mock fetchChannelMetadata to verify it's not called
      const mockFetchChannelMetadata = jest.fn();
      channelMetadataFetcher.fetchChannelMetadata = mockFetchChannelMetadata;

      const result = await channelMetadataFetcher.resolveChannelFolderName(channel);

      expect(result).toBe('Sanitized Channel Name');
      // Should not call fetchChannelMetadata when folder_name exists
      expect(mockFetchChannelMetadata).not.toHaveBeenCalled();
    });

    test('should call fetchChannelMetadata and save result when folder_name is null', async () => {
      const channel = {
        channel_id: 'UC123',
        folder_name: null,
        uploader: 'Original Uploader'
      };

      // Mock fetchChannelMetadata to return folder_name
      channelMetadataFetcher.fetchChannelMetadata = jest.fn().mockResolvedValue({
        uploader: 'Channel Uploader',
        folder_name: 'Sanitized Folder Name'
      });

      Channel.update.mockResolvedValue([1]);

      const result = await channelMetadataFetcher.resolveChannelFolderName(channel);

      expect(result).toBe('Sanitized Folder Name');
      expect(channelMetadataFetcher.fetchChannelMetadata).toHaveBeenCalledWith(
        'https://www.youtube.com/channel/UC123'
      );
      expect(Channel.update).toHaveBeenCalledWith(
        { folder_name: 'Sanitized Folder Name' },
        { where: { channel_id: 'UC123' } }
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ channelId: 'UC123', folderName: 'Sanitized Folder Name' }),
        'Populated folder_name via yt-dlp fallback'
      );
    });

    test('should fallback to uploader when fetchChannelMetadata fails', async () => {
      const channel = {
        channel_id: 'UC123',
        folder_name: null,
        uploader: 'Fallback Uploader Name'
      };

      // Mock fetchChannelMetadata failing
      channelMetadataFetcher.fetchChannelMetadata = jest.fn().mockRejectedValue(new Error('yt-dlp failed'));

      // Mock sanitizeNameLikeYtDlp to return the uploader as-is for this test
      filesystem.sanitizeNameLikeYtDlp.mockReturnValue('Fallback Uploader Name');

      const result = await channelMetadataFetcher.resolveChannelFolderName(channel);

      expect(result).toBe('Fallback Uploader Name');
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ channelId: 'UC123', uploader: 'Fallback Uploader Name' }),
        'Could not determine folder_name via yt-dlp, using uploader as fallback'
      );
    });

    test('should handle empty string folder_name as missing', async () => {
      const channel = {
        channel_id: 'UC123',
        folder_name: '', // Empty string should be treated as falsy
        uploader: 'Fallback Uploader'
      };

      // Mock fetchChannelMetadata failing to trigger fallback
      channelMetadataFetcher.fetchChannelMetadata = jest.fn().mockRejectedValue(new Error('yt-dlp failed'));

      // Mock sanitizeNameLikeYtDlp to return the uploader as-is for this test
      filesystem.sanitizeNameLikeYtDlp.mockReturnValue('Fallback Uploader');

      const result = await channelMetadataFetcher.resolveChannelFolderName(channel);

      // Empty string is falsy, so should try fetchChannelMetadata and fall back to uploader
      expect(result).toBe('Fallback Uploader');
      expect(channelMetadataFetcher.fetchChannelMetadata).toHaveBeenCalled();
    });

    test('should continue even if database update fails', async () => {
      const channel = {
        channel_id: 'UC123',
        folder_name: null,
        uploader: 'Original Uploader'
      };

      // Mock successful fetchChannelMetadata
      channelMetadataFetcher.fetchChannelMetadata = jest.fn().mockResolvedValue({
        uploader: 'Channel Uploader',
        folder_name: 'Sanitized Name'
      });

      // Mock database update failing
      Channel.update.mockRejectedValue(new Error('Database error'));

      const result = await channelMetadataFetcher.resolveChannelFolderName(channel);

      // Should still return the folder name even if DB update fails
      expect(result).toBe('Sanitized Name');
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ channelId: 'UC123' }),
        'Failed to save folder_name to database'
      );
    });

    test('should fallback to uploader when fetchChannelMetadata returns no folder_name', async () => {
      const channel = {
        channel_id: 'UC123',
        folder_name: null,
        uploader: 'Fallback Name'
      };

      // Mock fetchChannelMetadata returning metadata without folder_name
      channelMetadataFetcher.fetchChannelMetadata = jest.fn().mockResolvedValue({
        uploader: 'Channel Uploader',
        folder_name: null
      });

      // Mock sanitizeNameLikeYtDlp
      filesystem.sanitizeNameLikeYtDlp.mockReturnValue('Fallback Name');

      const result = await channelMetadataFetcher.resolveChannelFolderName(channel);

      expect(result).toBe('Fallback Name');
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ channelId: 'UC123', uploader: 'Fallback Name' }),
        'Could not determine folder_name via yt-dlp, using uploader as fallback'
      );
    });
  });

  describe('fetchChannelMetadata - API-first path', () => {
    test('uses API when available and returns yt-dlp-shaped metadata with entries', async () => {
      youtubeApi.isAvailable.mockReturnValue(true);
      youtubeApi.getApiKey.mockReturnValue('key');
      youtubeApi.client.getChannelInfo.mockResolvedValue({
        channelId: 'UCxxx',
        title: 'My Channel',
        description: 'desc',
        customUrl: '@my',
        uploadsPlaylistId: 'UUxxx',
        videoCount: 42,
        thumbnailUrl: 'https://yt3.ggpht.com/a',
      });

      const result = await channelMetadataFetcher.fetchChannelMetadata('https://www.youtube.com/@my');

      expect(result).toMatchObject({
        channel_id: 'UCxxx',
        title: 'My Channel',
        description: 'desc',
        uploader: 'My Channel',
        uploads_playlist_id: 'UUxxx',
        folder_name: 'My Channel',
      });
      // Caller checks entries.length > 0 to reject empty channels - a channel
      // with uploads must synthesize a non-empty entries array.
      expect(Array.isArray(result.entries)).toBe(true);
      expect(result.entries.length).toBeGreaterThan(0);
      expect(childProcess.spawn).not.toHaveBeenCalled();
    });

    test('returns empty entries when API reports videoCount=0', async () => {
      youtubeApi.isAvailable.mockReturnValue(true);
      youtubeApi.getApiKey.mockReturnValue('key');
      youtubeApi.client.getChannelInfo.mockResolvedValue({
        channelId: 'UCxxx',
        title: 'Empty Channel',
        description: '',
        customUrl: '@empty',
        uploadsPlaylistId: 'UUxxx',
        videoCount: 0,
        thumbnailUrl: null,
      });

      const result = await channelMetadataFetcher.fetchChannelMetadata('https://www.youtube.com/@empty');

      expect(result.entries).toEqual([]);
    });

    test('assumes entries when videoCount is null (owner hid count)', async () => {
      youtubeApi.isAvailable.mockReturnValue(true);
      youtubeApi.getApiKey.mockReturnValue('key');
      youtubeApi.client.getChannelInfo.mockResolvedValue({
        channelId: 'UCxxx',
        title: 'Hidden Count',
        description: '',
        customUrl: '@hidden',
        uploadsPlaylistId: 'UUxxx',
        videoCount: null,
        thumbnailUrl: null,
      });

      const result = await channelMetadataFetcher.fetchChannelMetadata('https://www.youtube.com/@hidden');

      expect(result.entries.length).toBeGreaterThan(0);
    });

    test('falls back to yt-dlp silently when API throws', async () => {
      youtubeApi.isAvailable.mockReturnValue(true);
      youtubeApi.getApiKey.mockReturnValue('key');
      const apiErr = new Error('boom');
      apiErr.name = 'YoutubeApiError';
      apiErr.code = 'QUOTA_EXCEEDED';
      youtubeApi.client.getChannelInfo.mockRejectedValue(apiErr);

      // Expect the yt-dlp fallback path to try to spawn. The spawn mock will stay
      // in its default (no-op) state which will cause yt-dlp to hang; we catch the error.
      // For this test we only need to verify that (a) API was called and (b) logger warned.
      await channelMetadataFetcher.fetchChannelMetadata('https://www.youtube.com/@my').catch(() => {});

      expect(youtubeApi.client.getChannelInfo).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'QUOTA_EXCEEDED' }),
        expect.stringContaining('falling back to yt-dlp')
      );
    });

    test('does not call API when key is unavailable', async () => {
      // default: isAvailable returns false
      await channelMetadataFetcher.fetchChannelMetadata('https://www.youtube.com/@my').catch(() => {});
      expect(youtubeApi.client.getChannelInfo).not.toHaveBeenCalled();
    });
  });
});
