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

  describe('processChannelThumbnail', () => {
    let originalExtractAvatarThumbnailUrl;
    let originalDownloadChannelThumbnailFromUrl;
    let originalDownloadChannelThumbnailViaYtdlp;
    let originalResizeChannelThumbnail;

    beforeEach(() => {
      originalExtractAvatarThumbnailUrl = channelThumbnails.extractAvatarThumbnailUrl;
      originalDownloadChannelThumbnailFromUrl = channelThumbnails.downloadChannelThumbnailFromUrl;
      originalDownloadChannelThumbnailViaYtdlp = channelThumbnails.downloadChannelThumbnailViaYtdlp;
      originalResizeChannelThumbnail = channelThumbnails.resizeChannelThumbnail;
    });

    afterEach(() => {
      channelThumbnails.extractAvatarThumbnailUrl = originalExtractAvatarThumbnailUrl;
      channelThumbnails.downloadChannelThumbnailFromUrl = originalDownloadChannelThumbnailFromUrl;
      channelThumbnails.downloadChannelThumbnailViaYtdlp = originalDownloadChannelThumbnailViaYtdlp;
      channelThumbnails.resizeChannelThumbnail = originalResizeChannelThumbnail;
    });

    test('should download from URL when avatar thumbnail is found', async () => {
      const channelData = { channel_id: 'UC123', thumbnails: [] };
      const channelId = 'UC123';
      const channelUrl = 'https://www.youtube.com/@testchannel';

      channelThumbnails.extractAvatarThumbnailUrl = jest.fn().mockReturnValue('https://example.com/avatar.jpg');
      channelThumbnails.downloadChannelThumbnailFromUrl = jest.fn().mockResolvedValue();
      channelThumbnails.resizeChannelThumbnail = jest.fn().mockResolvedValue();

      await channelThumbnails.processChannelThumbnail(channelData, channelId, channelUrl);

      expect(channelThumbnails.extractAvatarThumbnailUrl).toHaveBeenCalledWith(channelData);
      expect(channelThumbnails.downloadChannelThumbnailFromUrl).toHaveBeenCalledWith('https://example.com/avatar.jpg', channelId);
      expect(channelThumbnails.resizeChannelThumbnail).toHaveBeenCalledWith(channelId);
    });

    test('should fallback to yt-dlp when URL download fails', async () => {
      const channelData = { channel_id: 'UC123', thumbnails: [] };
      const channelId = 'UC123';
      const channelUrl = 'https://www.youtube.com/@testchannel';

      channelThumbnails.extractAvatarThumbnailUrl = jest.fn().mockReturnValue('https://example.com/avatar.jpg');
      channelThumbnails.downloadChannelThumbnailFromUrl = jest.fn().mockRejectedValue(new Error('Download failed'));
      channelThumbnails.downloadChannelThumbnailViaYtdlp = jest.fn().mockResolvedValue();
      channelThumbnails.resizeChannelThumbnail = jest.fn().mockResolvedValue();

      await channelThumbnails.processChannelThumbnail(channelData, channelId, channelUrl);

      expect(channelThumbnails.downloadChannelThumbnailFromUrl).toHaveBeenCalled();
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
      channelThumbnails.downloadChannelThumbnailFromUrl = jest.fn().mockResolvedValue();
      channelThumbnails.resizeChannelThumbnail = jest.fn().mockResolvedValue();

      await channelThumbnails.processChannelThumbnail(channelData, channelId, channelUrl);

      expect(channelThumbnails.resizeChannelThumbnail).toHaveBeenCalledWith(channelId);
    });
  });

  describe('downloadChannelThumbnailFromUrl', () => {
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

      await channelThumbnails.downloadChannelThumbnailFromUrl('https://example.com/thumb.jpg', 'UC123');

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

      const promise = channelThumbnails.downloadChannelThumbnailFromUrl('https://example.com/thumb.jpg', 'UC123');

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

      const promise = channelThumbnails.downloadChannelThumbnailFromUrl('https://example.com/thumb.jpg', 'UC123');

      const errorHandler = mockRequest.on.mock.calls.find(c => c[0] === 'error')[1];
      errorHandler(new Error('ECONNREFUSED'));

      await expect(promise).rejects.toThrow('ECONNREFUSED');
      expect(mockWriteStream.close).toHaveBeenCalled();
      expect(fsExtra.unlinkSync).toHaveBeenCalled();
    });
  });
});
