/* eslint-env jest */

const realHttps = require('https');
const mockFactories = require('./mockFactories');

jest.mock('fs');
jest.mock('child_process');
jest.mock('../../../logger');
jest.mock('../../configModule', () => mockFactories.mockConfigModule());
jest.mock('../../filesystem', () => mockFactories.mockFilesystem());

describe('channelThumbnails', () => {
  let channelThumbnails;
  let fs;
  let logger;

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

    logger = require('../../../logger');

    channelThumbnails = require('../channelThumbnails');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('extractAvatarThumbnailUrl', () => {
    test('should return null when thumbnails is not an array', () => {
      const channelData = { channel_id: 'UC123', thumbnails: null };
      const result = channelThumbnails.extractAvatarThumbnailUrl(channelData);
      expect(result).toBeNull();
    });

    test('should return null when thumbnails is undefined', () => {
      const channelData = { channel_id: 'UC123' };
      const result = channelThumbnails.extractAvatarThumbnailUrl(channelData);
      expect(result).toBeNull();
    });

    test('should prefer 900x900 thumbnail', () => {
      const channelData = {
        channel_id: 'UC123',
        thumbnails: [
          { url: 'https://example.com/small.jpg', width: 100, height: 100 },
          { url: 'https://example.com/large.jpg', width: 900, height: 900 },
          { url: 'https://example.com/avatar.jpg', id: 'avatar_uncropped' }
        ]
      };
      const result = channelThumbnails.extractAvatarThumbnailUrl(channelData);
      expect(result).toBe('https://example.com/large.jpg');
    });

    test('should fallback to any square thumbnail', () => {
      const channelData = {
        channel_id: 'UC123',
        thumbnails: [
          { url: 'https://example.com/square.jpg', width: 200, height: 200 },
          { url: 'https://example.com/avatar.jpg', id: 'avatar_uncropped' }
        ]
      };
      const result = channelThumbnails.extractAvatarThumbnailUrl(channelData);
      expect(result).toBe('https://example.com/square.jpg');
    });

    test('should fallback to avatar_uncropped as last resort', () => {
      const channelData = {
        channel_id: 'UC123',
        thumbnails: [
          { url: 'https://example.com/non-square.jpg', width: 100, height: 200 },
          { url: 'https://example.com/avatar.jpg', id: 'avatar_uncropped' }
        ]
      };
      const result = channelThumbnails.extractAvatarThumbnailUrl(channelData);
      expect(result).toBe('https://example.com/avatar.jpg');
    });

    test('should return null when no suitable thumbnail found', () => {
      const channelData = {
        channel_id: 'UC123',
        thumbnails: [
          { url: 'https://example.com/non-square.jpg', width: 100, height: 200 }
        ]
      };
      const result = channelThumbnails.extractAvatarThumbnailUrl(channelData);
      expect(result).toBeNull();
    });

    test('should return null when thumbnails array is empty', () => {
      const channelData = { channel_id: 'UC123', thumbnails: [] };
      const result = channelThumbnails.extractAvatarThumbnailUrl(channelData);
      expect(result).toBeNull();
    });
  });

  describe('extractBannerThumbnailUrl', () => {
    test('returns the banner_uncropped url', () => {
      const channelData = {
        channel_id: 'UC123',
        thumbnails: [
          { url: 'https://example.com/avatar.jpg', id: 'avatar_uncropped' },
          { url: 'https://example.com/banner.jpg', id: 'banner_uncropped' }
        ]
      };
      expect(channelThumbnails.extractBannerThumbnailUrl(channelData)).toBe('https://example.com/banner.jpg');
    });

    test('returns null when thumbnails is not an array', () => {
      expect(channelThumbnails.extractBannerThumbnailUrl({ channel_id: 'UC123', thumbnails: null })).toBeNull();
    });

    test('returns null when no banner_uncropped entry exists', () => {
      const channelData = {
        channel_id: 'UC123',
        thumbnails: [{ url: 'https://example.com/avatar.jpg', id: 'avatar_uncropped' }]
      };
      expect(channelThumbnails.extractBannerThumbnailUrl(channelData)).toBeNull();
    });
  });

  describe('processChannelBanner', () => {
    let originalDownloadImageToFile;

    beforeEach(() => {
      originalDownloadImageToFile = channelThumbnails.downloadImageToFile;
    });

    afterEach(() => {
      channelThumbnails.downloadImageToFile = originalDownloadImageToFile;
    });

    test('downloads the banner to the channelbanner cache filename', async () => {
      channelThumbnails.downloadImageToFile = jest.fn().mockResolvedValue();
      await channelThumbnails.processChannelBanner({
        channel_id: 'UC123',
        thumbnails: [{ id: 'banner_uncropped', url: 'https://example.com/banner.jpg' }]
      }, 'UC123');
      expect(channelThumbnails.downloadImageToFile).toHaveBeenCalledWith(
        'https://example.com/banner.jpg',
        'channelbanner-UC123.jpg'
      );
    });

    test('skips download when metadata has no banner', async () => {
      channelThumbnails.downloadImageToFile = jest.fn().mockResolvedValue();
      await channelThumbnails.processChannelBanner({ channel_id: 'UC123', thumbnails: [] }, 'UC123');
      expect(channelThumbnails.downloadImageToFile).not.toHaveBeenCalled();
    });

    test('logs a warning and resolves when the download fails', async () => {
      channelThumbnails.downloadImageToFile = jest.fn().mockRejectedValue(new Error('boom'));
      await expect(channelThumbnails.processChannelBanner({
        channel_id: 'UC123',
        thumbnails: [{ id: 'banner_uncropped', url: 'https://example.com/banner.jpg' }]
      }, 'UC123')).resolves.toBeUndefined();
      expect(logger.warn).toHaveBeenCalled();
    });
  });

  describe('processChannelThumbnail', () => {
    let originalExtractAvatarThumbnailUrl;
    let originalDownloadImageToFile;
    let originalDownloadChannelThumbnailViaYtdlp;
    let originalResizeChannelThumbnail;

    beforeEach(() => {
      originalExtractAvatarThumbnailUrl = channelThumbnails.extractAvatarThumbnailUrl;
      originalDownloadImageToFile = channelThumbnails.downloadImageToFile;
      originalDownloadChannelThumbnailViaYtdlp = channelThumbnails.downloadChannelThumbnailViaYtdlp;
      originalResizeChannelThumbnail = channelThumbnails.resizeChannelThumbnail;
    });

    afterEach(() => {
      channelThumbnails.extractAvatarThumbnailUrl = originalExtractAvatarThumbnailUrl;
      channelThumbnails.downloadImageToFile = originalDownloadImageToFile;
      channelThumbnails.downloadChannelThumbnailViaYtdlp = originalDownloadChannelThumbnailViaYtdlp;
      channelThumbnails.resizeChannelThumbnail = originalResizeChannelThumbnail;
    });

    test('should download from URL when avatar thumbnail is found', async () => {
      const channelData = { channel_id: 'UC123', thumbnails: [] };
      const channelId = 'UC123';
      const channelUrl = 'https://www.youtube.com/@testchannel';

      channelThumbnails.extractAvatarThumbnailUrl = jest.fn().mockReturnValue('https://example.com/avatar.jpg');
      channelThumbnails.downloadImageToFile = jest.fn().mockResolvedValue();
      channelThumbnails.resizeChannelThumbnail = jest.fn().mockResolvedValue();

      await channelThumbnails.processChannelThumbnail(channelData, channelId, channelUrl);

      expect(channelThumbnails.extractAvatarThumbnailUrl).toHaveBeenCalledWith(channelData);
      expect(channelThumbnails.downloadImageToFile).toHaveBeenCalledWith('https://example.com/avatar.jpg', 'channelthumb-UC123.jpg');
      expect(channelThumbnails.resizeChannelThumbnail).toHaveBeenCalledWith(channelId);
    });

    test('should fallback to yt-dlp when URL download fails', async () => {
      const channelData = { channel_id: 'UC123', thumbnails: [] };
      const channelId = 'UC123';
      const channelUrl = 'https://www.youtube.com/@testchannel';

      channelThumbnails.extractAvatarThumbnailUrl = jest.fn().mockReturnValue('https://example.com/avatar.jpg');
      channelThumbnails.downloadImageToFile = jest.fn().mockRejectedValue(new Error('Download failed'));
      channelThumbnails.downloadChannelThumbnailViaYtdlp = jest.fn().mockResolvedValue();
      channelThumbnails.resizeChannelThumbnail = jest.fn().mockResolvedValue();

      await channelThumbnails.processChannelThumbnail(channelData, channelId, channelUrl);

      expect(channelThumbnails.downloadImageToFile).toHaveBeenCalled();
      expect(channelThumbnails.downloadChannelThumbnailViaYtdlp).toHaveBeenCalledWith(channelUrl);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ channelId }),
        'Failed to download thumbnail via HTTP, falling back to yt-dlp'
      );
    });

    test('should use yt-dlp when no avatar thumbnail URL found', async () => {
      const channelData = { channel_id: 'UC123', thumbnails: [] };
      const channelId = 'UC123';
      const channelUrl = 'https://www.youtube.com/@testchannel';

      channelThumbnails.extractAvatarThumbnailUrl = jest.fn().mockReturnValue(null);
      channelThumbnails.downloadChannelThumbnailViaYtdlp = jest.fn().mockResolvedValue();
      channelThumbnails.resizeChannelThumbnail = jest.fn().mockResolvedValue();

      await channelThumbnails.processChannelThumbnail(channelData, channelId, channelUrl);

      expect(channelThumbnails.downloadChannelThumbnailViaYtdlp).toHaveBeenCalledWith(channelUrl);
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ channelId }),
        'No avatar thumbnail URL found in metadata, using yt-dlp'
      );
    });

    test('should always call resizeChannelThumbnail at the end', async () => {
      const channelData = { channel_id: 'UC123', thumbnails: [] };
      const channelId = 'UC123';
      const channelUrl = 'https://www.youtube.com/@testchannel';

      channelThumbnails.extractAvatarThumbnailUrl = jest.fn().mockReturnValue('https://example.com/avatar.jpg');
      channelThumbnails.downloadImageToFile = jest.fn().mockResolvedValue();
      channelThumbnails.resizeChannelThumbnail = jest.fn().mockResolvedValue();

      await channelThumbnails.processChannelThumbnail(channelData, channelId, channelUrl);

      expect(channelThumbnails.resizeChannelThumbnail).toHaveBeenCalledWith(channelId);
    });
  });

  describe('downloadImageToFile', () => {
    let fsExtra;
    let mockWriteStream;
    let mockRequest;
    let mockResponse;
    let originalGet;
    let originalCreateWriteStream;

    beforeEach(() => {
      originalGet = realHttps.get;
      fsExtra = require('fs-extra');
      originalCreateWriteStream = fsExtra.createWriteStream;

      mockWriteStream = {
        on: jest.fn(),
        close: jest.fn(),
      };
      fsExtra.createWriteStream = jest.fn().mockReturnValue(mockWriteStream);

      mockRequest = {
        on: jest.fn().mockReturnThis(),
        destroy: jest.fn(),
      };

      mockResponse = {
        statusCode: 200,
        pipe: jest.fn(),
        headers: {},
      };
    });

    afterEach(() => {
      realHttps.get = originalGet;
      fsExtra.createWriteStream = originalCreateWriteStream;
    });

    test('should pass timeout option to protocol.get', async () => {
      realHttps.get = jest.fn((url, opts, cb) => {
        cb(mockResponse);
        const finishCb = mockWriteStream.on.mock.calls.find(c => c[0] === 'finish')[1];
        finishCb();
        return mockRequest;
      });

      await channelThumbnails.downloadImageToFile('https://example.com/thumb.jpg', 'channelthumb-UC123.jpg');

      expect(realHttps.get).toHaveBeenCalledWith(
        'https://example.com/thumb.jpg',
        expect.objectContaining({ timeout: 15000 }),
        expect.any(Function)
      );
    });

    test('should reject and clean up partial file on timeout', async () => {
      fsExtra.existsSync = jest.fn().mockReturnValue(true);
      fsExtra.unlinkSync = jest.fn();

      realHttps.get = jest.fn(() => {
        return mockRequest;
      });

      const promise = channelThumbnails.downloadImageToFile('https://example.com/thumb.jpg', 'channelthumb-UC123.jpg');

      const timeoutHandler = mockRequest.on.mock.calls.find(c => c[0] === 'timeout')[1];
      timeoutHandler();

      await expect(promise).rejects.toThrow('Thumbnail download timed out');
      expect(mockRequest.destroy).toHaveBeenCalled();
      expect(mockWriteStream.close).toHaveBeenCalled();
      expect(fsExtra.unlinkSync).toHaveBeenCalled();
    });

    test('should reject on network error and clean up', async () => {
      fsExtra.existsSync = jest.fn().mockReturnValue(true);
      fsExtra.unlinkSync = jest.fn();

      realHttps.get = jest.fn(() => {
        return mockRequest;
      });

      const promise = channelThumbnails.downloadImageToFile('https://example.com/thumb.jpg', 'channelthumb-UC123.jpg');

      const errorHandler = mockRequest.on.mock.calls.find(c => c[0] === 'error')[1];
      errorHandler(new Error('ECONNREFUSED'));

      await expect(promise).rejects.toThrow('ECONNREFUSED');
      expect(mockWriteStream.close).toHaveBeenCalled();
      expect(fsExtra.unlinkSync).toHaveBeenCalled();
    });
  });
});
