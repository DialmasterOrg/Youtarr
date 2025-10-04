/* eslint-env jest */

const videoValidationModule = require('../videoValidationModule');
const ytDlpRunner = require('../ytDlpRunner');
const archiveModule = require('../archiveModule');

// Mock dependencies
jest.mock('../ytDlpRunner');
jest.mock('../archiveModule');

describe('VideoValidationModule', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    // Clear the module's cache
    videoValidationModule.cache.clear();
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
  });
});
