/* eslint-env jest */

jest.mock('../../../logger');

describe('videoEntryParser', () => {
  let videoEntryParser;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    videoEntryParser = require('../videoEntryParser');
  });

  describe('extractVideosFromYtDlpResponse', () => {
    test('parses a real degraded flat-playlist response (timestamp: null) preserving order', () => {
      // Captured from a live YouTube degraded response: every entry has
      // timestamp: null but the order is still newest-first.
      const fixture = require('../../__tests__/fixtures/flat-playlist-dateless.json');

      const videos = videoEntryParser.extractVideosFromYtDlpResponse(fixture);

      expect(videos).toHaveLength(fixture.entries.length);
      expect(videos.map(v => v.youtube_id)).toEqual(fixture.entries.map(e => e.id));
      for (const video of videos) {
        expect(video.publishedAt).toBeNull();
        expect(video.title).toBeTruthy();
      }
    });
  });

  describe('extractPublishedDate', () => {
    test('should extract date from timestamp', () => {
      const entry = { timestamp: 1704067200 };

      const result = videoEntryParser.extractPublishedDate(entry);

      expect(result).toBe('2024-01-01T00:00:00.000Z');
    });

    test('should extract date from upload_date', () => {
      const entry = { upload_date: '20240115' };

      const result = videoEntryParser.extractPublishedDate(entry);

      expect(result).toBe('2024-01-15T00:00:00.000Z');
    });

    test('should return null when no date info available', () => {
      const entry = {};

      const result = videoEntryParser.extractPublishedDate(entry);

      expect(result).toBeNull();
    });

    test('should extract date from release_timestamp', () => {
      const entry = { release_timestamp: 1704067200 };

      const result = videoEntryParser.extractPublishedDate(entry);

      expect(result).toBe('2024-01-01T00:00:00.000Z');
    });
  });

  describe('extractThumbnailUrl', () => {
    test('should use thumbnail field if available', () => {
      const entry = {
        id: 'video123',
        thumbnail: 'https://custom.thumbnail.url/image.jpg'
      };

      const result = videoEntryParser.extractThumbnailUrl(entry);

      expect(result).toBe('https://custom.thumbnail.url/image.jpg');
    });

    test('should select medium thumbnail from array', () => {
      const entry = {
        id: 'video123',
        thumbnails: [
          { id: 'small', url: 'https://small.jpg' },
          { id: 'medium', url: 'https://medium.jpg' },
          { id: 'large', url: 'https://large.jpg' }
        ]
      };

      const result = videoEntryParser.extractThumbnailUrl(entry);

      expect(result).toBe('https://medium.jpg');
    });

    test('should use last thumbnail if no medium found', () => {
      const entry = {
        id: 'video123',
        thumbnails: [
          { id: 'small', url: 'https://small.jpg' },
          { id: 'large', url: 'https://large.jpg' }
        ]
      };

      const result = videoEntryParser.extractThumbnailUrl(entry);

      expect(result).toBe('https://large.jpg');
    });

    test('should construct YouTube thumbnail URL from video ID', () => {
      const entry = { id: 'video123' };

      const result = videoEntryParser.extractThumbnailUrl(entry);

      expect(result).toBe('https://i.ytimg.com/vi/video123/mqdefault.jpg');
    });

    test('should return empty string when no data available', () => {
      const entry = {};

      const result = videoEntryParser.extractThumbnailUrl(entry);

      expect(result).toBe('');
    });
  });

  describe('parseVideoMetadata', () => {
    test('should parse video metadata correctly', () => {
      const entry = {
        id: 'video123',
        title: 'Test Video',
        duration: 300,
        timestamp: 1704067200,
        thumbnail: 'https://thumb.jpg',
        availability: 'public',
        live_status: 'not_live'
      };

      const result = videoEntryParser.parseVideoMetadata(entry);

      expect(result).toEqual({
        title: 'Test Video',
        youtube_id: 'video123',
        publishedAt: '2024-01-01T00:00:00.000Z',
        thumbnail: 'https://thumb.jpg',
        duration: 300,
        media_type: 'video',
        availability: 'public',
        live_status: 'not_live'
      });
    });

    test('should handle missing fields with defaults', () => {
      const entry = {
        id: 'video123'
      };

      const result = videoEntryParser.parseVideoMetadata(entry);

      expect(result).toEqual({
        title: 'Untitled',
        youtube_id: 'video123',
        publishedAt: null,
        thumbnail: 'https://i.ytimg.com/vi/video123/mqdefault.jpg',
        duration: 0,
        media_type: 'video',
        availability: null,
        live_status: null
      });
    });

    test('should include live_status field when provided', () => {
      const entry = {
        id: 'video123',
        title: 'Live Stream',
        live_status: 'was_live'
      };

      const result = videoEntryParser.parseVideoMetadata(entry);

      expect(result.live_status).toBe('was_live');
    });
  });
});
