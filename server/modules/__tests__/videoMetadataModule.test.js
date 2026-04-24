/* eslint-env jest */

describe('VideoMetadataModule', () => {
  let videoMetadataModule;
  let mockFs;
  let mockVideo;
  let mockLogger;
  let mockConfigModule;
  let mockYtDlpRunner;
  let mockYoutubeApi;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    mockFs = {
      access: jest.fn(),
      readFile: jest.fn(),
      writeFile: jest.fn(),
      mkdir: jest.fn(),
      stat: jest.fn(),
      readdir: jest.fn(),
    };

    mockVideo = {
      findOne: jest.fn(),
      findAll: jest.fn(),
      findByPk: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    };

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      trace: jest.fn(),
      fatal: jest.fn(),
    };

    mockConfigModule = {
      directoryPath: '/test/data',
      getJobsPath: jest.fn().mockReturnValue('/test/jobs'),
    };

    mockYtDlpRunner = {
      fetchMetadata: jest.fn(),
    };

    mockYoutubeApi = {
      isAvailable: jest.fn(() => false),
      getApiKey: jest.fn(() => null),
      client: {
        getVideoMetadata: jest.fn(),
      },
      YoutubeApiErrorCode: { QUOTA_EXCEEDED: 'QUOTA_EXCEEDED' },
    };

    jest.doMock('fs', () => ({ promises: mockFs }));
    jest.doMock('../../models', () => ({ Video: mockVideo }));
    jest.doMock('../configModule', () => mockConfigModule);
    jest.doMock('../../logger', () => mockLogger);
    jest.doMock('../ytDlpRunner', () => mockYtDlpRunner);
    jest.doMock('../youtubeApi', () => mockYoutubeApi);

    videoMetadataModule = require('../videoMetadataModule');
  });

  describe('getVideoMetadata', () => {
    test('returns curated metadata from cached .info.json file', async () => {
      const rawInfoJson = {
        description: 'A great video',
        view_count: 12345,
        like_count: 100,
        comment_count: 50,
        tags: ['test', 'video'],
        categories: ['Entertainment'],
        upload_date: '20240315',
        resolution: '1920x1080',
        height: 1080,
        width: 1920,
        aspect_ratio: 1.78,
        fps: 30,
        language: 'en',
        is_live: false,
        was_live: false,
        availability: 'public',
        channel_follower_count: 5000,
        age_limit: 0,
        webpage_url: 'https://www.youtube.com/watch?v=abc123',
        // These bulk fields should NOT appear in output
        formats: [{ format_id: '137' }],
        automatic_captions: { en: [] },
        thumbnails: [{ url: 'http://example.com/thumb.jpg' }],
      };

      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(JSON.stringify(rawInfoJson));
      mockVideo.findOne.mockResolvedValue({
        youtubeId: 'abc123',
        originalDate: '20240315',
        update: jest.fn(),
      });

      const result = await videoMetadataModule.getVideoMetadata('abc123');

      expect(result.description).toBe('A great video');
      expect(result.viewCount).toBe(12345);
      expect(result.likeCount).toBe(100);
      expect(result.commentCount).toBe(50);
      expect(result.tags).toEqual(['test', 'video']);
      expect(result.categories).toEqual(['Entertainment']);
      expect(result.uploadDate).toBe('20240315');
      expect(result.resolution).toBe('1920x1080');
      expect(result.fps).toBe(30);
      expect(result.aspectRatio).toBe(1.78);
      expect(result.language).toBe('en');
      expect(result.isLive).toBe(false);
      expect(result.wasLive).toBe(false);
      expect(result.availability).toBe('public');
      expect(result.channelFollowerCount).toBe(5000);
      expect(result.ageLimit).toBe(0);
      expect(result.webpageUrl).toBe('https://www.youtube.com/watch?v=abc123');

      // Bulk arrays should NOT be in result
      expect(result.formats).toBeUndefined();
      expect(result.automatic_captions).toBeUndefined();
      expect(result.thumbnails).toBeUndefined();
    });

    test('fetches from yt-dlp when cached file does not exist', async () => {
      const ytdlpData = {
        description: 'Fetched description',
        view_count: 999,
        like_count: 10,
        upload_date: '20240101',
        resolution: '1280x720',
        height: 720,
        width: 1280,
        aspect_ratio: 1.78,
      };

      // fs.access rejects (file not found)
      mockFs.access.mockRejectedValue(new Error('ENOENT'));
      mockYtDlpRunner.fetchMetadata.mockResolvedValue(ytdlpData);
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);
      mockVideo.findOne.mockResolvedValue(null);

      const result = await videoMetadataModule.getVideoMetadata('xyz789');

      expect(mockYtDlpRunner.fetchMetadata).toHaveBeenCalledWith(
        'https://www.youtube.com/watch?v=xyz789',
        60000
      );
      expect(result.description).toBe('Fetched description');
      expect(result.viewCount).toBe(999);
      expect(result.resolution).toBe('1280x720');

      // Should have cached the result
      expect(mockFs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('info'),
        { recursive: true }
      );
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    test('returns all-null metadata when yt-dlp also fails', async () => {
      mockFs.access.mockRejectedValue(new Error('ENOENT'));
      mockYtDlpRunner.fetchMetadata.mockRejectedValue(new Error('yt-dlp failed'));

      const result = await videoMetadataModule.getVideoMetadata('fail123');

      expect(result.description).toBeNull();
      expect(result.viewCount).toBeNull();
      expect(result.resolution).toBeNull();
      expect(result.webpageUrl).toBeNull();
    });

    test('backfills originalDate when DB record has no date', async () => {
      const rawInfoJson = {
        upload_date: '20240515',
        description: 'test',
      };

      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(JSON.stringify(rawInfoJson));

      const mockVideoRecord = {
        youtubeId: 'backfill1',
        originalDate: null,
        update: jest.fn().mockResolvedValue(undefined),
      };
      mockVideo.findOne.mockResolvedValue(mockVideoRecord);

      await videoMetadataModule.getVideoMetadata('backfill1');

      expect(mockVideoRecord.update).toHaveBeenCalledWith({ originalDate: '20240515' });
    });

    test('backfills originalDate when DB record has different date', async () => {
      const rawInfoJson = {
        upload_date: '20240515',
        description: 'test',
      };

      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(JSON.stringify(rawInfoJson));

      const mockVideoRecord = {
        youtubeId: 'backfill2',
        originalDate: '20240514',
        update: jest.fn().mockResolvedValue(undefined),
      };
      mockVideo.findOne.mockResolvedValue(mockVideoRecord);

      await videoMetadataModule.getVideoMetadata('backfill2');

      expect(mockVideoRecord.update).toHaveBeenCalledWith({ originalDate: '20240515' });
    });

    test('does not backfill when dates match', async () => {
      const rawInfoJson = {
        upload_date: '20240515',
        description: 'test',
      };

      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(JSON.stringify(rawInfoJson));

      const mockVideoRecord = {
        youtubeId: 'nobackfill',
        originalDate: '20240515',
        update: jest.fn(),
      };
      mockVideo.findOne.mockResolvedValue(mockVideoRecord);

      await videoMetadataModule.getVideoMetadata('nobackfill');

      expect(mockVideoRecord.update).not.toHaveBeenCalled();
    });

    test('handles missing optional fields gracefully', async () => {
      const rawInfoJson = {
        description: 'minimal video',
        // Most fields are missing
      };

      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(JSON.stringify(rawInfoJson));

      const result = await videoMetadataModule.getVideoMetadata('minimal1');

      expect(result.description).toBe('minimal video');
      expect(result.viewCount).toBeNull();
      expect(result.likeCount).toBeNull();
      expect(result.resolution).toBeNull();
      expect(result.aspectRatio).toBeNull();
      expect(result.fps).toBeNull();
      expect(result.language).toBeNull();
    });

    test('caching failure does not prevent metadata return', async () => {
      const ytdlpData = {
        description: 'Should still return',
        view_count: 42,
      };

      mockFs.access.mockRejectedValue(new Error('ENOENT'));
      mockYtDlpRunner.fetchMetadata.mockResolvedValue(ytdlpData);
      mockFs.mkdir.mockRejectedValue(new Error('Permission denied'));

      const result = await videoMetadataModule.getVideoMetadata('cachefail1');

      expect(result.description).toBe('Should still return');
      expect(result.viewCount).toBe(42);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ youtubeId: 'cachefail1' }),
        'Failed to cache .info.json'
      );
    });
  });

  describe('_extractAvailableResolutions', () => {
    test('extracts supported resolutions from formats with video+audio streams', () => {
      const formats = [
        { height: 360, vcodec: 'avc1', acodec: 'mp4a' },
        { height: 720, vcodec: 'avc1', acodec: 'mp4a' },
        { height: 1080, vcodec: 'avc1', acodec: 'mp4a' },
      ];

      const result = videoMetadataModule._extractAvailableResolutions(formats);

      expect(result).toEqual([360, 720, 1080]);
    });

    test('excludes audio-only streams (vcodec is none)', () => {
      const formats = [
        { height: 720, vcodec: 'avc1', acodec: 'mp4a' },
        { height: null, vcodec: 'none', acodec: 'mp4a' },
        { height: 0, vcodec: 'none', acodec: 'opus' },
      ];

      const result = videoMetadataModule._extractAvailableResolutions(formats);

      expect(result).toEqual([720]);
    });

    test('deduplicates heights', () => {
      const formats = [
        { height: 1080, vcodec: 'avc1', acodec: 'mp4a' },
        { height: 1080, vcodec: 'vp9', acodec: 'opus' },
        { height: 1080, vcodec: 'av01', acodec: 'mp4a' },
        { height: 720, vcodec: 'avc1', acodec: 'mp4a' },
      ];

      const result = videoMetadataModule._extractAvailableResolutions(formats);

      expect(result).toEqual([720, 1080]);
    });

    test('returns null for empty array', () => {
      const result = videoMetadataModule._extractAvailableResolutions([]);

      expect(result).toBeNull();
    });

    test('returns null for null input', () => {
      const result = videoMetadataModule._extractAvailableResolutions(null);

      expect(result).toBeNull();
    });

    test('returns null for undefined input', () => {
      const result = videoMetadataModule._extractAvailableResolutions(undefined);

      expect(result).toBeNull();
    });

    test('returns null when no formats have supported heights', () => {
      const formats = [
        { height: 144, vcodec: 'avc1', acodec: 'mp4a' },
        { height: 240, vcodec: 'avc1', acodec: 'mp4a' },
      ];

      const result = videoMetadataModule._extractAvailableResolutions(formats);

      expect(result).toBeNull();
    });

    test('returns sorted resolutions', () => {
      const formats = [
        { height: 2160, vcodec: 'vp9', acodec: 'opus' },
        { height: 360, vcodec: 'avc1', acodec: 'mp4a' },
        { height: 1440, vcodec: 'vp9', acodec: 'opus' },
        { height: 480, vcodec: 'avc1', acodec: 'mp4a' },
      ];

      const result = videoMetadataModule._extractAvailableResolutions(formats);

      expect(result).toEqual([360, 480, 1440, 2160]);
    });

    test('uses format_note tier for non-16:9 videos (actual height differs from tier)', () => {
      // 2:1 aspect video: actual heights are half the width, but tier labels match standard buckets
      const formats = [
        { height: 320, format_note: '360p', vcodec: 'avc1', acodec: 'mp4a' },
        { height: 428, format_note: '480p', vcodec: 'avc1', acodec: 'mp4a' },
        { height: 640, format_note: '720p', vcodec: 'avc1', acodec: 'mp4a' },
        { height: 960, format_note: '1080p', vcodec: 'avc1', acodec: 'mp4a' },
      ];

      const result = videoMetadataModule._extractAvailableResolutions(formats);

      expect(result).toEqual([360, 480, 720, 1080]);
    });

    test('format_note with framerate suffix still extracts base tier', () => {
      const formats = [
        { height: 1080, format_note: '1080p60', vcodec: 'avc1', acodec: 'mp4a' },
        { height: 720, format_note: '720p60', vcodec: 'avc1', acodec: 'mp4a' },
      ];

      const result = videoMetadataModule._extractAvailableResolutions(formats);

      expect(result).toEqual([720, 1080]);
    });
  });

  describe('_extractTierFromFormatNote', () => {
    test('parses plain tier like "1080p"', () => {
      expect(videoMetadataModule._extractTierFromFormatNote('1080p')).toBe(1080);
    });

    test('parses tier with framerate like "1080p60"', () => {
      expect(videoMetadataModule._extractTierFromFormatNote('1080p60')).toBe(1080);
    });

    test('parses tier with audio suffix like "1080p+medium"', () => {
      expect(videoMetadataModule._extractTierFromFormatNote('1080p+medium')).toBe(1080);
    });

    test('returns null for null, undefined, or empty input', () => {
      expect(videoMetadataModule._extractTierFromFormatNote(null)).toBeNull();
      expect(videoMetadataModule._extractTierFromFormatNote(undefined)).toBeNull();
      expect(videoMetadataModule._extractTierFromFormatNote('')).toBeNull();
    });

    test('returns null when string does not start with a tier', () => {
      expect(videoMetadataModule._extractTierFromFormatNote('medium')).toBeNull();
      expect(videoMetadataModule._extractTierFromFormatNote('high quality')).toBeNull();
    });
  });

  describe('_getVideoRelatedFiles', () => {
    test('returns related files with correct categorization', async () => {
      mockVideo.findOne.mockResolvedValue({
        youtubeId: 'rel123',
        filePath: '/data/channel/My Video [rel123].mp4',
        audioFilePath: null,
      });

      mockFs.readdir.mockResolvedValue([
        'My Video [rel123].mp4',
        'My Video [rel123].jpg',
        'My Video [rel123].nfo',
        'My Video [rel123].info.json',
        'Other Video [other1].mp4',
      ]);

      mockFs.stat
        .mockResolvedValueOnce({ size: 50000 })   // .jpg
        .mockResolvedValueOnce({ size: 1200 })     // .nfo
        .mockResolvedValueOnce({ size: 85000 });   // .info.json

      const result = await videoMetadataModule._getVideoRelatedFiles('rel123');

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ fileName: 'My Video [rel123].jpg', fileSize: 50000, type: 'Thumbnail' });
      expect(result[1]).toEqual({ fileName: 'My Video [rel123].nfo', fileSize: 1200, type: 'NFO Metadata' });
      expect(result[2]).toEqual({ fileName: 'My Video [rel123].info.json', fileSize: 85000, type: 'Info JSON' });
    });

    test('does not include filePath in results', async () => {
      mockVideo.findOne.mockResolvedValue({
        youtubeId: 'nopath1',
        filePath: '/data/channel/Video [nopath1].mp4',
        audioFilePath: null,
      });

      mockFs.readdir.mockResolvedValue([
        'Video [nopath1].mp4',
        'Video [nopath1].jpg',
      ]);

      mockFs.stat.mockResolvedValueOnce({ size: 1000 });

      const result = await videoMetadataModule._getVideoRelatedFiles('nopath1');

      expect(result).toHaveLength(1);
      expect(result[0].filePath).toBeUndefined();
      expect(result[0].fileName).toBe('Video [nopath1].jpg');
    });

    test('excludes main video and audio files', async () => {
      mockVideo.findOne.mockResolvedValue({
        youtubeId: 'excl1',
        filePath: '/data/channel/Video [excl1].mp4',
        audioFilePath: '/data/channel/Video [excl1].mp3',
      });

      mockFs.readdir.mockResolvedValue([
        'Video [excl1].mp4',
        'Video [excl1].mp3',
        'Video [excl1].jpg',
      ]);

      mockFs.stat.mockResolvedValueOnce({ size: 2000 });

      const result = await videoMetadataModule._getVideoRelatedFiles('excl1');

      expect(result).toHaveLength(1);
      expect(result[0].fileName).toBe('Video [excl1].jpg');
    });

    test('returns null when video not found in database', async () => {
      mockVideo.findOne.mockResolvedValue(null);

      const result = await videoMetadataModule._getVideoRelatedFiles('missing1');

      expect(result).toBeNull();
    });

    test('returns null when video has no filePath', async () => {
      mockVideo.findOne.mockResolvedValue({
        youtubeId: 'nofp1',
        filePath: null,
      });

      const result = await videoMetadataModule._getVideoRelatedFiles('nofp1');

      expect(result).toBeNull();
    });

    test('returns null when directory does not exist', async () => {
      mockVideo.findOne.mockResolvedValue({
        youtubeId: 'nodir1',
        filePath: '/data/missing-channel/Video [nodir1].mp4',
        audioFilePath: null,
      });

      mockFs.readdir.mockRejectedValue(new Error('ENOENT: no such file or directory'));

      const result = await videoMetadataModule._getVideoRelatedFiles('nodir1');

      expect(result).toBeNull();
    });

    test('returns null when no matching related files exist', async () => {
      mockVideo.findOne.mockResolvedValue({
        youtubeId: 'nomatch1',
        filePath: '/data/channel/Video [nomatch1].mp4',
        audioFilePath: null,
      });

      mockFs.readdir.mockResolvedValue([
        'Video [nomatch1].mp4',
        'Other Video [other1].jpg',
        'unrelated-file.txt',
      ]);

      const result = await videoMetadataModule._getVideoRelatedFiles('nomatch1');

      expect(result).toBeNull();
    });

    test('matches files using " - youtubeId" pattern', async () => {
      mockVideo.findOne.mockResolvedValue({
        youtubeId: 'dash1',
        filePath: '/data/channel/Video - dash1.mp4',
        audioFilePath: null,
      });

      mockFs.readdir.mockResolvedValue([
        'Video - dash1.mp4',
        'Video - dash1.srt',
      ]);

      mockFs.stat.mockResolvedValueOnce({ size: 500 });

      const result = await videoMetadataModule._getVideoRelatedFiles('dash1');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ fileName: 'Video - dash1.srt', fileSize: 500, type: 'Subtitles' });
    });

    test('handles stat failure for individual files gracefully', async () => {
      mockVideo.findOne.mockResolvedValue({
        youtubeId: 'statfail1',
        filePath: '/data/channel/Video [statfail1].mp4',
        audioFilePath: null,
      });

      mockFs.readdir.mockResolvedValue([
        'Video [statfail1].mp4',
        'Video [statfail1].jpg',
        'Video [statfail1].nfo',
      ]);

      // First stat call fails, second succeeds
      mockFs.stat
        .mockRejectedValueOnce(new Error('ENOENT'))
        .mockResolvedValueOnce({ size: 800 });

      const result = await videoMetadataModule._getVideoRelatedFiles('statfail1');

      expect(result).toHaveLength(1);
      expect(result[0].fileName).toBe('Video [statfail1].nfo');
    });
  });

  describe('getVideoMetadata - API-first path', () => {
    test('uses yt-dlp when API is unavailable (unchanged legacy behavior)', async () => {
      // isAvailable returns false in default beforeEach setup
      mockFs.access.mockRejectedValueOnce(new Error('not cached'));
      mockYtDlpRunner.fetchMetadata.mockResolvedValueOnce({});
      mockFs.mkdir.mockResolvedValueOnce(undefined);
      mockFs.writeFile.mockResolvedValueOnce(undefined);

      await videoMetadataModule.getVideoMetadata('abc12345678');

      expect(mockYoutubeApi.client.getVideoMetadata).not.toHaveBeenCalled();
    });

    test('uses API when available and returns normalized result', async () => {
      mockYoutubeApi.isAvailable.mockReturnValue(true);
      mockYoutubeApi.getApiKey.mockReturnValue('test-key');
      mockYoutubeApi.client.getVideoMetadata.mockResolvedValueOnce([{
        id: 'abc12345678',
        title: 'From API',
        description: 'desc',
        duration: 300,
        viewCount: 10,
        likeCount: 2,
        commentCount: 1,
        uploadDate: '20240101',
        channelId: 'UCxxx',
        channelTitle: 'Chan',
        tags: ['t'],
        categories: ['22'],
        availability: 'public',
        liveBroadcastContent: 'none',
      }]);
      mockVideo.findOne.mockResolvedValueOnce(null);

      const result = await videoMetadataModule.getVideoMetadata('abc12345678');

      expect(mockYoutubeApi.client.getVideoMetadata).toHaveBeenCalledWith('test-key', ['abc12345678']);
      expect(result).toMatchObject({
        description: 'desc',
        viewCount: 10,
        likeCount: 2,
        commentCount: 1,
        uploadDate: '20240101',
        tags: ['t'],
        categories: ['22'],
        availability: 'public',
      });
      expect(mockYtDlpRunner.fetchMetadata).not.toHaveBeenCalled();
    });

    test('falls back to yt-dlp silently when API throws', async () => {
      mockYoutubeApi.isAvailable.mockReturnValue(true);
      mockYoutubeApi.getApiKey.mockReturnValue('test-key');
      const apiErr = new Error('boom');
      apiErr.name = 'YoutubeApiError';
      apiErr.code = 'QUOTA_EXCEEDED';
      mockYoutubeApi.client.getVideoMetadata.mockRejectedValueOnce(apiErr);

      // yt-dlp fallback path: no cached .info.json, fetch fresh
      mockFs.access.mockRejectedValueOnce(new Error('not cached'));
      mockYtDlpRunner.fetchMetadata.mockResolvedValueOnce({ description: 'from yt-dlp' });
      mockFs.mkdir.mockResolvedValueOnce(undefined);
      mockFs.writeFile.mockResolvedValueOnce(undefined);

      const result = await videoMetadataModule.getVideoMetadata('abc12345678');

      expect(mockYoutubeApi.client.getVideoMetadata).toHaveBeenCalledTimes(1);
      expect(mockYtDlpRunner.fetchMetadata).toHaveBeenCalledTimes(1);
      expect(result.description).toBe('from yt-dlp');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'QUOTA_EXCEEDED' }),
        expect.stringContaining('falling back to yt-dlp')
      );
    });

    test('backfills originalDate from API uploadDate when DB has no date', async () => {
      mockYoutubeApi.isAvailable.mockReturnValue(true);
      mockYoutubeApi.getApiKey.mockReturnValue('test-key');
      mockYoutubeApi.client.getVideoMetadata.mockResolvedValueOnce([{
        id: 'abc12345678',
        uploadDate: '20240101',
        availability: 'public',
      }]);
      const updateMock = jest.fn();
      mockVideo.findOne.mockResolvedValueOnce({ originalDate: null, update: updateMock });

      await videoMetadataModule.getVideoMetadata('abc12345678');

      expect(updateMock).toHaveBeenCalledWith({ originalDate: '20240101' });
    });
  });
});
