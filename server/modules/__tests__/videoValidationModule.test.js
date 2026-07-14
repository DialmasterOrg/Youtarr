/* eslint-env jest */

// Mock tempPathManager before any module that depends on it is loaded
// This prevents configModule's file watcher from starting
jest.mock('../download/tempPathManager', () => ({
  getTempBasePath: jest.fn(() => '/tmp/youtarr-downloads'),
}));

jest.mock('../../models/channelvideo', () => ({
  update: jest.fn().mockResolvedValue([1]),
}));

const videoValidationModule = require('../videoValidationModule');
const ytDlpRunner = require('../ytDlpRunner');
const archiveModule = require('../archiveModule');
const ChannelVideo = require('../../models/channelvideo');
const logger = require('../../logger');

// Mock dependencies
jest.mock('../ytDlpRunner');
jest.mock('../archiveModule');
jest.mock('../../logger');

const isMembersOnlyMessage = (message = '') => {
  const normalized = String(message);
  return [
    /join this channel to get access to members-only content/i,
    /available to this channel'?s members/i,
    /members[- ]only/i,
    /subscriber[_ -]?only/i,
  ].some(pattern => pattern.test(normalized));
};

describe('VideoValidationModule', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    // Clear the module's cache
    videoValidationModule.cache.clear();
    // Clear logger mocks
    logger.debug.mockClear();
    logger.info.mockClear();
    logger.warn.mockClear();
    logger.error.mockClear();
    // Reset ChannelVideo mock
    ChannelVideo.update.mockClear();
    ChannelVideo.update.mockResolvedValue([1]);
    ytDlpRunner.isMembersOnlyError.mockImplementation(isMembersOnlyMessage);
  });

  describe('normalizeUrlToVideoId', () => {
    it('should extract video ID from standard YouTube watch URL', () => {
      const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
      const result = videoValidationModule.normalizeUrlToVideoId(url);
      expect(result.id).toBe('dQw4w9WgXcQ');
      expect(result.canonicalUrl).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    });

    it('should extract video ID from youtu.be short URL', () => {
      const url = 'https://youtu.be/dQw4w9WgXcQ';
      const result = videoValidationModule.normalizeUrlToVideoId(url);
      expect(result.id).toBe('dQw4w9WgXcQ');
      expect(result.canonicalUrl).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    });

    it('should extract video ID from YouTube shorts URL', () => {
      const url = 'https://www.youtube.com/shorts/dQw4w9WgXcQ';
      const result = videoValidationModule.normalizeUrlToVideoId(url);
      expect(result.id).toBe('dQw4w9WgXcQ');
      expect(result.canonicalUrl).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    });

    it('should extract video ID from YouTube embed URL', () => {
      const url = 'https://www.youtube.com/embed/dQw4w9WgXcQ';
      const result = videoValidationModule.normalizeUrlToVideoId(url);
      expect(result.id).toBe('dQw4w9WgXcQ');
      expect(result.canonicalUrl).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    });

    it('should extract video ID from mobile YouTube URL', () => {
      const url = 'https://m.youtube.com/watch?v=dQw4w9WgXcQ';
      const result = videoValidationModule.normalizeUrlToVideoId(url);
      expect(result.id).toBe('dQw4w9WgXcQ');
      expect(result.canonicalUrl).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    });

    it('should extract video ID from YouTube Music URL', () => {
      const url = 'https://music.youtube.com/watch?v=dQw4w9WgXcQ';
      const result = videoValidationModule.normalizeUrlToVideoId(url);
      expect(result.id).toBe('dQw4w9WgXcQ');
      expect(result.canonicalUrl).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    });

    it('should handle URL with additional parameters', () => {
      const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s&list=PLxyz';
      const result = videoValidationModule.normalizeUrlToVideoId(url);
      expect(result.id).toBe('dQw4w9WgXcQ');
      expect(result.canonicalUrl).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    });

    it('should handle URL where v param is not first query parameter', () => {
      const url = 'https://www.youtube.com/watch?si=abc123&pp=someparam&v=dQw4w9WgXcQ';
      const result = videoValidationModule.normalizeUrlToVideoId(url);
      expect(result.id).toBe('dQw4w9WgXcQ');
      expect(result.canonicalUrl).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    });

    it('should handle URL without protocol', () => {
      const url = 'youtube.com/watch?v=dQw4w9WgXcQ';
      const result = videoValidationModule.normalizeUrlToVideoId(url);
      expect(result.id).toBe('dQw4w9WgXcQ');
      expect(result.canonicalUrl).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    });

    it('should throw error for invalid YouTube URL', () => {
      const url = 'https://vimeo.com/123456789';
      expect(() => videoValidationModule.normalizeUrlToVideoId(url))
        .toThrow('Invalid YouTube URL format');
    });

    it('should throw error for empty URL', () => {
      expect(() => videoValidationModule.normalizeUrlToVideoId(''))
        .toThrow('Invalid URL provided');
    });

    it('should throw error for null URL', () => {
      expect(() => videoValidationModule.normalizeUrlToVideoId(null))
        .toThrow('Invalid URL provided');
    });
  });

  describe('toValidationResponse', () => {
    it('should format response correctly for public video', () => {
      const videoId = 'dQw4w9WgXcQ';
      const metadata = {
        title: 'Rick Astley - Never Gonna Give You Up',
        channel: 'RickAstleyVEVO',
        duration: 213,
        upload_date: '20091025',
        availability: 'public'
      };
      const isDuplicate = false;

      const result = videoValidationModule.toValidationResponse(videoId, metadata, isDuplicate);

      expect(result).toEqual({
        isValidUrl: true,
        isAlreadyDownloaded: false,
        isMembersOnly: false,
        metadata: {
          youtubeId: 'dQw4w9WgXcQ',
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          channelName: 'RickAstleyVEVO',
          channelId: null,
          videoTitle: 'Rick Astley - Never Gonna Give You Up',
          duration: 213,
          publishedAt: Math.floor(new Date('2009-10-25').getTime() / 1000),
          availability: 'public',
          media_type: 'video'
        }
      });
    });

    it('should detect members-only videos', () => {
      const videoId = 'test123';
      const metadata = {
        title: 'Members Only Video',
        channel: 'TestChannel',
        duration: 300,
        availability: 'subscriber_only'
      };
      const isDuplicate = false;

      const result = videoValidationModule.toValidationResponse(videoId, metadata, isDuplicate);

      expect(result.isMembersOnly).toBe(true);
    });

    it('should mark duplicates correctly', () => {
      const videoId = 'test123';
      const metadata = {
        title: 'Test Video',
        channel: 'TestChannel',
        duration: 300,
        availability: 'public'
      };
      const isDuplicate = true;

      const result = videoValidationModule.toValidationResponse(videoId, metadata, isDuplicate);

      expect(result.isAlreadyDownloaded).toBe(true);
    });

    it('should handle missing metadata fields', () => {
      const videoId = 'test123';
      const metadata = {};
      const isDuplicate = false;

      const result = videoValidationModule.toValidationResponse(videoId, metadata, isDuplicate);

      expect(result.metadata.channelName).toBe('Unknown');
      expect(result.metadata.videoTitle).toBe('Unknown');
      expect(result.metadata.duration).toBe(0);
      expect(result.metadata.publishedAt).toBe(null);
      expect(result.metadata.availability).toBe('public');
      expect(result.metadata.media_type).toBe('video');
    });
  });

  describe('cache functionality', () => {
    it('should cache responses', () => {
      const videoId = 'test123';
      const response = { isValidUrl: true, test: 'data' };

      videoValidationModule.setCachedResponse(videoId, response);
      const cached = videoValidationModule.getCachedResponse(videoId);

      expect(cached).toEqual(response);
    });

    it('should return null for expired cache', () => {
      const videoId = 'test123';
      const response = { isValidUrl: true, test: 'data' };

      // Set cache with old timestamp
      videoValidationModule.cache.set(videoId, {
        data: response,
        timestamp: Date.now() - (6 * 60 * 1000) // 6 minutes ago
      });

      const cached = videoValidationModule.getCachedResponse(videoId);
      expect(cached).toBeNull();
    });

    it('should clean up cache when it gets too large', () => {
      // Add 101 items to cache
      for (let i = 0; i < 101; i++) {
        videoValidationModule.setCachedResponse(`video${i}`, { test: i });
      }

      // Cache size should still be reasonable after cleanup
      expect(videoValidationModule.cache.size).toBeLessThanOrEqual(101);
    });
  });

  describe('validateVideo', () => {
    it('should validate a valid YouTube URL successfully', async () => {
      const mockMetadata = {
        title: 'Test Video',
        channel: 'TestChannel',
        duration: 300,
        upload_date: '20230101',
        availability: 'public'
      };

      ytDlpRunner.fetchMetadata.mockResolvedValue(mockMetadata);
      archiveModule.isVideoInArchive.mockResolvedValue(false);

      const result = await videoValidationModule.validateVideo('https://www.youtube.com/watch?v=OOUclRI0Ae4');

      expect(result.isValidUrl).toBe(true);
      expect(result.isAlreadyDownloaded).toBe(false);
      expect(result.isMembersOnly).toBe(false);
      expect(result.metadata.youtubeId).toBe('OOUclRI0Ae4');
    });

    it('should use cached response on second call', async () => {
      const mockMetadata = {
        title: 'Test Video',
        channel: 'TestChannel',
        duration: 300,
        availability: 'public'
      };

      ytDlpRunner.fetchMetadata.mockResolvedValue(mockMetadata);
      archiveModule.isVideoInArchive.mockResolvedValue(false);

      // First call
      await videoValidationModule.validateVideo('https://www.youtube.com/watch?v=OOUclRI0Ae4');

      // Second call - should use cache
      const result = await videoValidationModule.validateVideo('https://www.youtube.com/watch?v=OOUclRI0Ae4');

      // fetchMetadata should only be called once
      expect(ytDlpRunner.fetchMetadata).toHaveBeenCalledTimes(1);
      expect(result.isValidUrl).toBe(true);
    });

    it('should handle invalid URL format', async () => {
      const result = await videoValidationModule.validateVideo('not-a-youtube-url');

      expect(result.isValidUrl).toBe(false);
      expect(result.error).toBe('Invalid YouTube URL format');
    });

    it('should handle timeout errors', async () => {
      ytDlpRunner.fetchMetadata.mockRejectedValue(new Error('Failed to fetch video metadata: Request timed out'));

      const result = await videoValidationModule.validateVideo('https://www.youtube.com/watch?v=OOUclRI0Ae4');

      expect(result.isValidUrl).toBe(false);
      expect(result.error).toBe('Request timed out. Please try again.');
    });

    it('should handle unavailable videos', async () => {
      ytDlpRunner.fetchMetadata.mockRejectedValue(new Error('Video unavailable'));

      const result = await videoValidationModule.validateVideo('https://www.youtube.com/watch?v=OOUclRI0Ae4');

      expect(result.isValidUrl).toBe(false);
      expect(result.error).toBe('Video is unavailable or has been removed');
    });

    it('should handle generic errors', async () => {
      ytDlpRunner.fetchMetadata.mockRejectedValue(new Error('Some random error'));

      const result = await videoValidationModule.validateVideo('https://www.youtube.com/watch?v=OOUclRI0Ae4');

      expect(result.isValidUrl).toBe(false);
      expect(result.error).toBe('Some random error');
    });

    it('should detect already downloaded videos', async () => {
      const mockMetadata = {
        title: 'Test Video',
        channel: 'TestChannel',
        duration: 300,
        availability: 'public'
      };

      ytDlpRunner.fetchMetadata.mockResolvedValue(mockMetadata);
      archiveModule.isVideoInArchive.mockResolvedValue(true);

      const result = await videoValidationModule.validateVideo('https://www.youtube.com/watch?v=OOUclRI0Ae4');

      expect(result.isValidUrl).toBe(true);
      expect(result.isAlreadyDownloaded).toBe(true);
    });

    it('should detect members-only videos', async () => {
      const mockMetadata = {
        title: 'Members Only',
        channel: 'TestChannel',
        duration: 300,
        availability: 'subscriber_only'
      };

      ytDlpRunner.fetchMetadata.mockResolvedValue(mockMetadata);
      archiveModule.isVideoInArchive.mockResolvedValue(false);

      const result = await videoValidationModule.validateVideo('https://www.youtube.com/watch?v=OOUclRI0Ae4');

      expect(result.isValidUrl).toBe(true);
      expect(result.isMembersOnly).toBe(true);
    });

    it('should backfill ChannelVideo.availability on fresh fetch path', async () => {
      const mockMetadata = {
        title: 'Members Only',
        channel: 'TestChannel',
        duration: 300,
        availability: 'subscriber_only'
      };

      ytDlpRunner.fetchMetadata.mockResolvedValue(mockMetadata);
      archiveModule.isVideoInArchive.mockResolvedValue(false);

      await videoValidationModule.validateVideo('https://www.youtube.com/watch?v=OOUclRI0Ae4');

      expect(ChannelVideo.update).toHaveBeenCalledWith(
        { availability: 'subscriber_only' },
        { where: { youtube_id: 'OOUclRI0Ae4' } },
      );
    });

    it('should not backfill defaulted public availability when yt-dlp omits availability', async () => {
      const mockMetadata = {
        title: 'No Availability',
        channel: 'TestChannel',
        duration: 300,
      };

      ytDlpRunner.fetchMetadata.mockResolvedValue(mockMetadata);
      archiveModule.isVideoInArchive.mockResolvedValue(false);

      const result = await videoValidationModule.validateVideo('https://www.youtube.com/watch?v=OOUclRI0Ae4');

      expect(result.metadata.availability).toBe('public');
      expect(ChannelVideo.update).not.toHaveBeenCalled();
    });

    it('should not repeat ChannelVideo.availability backfill on cache hit path', async () => {
      const mockMetadata = {
        title: 'Test Video',
        channel: 'TestChannel',
        duration: 300,
        availability: 'public'
      };

      ytDlpRunner.fetchMetadata.mockResolvedValue(mockMetadata);
      archiveModule.isVideoInArchive.mockResolvedValue(false);

      // First call populates cache and triggers one update
      await videoValidationModule.validateVideo('https://www.youtube.com/watch?v=OOUclRI0Ae4');
      expect(ChannelVideo.update).toHaveBeenCalledTimes(1);

      // Second call hits cache; the original miss already stamped availability.
      await videoValidationModule.validateVideo('https://www.youtube.com/watch?v=OOUclRI0Ae4');
      expect(ChannelVideo.update).toHaveBeenCalledTimes(1);
    });

    it('should backfill ChannelVideo.availability on members-only error catch path', async () => {
      ytDlpRunner.fetchMetadata.mockRejectedValue(
        new Error('ERROR: [youtube] OOUclRI0Ae4: Join this channel to get access to members-only content')
      );

      const result = await videoValidationModule.validateVideo('https://www.youtube.com/watch?v=OOUclRI0Ae4');

      expect(result.isMembersOnly).toBe(true);
      expect(ChannelVideo.update).toHaveBeenCalledWith(
        { availability: 'subscriber_only' },
        { where: { youtube_id: 'OOUclRI0Ae4' } },
      );
    });
  });

  describe('channelId capture', () => {
    it('includes the channel_id from yt-dlp metadata as channelId', async () => {
      ytDlpRunner.fetchMetadata.mockResolvedValue({
        title: 'Test Video',
        channel: 'Test Channel',
        duration: 100,
        channel_id: 'UCuAXFkgsw1L7xaCfnd5JJOw',
      });
      archiveModule.isVideoInArchive.mockResolvedValue(false);

      const result = await videoValidationModule.validateVideo('https://www.youtube.com/watch?v=dQw4w9WgXcQ');

      expect(result.isValidUrl).toBe(true);
      expect(result.metadata.channelId).toBe('UCuAXFkgsw1L7xaCfnd5JJOw');
    });

    it('returns channelId null when yt-dlp metadata has no channel_id', async () => {
      ytDlpRunner.fetchMetadata.mockResolvedValue({
        title: 'Test Video',
        duration: 100,
      });
      archiveModule.isVideoInArchive.mockResolvedValue(false);

      const result = await videoValidationModule.validateVideo('https://www.youtube.com/watch?v=dQw4w9WgXcQ');

      expect(result.metadata.channelId).toBeNull();
    });

    it('getCachedChannelId returns the cached channelId, and null on a miss', async () => {
      ytDlpRunner.fetchMetadata.mockResolvedValue({
        title: 'Test Video',
        duration: 100,
        channel_id: 'UCuAXFkgsw1L7xaCfnd5JJOw',
      });
      archiveModule.isVideoInArchive.mockResolvedValue(false);

      await videoValidationModule.validateVideo('https://www.youtube.com/watch?v=dQw4w9WgXcQ');

      expect(videoValidationModule.getCachedChannelId('dQw4w9WgXcQ')).toBe('UCuAXFkgsw1L7xaCfnd5JJOw');
      expect(videoValidationModule.getCachedChannelId('aaaaaaaaaaa')).toBeNull();
    });
  });

  describe('_persistAvailabilityFromResponse', () => {
    it('should call ChannelVideo.update when response has youtubeId and availability', () => {
      videoValidationModule._persistAvailabilityFromResponse({
        metadata: { youtubeId: 'abc12345678', availability: 'subscriber_only', availabilityProvided: true },
      });

      expect(ChannelVideo.update).toHaveBeenCalledWith(
        { availability: 'subscriber_only' },
        { where: { youtube_id: 'abc12345678' } },
      );
    });

    it('should be a no-op when response has no metadata', () => {
      videoValidationModule._persistAvailabilityFromResponse({});
      videoValidationModule._persistAvailabilityFromResponse(null);
      videoValidationModule._persistAvailabilityFromResponse(undefined);

      expect(ChannelVideo.update).not.toHaveBeenCalled();
    });

    it('should be a no-op when youtubeId is missing', () => {
      videoValidationModule._persistAvailabilityFromResponse({
        metadata: { availability: 'public' },
      });

      expect(ChannelVideo.update).not.toHaveBeenCalled();
    });

    it('should be a no-op when availability was defaulted', () => {
      videoValidationModule._persistAvailabilityFromResponse({
        metadata: { youtubeId: 'abc12345678', availability: 'public' },
      });

      expect(ChannelVideo.update).not.toHaveBeenCalled();
    });

    it('should be a no-op when availability is missing', () => {
      videoValidationModule._persistAvailabilityFromResponse({
        metadata: { youtubeId: 'abc12345678' },
      });

      expect(ChannelVideo.update).not.toHaveBeenCalled();
    });

    it('should swallow update errors and log a warning', async () => {
      ChannelVideo.update.mockRejectedValueOnce(new Error('db down'));

      // The helper itself doesn't await; we have to wait a tick for the
      // rejection handler to run.
      videoValidationModule._persistAvailabilityFromResponse({
        metadata: { youtubeId: 'errvid1', availability: 'subscriber_only', availabilityProvided: true },
      });
      await new Promise(resolve => setImmediate(resolve));

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ videoId: 'errvid1' }),
        'Failed to backfill ChannelVideo.availability from validation',
      );
    });
  });

  describe('logger integration', () => {
    it('should log debug message when fetching metadata', async () => {
      const mockMetadata = {
        title: 'Test Video',
        channel: 'TestChannel',
        duration: 300,
        availability: 'public'
      };

      ytDlpRunner.fetchMetadata.mockResolvedValue(mockMetadata);
      archiveModule.isVideoInArchive.mockResolvedValue(false);

      await videoValidationModule.validateVideo('https://www.youtube.com/watch?v=OOUclRI0Ae4');

      expect(logger.debug).toHaveBeenCalledWith(
        { videoId: 'OOUclRI0Ae4' },
        'Fetching metadata for video'
      );
    });

    it('should log debug message when using cached response', async () => {
      const mockMetadata = {
        title: 'Test Video',
        channel: 'TestChannel',
        duration: 300,
        availability: 'public'
      };

      ytDlpRunner.fetchMetadata.mockResolvedValue(mockMetadata);
      archiveModule.isVideoInArchive.mockResolvedValue(false);

      // First call to populate cache
      await videoValidationModule.validateVideo('https://www.youtube.com/watch?v=OOUclRI0Ae4');

      // Clear mocks before second call
      logger.debug.mockClear();

      // Second call should use cache
      await videoValidationModule.validateVideo('https://www.youtube.com/watch?v=OOUclRI0Ae4');

      expect(logger.debug).toHaveBeenCalledWith(
        { videoId: 'OOUclRI0Ae4' },
        'Using cached response for video, checking current archive status'
      );
    });

    it('should log error when fetchMetadata fails', async () => {
      const error = new Error('Network error');
      ytDlpRunner.fetchMetadata.mockRejectedValue(error);

      await videoValidationModule.validateVideo('https://www.youtube.com/watch?v=OOUclRI0Ae4');

      expect(logger.error).toHaveBeenCalledWith(
        { err: error, url: 'https://www.youtube.com/watch?v=OOUclRI0Ae4' },
        'Error fetching video metadata'
      );
    });

    it('should log warning when archive check fails', async () => {
      const mockMetadata = {
        title: 'Test Video',
        channel: 'TestChannel',
        duration: 300,
        availability: 'public'
      };
      const archiveError = new Error('Database error');

      ytDlpRunner.fetchMetadata.mockResolvedValue(mockMetadata);
      archiveModule.isVideoInArchive.mockRejectedValue(archiveError);

      await videoValidationModule.validateVideo('https://www.youtube.com/watch?v=OOUclRI0Ae4');

      expect(logger.warn).toHaveBeenCalledWith(
        { err: archiveError, videoId: 'OOUclRI0Ae4' },
        'Error checking archive, assuming video is not duplicate'
      );
    });
  });

  describe('fetchVideoMetadata', () => {
    it('should fetch metadata successfully', async () => {
      const mockMetadata = {
        title: 'Test Video',
        channel: 'TestChannel',
        duration: 300
      };
      const url = 'https://www.youtube.com/watch?v=test123';

      ytDlpRunner.fetchMetadata.mockResolvedValue(mockMetadata);

      const result = await videoValidationModule.fetchVideoMetadata(url);

      expect(result).toEqual(mockMetadata);
      expect(ytDlpRunner.fetchMetadata).toHaveBeenCalledWith(url, 60000);
    });

    it('should log error and rethrow when fetch fails', async () => {
      const error = new Error('Failed to fetch');
      const url = 'https://www.youtube.com/watch?v=test123';

      ytDlpRunner.fetchMetadata.mockRejectedValue(error);

      await expect(videoValidationModule.fetchVideoMetadata(url)).rejects.toThrow('Failed to fetch');

      expect(logger.error).toHaveBeenCalledWith(
        { err: error, url },
        'Error fetching video metadata'
      );
    });
  });

  describe('isDuplicate', () => {
    it('should return true when video is in archive', async () => {
      archiveModule.isVideoInArchive.mockResolvedValue(true);

      const result = await videoValidationModule.isDuplicate('test123');

      expect(result).toBe(true);
      expect(archiveModule.isVideoInArchive).toHaveBeenCalledWith('test123');
    });

    it('should return false when video is not in archive', async () => {
      archiveModule.isVideoInArchive.mockResolvedValue(false);

      const result = await videoValidationModule.isDuplicate('test123');

      expect(result).toBe(false);
    });

    it('should log warning and return false when archive check fails', async () => {
      const error = new Error('Database connection failed');
      archiveModule.isVideoInArchive.mockRejectedValue(error);

      const result = await videoValidationModule.isDuplicate('test123');

      expect(result).toBe(false);
      expect(logger.warn).toHaveBeenCalledWith(
        { err: error, videoId: 'test123' },
        'Error checking archive, assuming video is not duplicate'
      );
    });
  });
});
