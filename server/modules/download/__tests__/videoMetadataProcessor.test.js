/* eslint-env jest */

const fs = require('fs');
const path = require('path');

// Mock dependencies - must be done before requiring the module
jest.mock('fs');
jest.mock('../../../logger');
jest.mock('../../configModule', () => ({
  getJobsPath: jest.fn(),
  directoryPath: '/output/directory'
}));

// Set up fs.promises mock before requiring the module
fs.promises = {
  stat: jest.fn(),
  readdir: jest.fn()
};

const VideoMetadataProcessor = require('../videoMetadataProcessor');
const configModule = require('../../configModule');
const logger = require('../../../logger');

const createDirent = (name, { directory = false, file = false } = {}) => ({
  name,
  isDirectory: () => directory,
  isFile: () => file
});

describe('VideoMetadataProcessor', () => {
  const mockJobsPath = '/jobs/path';

  beforeEach(() => {
    jest.clearAllMocks();
    configModule.getJobsPath.mockReturnValue(mockJobsPath);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('normalizeChannelName', () => {
    it('should return empty string for null or undefined', () => {
      expect(VideoMetadataProcessor.normalizeChannelName(null)).toBe('');
      expect(VideoMetadataProcessor.normalizeChannelName(undefined)).toBe('');
    });

    it('should return empty string for empty input', () => {
      expect(VideoMetadataProcessor.normalizeChannelName('')).toBe('');
      expect(VideoMetadataProcessor.normalizeChannelName('  ')).toBe('');
      expect(VideoMetadataProcessor.normalizeChannelName('\t\n')).toBe('');
    });

    it('should return empty string for NA or N/A variations', () => {
      expect(VideoMetadataProcessor.normalizeChannelName('NA')).toBe('');
      expect(VideoMetadataProcessor.normalizeChannelName('na')).toBe('');
      expect(VideoMetadataProcessor.normalizeChannelName('N/A')).toBe('');
      expect(VideoMetadataProcessor.normalizeChannelName('n/a')).toBe('');
      expect(VideoMetadataProcessor.normalizeChannelName('N/a')).toBe('');
      expect(VideoMetadataProcessor.normalizeChannelName('  NA  ')).toBe('');
      expect(VideoMetadataProcessor.normalizeChannelName('  n/a  ')).toBe('');
    });

    it('should trim and return valid channel names', () => {
      expect(VideoMetadataProcessor.normalizeChannelName('  Test Channel  ')).toBe('Test Channel');
      expect(VideoMetadataProcessor.normalizeChannelName('ValidChannel')).toBe('ValidChannel');
      expect(VideoMetadataProcessor.normalizeChannelName('\tSpaced\tChannel\t')).toBe('Spaced\tChannel');
    });

    it('should handle non-string values by converting to string', () => {
      expect(VideoMetadataProcessor.normalizeChannelName(123)).toBe('123');
      expect(VideoMetadataProcessor.normalizeChannelName(true)).toBe('true');
      expect(VideoMetadataProcessor.normalizeChannelName(false)).toBe(''); // false converts to empty string
    });

    it('should handle special characters in channel names', () => {
      expect(VideoMetadataProcessor.normalizeChannelName('Channel @123')).toBe('Channel @123');
      expect(VideoMetadataProcessor.normalizeChannelName('Test_Channel-2024')).toBe('Test_Channel-2024');
      expect(VideoMetadataProcessor.normalizeChannelName('🎮 Gaming Channel')).toBe('🎮 Gaming Channel');
    });

    it('should not treat "NAME" or "CHANNEL" as invalid', () => {
      expect(VideoMetadataProcessor.normalizeChannelName('NAME')).toBe('NAME');
      expect(VideoMetadataProcessor.normalizeChannelName('CHANNEL')).toBe('CHANNEL');
      expect(VideoMetadataProcessor.normalizeChannelName('Nathan')).toBe('Nathan');
    });
  });

  describe('processVideoMetadata', () => {
    const mockVideoData = {
      id: 'abc123',
      uploader: 'Test Channel',
      channel: 'Test Channel Official',
      uploader_id: 'testchannel',
      channel_id: 'UC123456',
      title: 'Test Video Title',
      duration: 300,
      description: 'Test video description',
      upload_date: '20240101',
      _actual_filepath: '/output/directory/Test Channel/Test Channel - Test Video Title - abc123/Test Channel - Test Video Title [abc123].mp4'
    };

    // Clear mocks before each test
    beforeEach(() => {
      jest.clearAllMocks();
      configModule.getJobsPath.mockReturnValue(mockJobsPath);
      configModule.directoryPath = '/output/directory';
      // Reset the fs.promises.stat mock
      fs.promises.stat.mockReset();
      fs.promises.readdir.mockReset();
      fs.promises.readdir.mockResolvedValue([]);
    });

    it('should process single video URL successfully with file metadata', async () => {
      const newVideoUrls = ['https://youtu.be/abc123'];
      const videoData = {
        ...mockVideoData,
        id: 'abc123',
        title: 'Test Video Title',
        _actual_filepath: '/output/directory/Test Channel/Test Channel - Test Video Title - abc123/Test Channel - Test Video Title [abc123].mp4'
      };
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify(videoData));
      // Mock successful stat for the .mp4 file
      fs.promises.stat.mockResolvedValue({ size: 1024000 });

      const result = await VideoMetadataProcessor.processVideoMetadata(newVideoUrls);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        youtubeId: 'abc123',
        youTubeChannelName: 'Test Channel',
        youTubeVideoName: 'Test Video Title',
        duration: 300,
        description: 'Test video description',
        originalDate: '20240101',
        channel_id: 'UC123456',
        media_type: 'video',
        content_rating: null,
        age_limit: null,
        normalized_rating: null,
        rating_source: null,
        filePath: '/output/directory/Test Channel/Test Channel - Test Video Title - abc123/Test Channel - Test Video Title [abc123].mp4',
        fileSize: '1024000',
        audioFilePath: null,
        audioFileSize: null,
        removed: false
      });

      expect(fs.existsSync).toHaveBeenCalledWith(
        path.join(mockJobsPath, 'info/abc123.info.json')
      );
    });

    it('should use actual filepath from yt-dlp when available', async () => {
      const newVideoUrls = ['https://youtu.be/actual123'];
      const mockDataWithActualPath = {
        ...mockVideoData,
        id: 'actual123',
        title: 'Video With | Special: Characters',
        _actual_filepath: '/output/directory/Harry Mack/Harry Mack - Video With ｜ Special： Characters - actual123/Harry Mack - Video With ｜ Special： Characters [actual123].mp4'
      };
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify(mockDataWithActualPath));
      fs.promises.stat.mockResolvedValue({ size: 1024000 });

      const result = await VideoMetadataProcessor.processVideoMetadata(newVideoUrls);

      expect(result).toHaveLength(1);
      // Should use the actual filepath instead of calculating it
      expect(result[0].filePath).toBe(mockDataWithActualPath._actual_filepath);
      expect(fs.promises.stat).toHaveBeenCalledWith(mockDataWithActualPath._actual_filepath);
    });

    it('should sanitize special characters in video titles and channel names', async () => {
      const newVideoUrls = ['https://youtu.be/pipe123'];
      const mockDataWithPipe = {
        ...mockVideoData,
        id: 'pipe123',
        title: 'Video | With Pipe: Test',
        uploader: 'Channel/Name'
      };
      delete mockDataWithPipe._actual_filepath;
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify(mockDataWithPipe));
      fs.promises.stat.mockResolvedValue({ size: 1024000 });
      fs.promises.readdir.mockImplementation((dirPath) => {
        if (dirPath === '/output/directory') {
          return Promise.resolve([createDirent('Channel／Name', { directory: true })]);
        }
        if (dirPath === '/output/directory/Channel／Name') {
          return Promise.resolve([
            createDirent('Channel／Name - Video ｜ With Pipe： Test - pipe123', { directory: true })
          ]);
        }
        if (dirPath === '/output/directory/Channel／Name/Channel／Name - Video ｜ With Pipe： Test - pipe123') {
          return Promise.resolve([
            createDirent('Channel／Name - Video ｜ With Pipe： Test [pipe123].mp4', { file: true })
          ]);
        }
        return Promise.resolve([]);
      });

      const result = await VideoMetadataProcessor.processVideoMetadata(newVideoUrls);

      expect(result).toHaveLength(1);
      expect(result[0].filePath).toBe('/output/directory/Channel／Name/Channel／Name - Video ｜ With Pipe： Test - pipe123/Channel／Name - Video ｜ With Pipe： Test [pipe123].mp4');
    });

    it('should warn when video path cannot be located and continue gracefully', async () => {
      const newVideoUrls = ['https://youtu.be/missingpath'];
      const dataWithoutPath = {
        ...mockVideoData,
        id: 'missingpath'
      };
      delete dataWithoutPath._actual_filepath;
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify(dataWithoutPath));

      const result = await VideoMetadataProcessor.processVideoMetadata(newVideoUrls);

      expect(result).toHaveLength(1);
      expect(result[0].filePath).toBeNull();
      expect(result[0].fileSize).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        { videoId: 'missingpath' },
        'No file paths could be determined from metadata or filesystem search'
      );
    });

    it('should handle missing video file', async () => {
      const newVideoUrls = ['https://youtu.be/abc123'];
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify(mockVideoData));
      // Mock stat to reject for all file extensions (mp4, webm, mkv, m4v, avi)
      fs.promises.stat.mockRejectedValue(new Error('File not found'));

      const result = await VideoMetadataProcessor.processVideoMetadata(newVideoUrls);

      expect(result).toHaveLength(1);
      expect(result[0].filePath).toBe('/output/directory/Test Channel/Test Channel - Test Video Title - abc123/Test Channel - Test Video Title [abc123].mp4');
      expect(result[0].fileSize).toBeNull();
      expect(result[0].removed).toBe(false);
    });


    it('should process multiple video URLs', async () => {
      const newVideoUrls = [
        'https://youtu.be/video1',
        'https://youtu.be/video2',
        'https://youtu.be/video3'
      ];

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation((filePath) => {
        const videoId = path.basename(filePath, '.info.json');
        return JSON.stringify({
          ...mockVideoData,
          id: videoId,
          title: `Video ${videoId}`,
          _actual_filepath: `/output/directory/Channel ${videoId}/Channel ${videoId} - Video ${videoId} - ${videoId}/Channel ${videoId} - Video ${videoId} [${videoId}].mp4`
        });
      });
      fs.promises.stat.mockResolvedValue({ size: 1024000 });

      const result = await VideoMetadataProcessor.processVideoMetadata(newVideoUrls);

      expect(result).toHaveLength(3);
      expect(result[0].youtubeId).toBe('video1');
      expect(result[1].youtubeId).toBe('video2');
      expect(result[2].youtubeId).toBe('video3');
    });

    it('should handle missing info.json files', async () => {
      const newVideoUrls = [
        'https://youtu.be/exists',
        'https://youtu.be/missing',
        'https://youtu.be/alsoexists'
      ];

      fs.existsSync.mockImplementation((filePath) => {
        return !filePath.includes('missing');
      });
      fs.readFileSync.mockReturnValue(JSON.stringify(mockVideoData));
      fs.promises.stat.mockResolvedValue({ size: 1024000 });

      const result = await VideoMetadataProcessor.processVideoMetadata(newVideoUrls);

      expect(result).toHaveLength(2);
      expect(result.find(v => v.youtubeId === 'missing')).toBeUndefined();
    });

    it('should handle URL with trailing whitespace', async () => {
      const newVideoUrls = ['https://youtu.be/abc123  \n\t'];
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify({
        ...mockVideoData,
        id: 'abc123',
        _actual_filepath: '/output/directory/Test Channel/Test Channel - Test Video Title - abc123/Test Channel - Test Video Title [abc123].mp4'
      }));
      fs.promises.stat.mockResolvedValue({ size: 1024000 });

      const result = await VideoMetadataProcessor.processVideoMetadata(newVideoUrls);

      expect(result).toHaveLength(1);
      expect(result[0].youtubeId).toBe('abc123');
      expect(fs.existsSync).toHaveBeenCalledWith(
        path.join(mockJobsPath, 'info/abc123.info.json')
      );
    });

    it('should handle channel name priority correctly', async () => {
      const testCases = [
        {
          name: 'prefers uploader over others',
          data: { ...mockVideoData, uploader: 'Uploader Name' },
          expected: 'Uploader Name'
        },
        {
          name: 'falls back to channel when uploader is NA',
          data: { ...mockVideoData, uploader: 'NA', channel: 'Channel Name' },
          expected: 'Channel Name'
        },
        {
          name: 'falls back to uploader_id when uploader and channel are empty',
          data: { ...mockVideoData, uploader: '', channel: '', uploader_id: 'uploader123' },
          expected: 'uploader123'
        },
        {
          name: 'falls back to channel_id when all others are empty',
          data: { ...mockVideoData, uploader: '', channel: '', uploader_id: '', channel_id: 'UC123' },
          expected: 'UC123'
        },
        {
          name: 'uses Unknown Channel when all are empty or NA',
          data: { ...mockVideoData, uploader: 'N/A', channel: '', uploader_id: 'na', channel_id: '  ' },
          expected: 'Unknown Channel'
        }
      ];

      for (const testCase of testCases) {
        const newVideoUrls = ['https://youtu.be/test123'];
        fs.existsSync.mockReturnValue(true);
        const data = {
          ...testCase.data,
          id: 'test123',
          _actual_filepath: '/output/directory/Test Channel/Test Channel - Test Video Title - test123/Test Channel - Test Video Title [test123].mp4'
        };
        fs.readFileSync.mockReturnValue(JSON.stringify(data));
        fs.promises.stat.mockResolvedValue({ size: 1024000 });

        const result = await VideoMetadataProcessor.processVideoMetadata(newVideoUrls);

        expect(result[0].youTubeChannelName).toBe(testCase.expected);
      }
    });

    it('should handle malformed JSON gracefully', async () => {
      const newVideoUrls = ['https://youtu.be/badjson'];
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('{ invalid json }');

      await expect(VideoMetadataProcessor.processVideoMetadata(newVideoUrls)).rejects.toThrow();
    });

    it('should handle missing fields in metadata', async () => {
      const incompleteData = {
        id: 'incomplete123',
        title: 'Incomplete Video',
        _actual_filepath: '/output/directory/Unknown Channel/Unknown Channel - Incomplete Video - incomplete123/Unknown Channel - Incomplete Video [incomplete123].mp4'
        // Missing most fields
      };

      const newVideoUrls = ['https://youtu.be/incomplete123'];
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify(incompleteData));
      // File doesn't exist - all extensions fail
      fs.promises.stat.mockRejectedValue(new Error('File not found'));

      const result = await VideoMetadataProcessor.processVideoMetadata(newVideoUrls);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        youtubeId: 'incomplete123',
        youTubeChannelName: 'Unknown Channel',
        youTubeVideoName: 'Incomplete Video',
        duration: undefined,
        description: undefined,
        originalDate: undefined,
        channel_id: undefined,
        media_type: 'video',
        content_rating: null,
        age_limit: null,
        normalized_rating: null,
        rating_source: null,
        filePath: '/output/directory/Unknown Channel/Unknown Channel - Incomplete Video - incomplete123/Unknown Channel - Incomplete Video [incomplete123].mp4',
        fileSize: null,
        audioFilePath: null,
        audioFileSize: null,
        removed: false
      });
    });

    it('should return empty array for empty input', async () => {
      const result = await VideoMetadataProcessor.processVideoMetadata([]);
      expect(result).toEqual([]);
    });

    it('should log appropriate messages during processing', async () => {
      const newVideoUrls = ['https://youtu.be/logtest'];
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify({
        ...mockVideoData,
        id: 'logtest',
        _actual_filepath: '/output/directory/Test Channel/Test Channel - Test Video Title - logtest/Test Channel - Test Video Title [logtest].mp4'
      }));
      fs.promises.stat.mockResolvedValue({ size: 1024000 });

      await VideoMetadataProcessor.processVideoMetadata(newVideoUrls);

      expect(logger.debug).toHaveBeenCalledWith(
        { dataPath: path.join(mockJobsPath, 'info/logtest.info.json'), videoId: 'logtest' },
        'Looking for info.json file'
      );
      expect(logger.debug).toHaveBeenCalledWith(
        { dataPath: path.join(mockJobsPath, 'info/logtest.info.json'), videoId: 'logtest' },
        'Found info.json file'
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          filepath: expect.any(String),
          fileSize: 1024000,
          videoId: 'logtest'
        }),
        'Found video file'
      );
    });

    it('should log when info.json is not found', async () => {
      const newVideoUrls = ['https://youtu.be/notfound'];
      fs.existsSync.mockReturnValue(false);

      await VideoMetadataProcessor.processVideoMetadata(newVideoUrls);

      expect(logger.debug).toHaveBeenCalledWith(
        { dataPath: path.join(mockJobsPath, 'info/notfound.info.json'), videoId: 'notfound' },
        'No info.json file found'
      );
    });

    it('should handle file system errors gracefully', async () => {
      const newVideoUrls = ['https://youtu.be/fserror'];
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation(() => {
        throw new Error('File system error');
      });

      await expect(VideoMetadataProcessor.processVideoMetadata(newVideoUrls)).rejects.toThrow('File system error');
    });

    it('should handle URLs with special characters in video ID', async () => {
      const newVideoUrls = ['https://youtu.be/abc-123_456'];
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify({
        ...mockVideoData,
        id: 'abc-123_456'
      }));
      fs.promises.stat.mockResolvedValue({ size: 1024000 });

      const result = await VideoMetadataProcessor.processVideoMetadata(newVideoUrls);

      expect(result).toHaveLength(1);
      expect(result[0].youtubeId).toBe('abc-123_456');
    });

    it('should handle Unicode characters in metadata', async () => {
      const unicodeData = {
        ...mockVideoData,
        uploader: '日本のチャンネル',
        title: 'Video with 😊 emoji',
        description: 'Description with special chars: é, ñ, ü'
      };

      const newVideoUrls = ['https://youtu.be/unicode123'];
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify(unicodeData));
      fs.promises.stat.mockResolvedValue({ size: 1024000 });

      const result = await VideoMetadataProcessor.processVideoMetadata(newVideoUrls);

      expect(result[0].youTubeChannelName).toBe('日本のチャンネル');
      expect(result[0].youTubeVideoName).toBe('Video with 😊 emoji');
      expect(result[0].description).toBe('Description with special chars: é, ñ, ü');
    });

    it('should handle very long channel names and titles', async () => {
      const longData = {
        ...mockVideoData,
        uploader: 'A'.repeat(500),
        title: 'B'.repeat(1000)
      };

      const newVideoUrls = ['https://youtu.be/long123'];
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify(longData));
      fs.promises.stat.mockResolvedValue({ size: 1024000 });

      const result = await VideoMetadataProcessor.processVideoMetadata(newVideoUrls);

      expect(result[0].youTubeChannelName).toBe('A'.repeat(500));
      expect(result[0].youTubeVideoName).toBe('B'.repeat(1000));
    });

    it('should process null/undefined values in non-critical fields', async () => {
      const dataWithNulls = {
        id: 'nulltest',
        uploader: 'Test Channel',
        title: 'Test Title',
        duration: null,
        description: undefined,
        upload_date: null,
        channel_id: undefined
      };

      const newVideoUrls = ['https://youtu.be/nulltest'];
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify(dataWithNulls));
      fs.promises.stat.mockResolvedValue({ size: 1024000 });

      const result = await VideoMetadataProcessor.processVideoMetadata(newVideoUrls);

      expect(result[0].duration).toBeNull();
      expect(result[0].description).toBeUndefined();
      expect(result[0].originalDate).toBeNull();
      expect(result[0].channel_id).toBeUndefined();
    });
  });

  describe('waitForFile', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      jest.useFakeTimers();
      fs.promises.stat.mockReset();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return stats immediately when file exists on first try', async () => {
      const mockStats = { size: 1024000 };
      fs.promises.stat.mockResolvedValueOnce(mockStats);

      const resultPromise = VideoMetadataProcessor.waitForFile('/test/file.mp4');
      await jest.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toBe(mockStats);
      expect(fs.promises.stat).toHaveBeenCalledTimes(1);
    });

    it('should retry with exponential backoff when file not found', async () => {
      const mockStats = { size: 1024000 };
      fs.promises.stat
        .mockRejectedValueOnce(new Error('ENOENT'))
        .mockRejectedValueOnce(new Error('ENOENT'))
        .mockResolvedValueOnce(mockStats);

      const resultPromise = VideoMetadataProcessor.waitForFile('/test/file.mp4');

      // First attempt fails immediately
      expect(fs.promises.stat).toHaveBeenCalledTimes(1);

      // Wait 100ms for first retry
      await jest.advanceTimersByTimeAsync(100);
      expect(fs.promises.stat).toHaveBeenCalledTimes(2);

      // Wait 200ms for second retry
      await jest.advanceTimersByTimeAsync(200);
      expect(fs.promises.stat).toHaveBeenCalledTimes(3);

      const result = await resultPromise;
      expect(result).toBe(mockStats);
    });

    it('should return null after all retries are exhausted', async () => {
      fs.promises.stat.mockRejectedValue(new Error('ENOENT'));

      const resultPromise = VideoMetadataProcessor.waitForFile('/test/file.mp4');

      // Run through all retry delays: 100ms, 200ms, 400ms, 800ms
      await jest.advanceTimersByTimeAsync(100);
      await jest.advanceTimersByTimeAsync(200);
      await jest.advanceTimersByTimeAsync(400);
      await jest.advanceTimersByTimeAsync(800);

      const result = await resultPromise;
      expect(result).toBeNull();
      expect(fs.promises.stat).toHaveBeenCalledTimes(4); // Initial + 3 retries
    });

    it('should wait for file to have non-zero size', async () => {
      const mockStatsZero = { size: 0 };
      const mockStatsNonZero = { size: 1024000 };

      fs.promises.stat
        .mockResolvedValueOnce(mockStatsZero)
        .mockResolvedValueOnce(mockStatsZero)
        .mockResolvedValueOnce(mockStatsNonZero);

      const resultPromise = VideoMetadataProcessor.waitForFile('/test/file.mp4');

      // First attempt finds file but size is 0
      expect(fs.promises.stat).toHaveBeenCalledTimes(1);

      // Wait 100ms for first retry
      await jest.advanceTimersByTimeAsync(100);
      expect(fs.promises.stat).toHaveBeenCalledTimes(2);

      // Wait 200ms for second retry
      await jest.advanceTimersByTimeAsync(200);
      expect(fs.promises.stat).toHaveBeenCalledTimes(3);

      const result = await resultPromise;
      expect(result).toBe(mockStatsNonZero);
      expect(logger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          filePath: '/test/file.mp4',
          delayMs: expect.any(Number),
          attempt: expect.any(Number),
          maxRetries: 4
        }),
        'File found but size is 0, waiting for file to be written'
      );
    });

    it('should use custom retry settings when provided', async () => {
      const mockStats = { size: 1024000 };
      fs.promises.stat
        .mockRejectedValueOnce(new Error('ENOENT'))
        .mockResolvedValueOnce(mockStats);

      const resultPromise = VideoMetadataProcessor.waitForFile('/test/file.mp4', 2, 50);

      // Wait 50ms for first retry (custom initial delay)
      await jest.advanceTimersByTimeAsync(50);
      expect(fs.promises.stat).toHaveBeenCalledTimes(2);

      const result = await resultPromise;
      expect(result).toBe(mockStats);
    });

    it('should handle stat errors other than ENOENT', async () => {
      const mockStats = { size: 1024000 };
      fs.promises.stat
        .mockRejectedValueOnce(new Error('EACCES'))
        .mockResolvedValueOnce(mockStats);

      const resultPromise = VideoMetadataProcessor.waitForFile('/test/file.mp4');

      // Wait 100ms for first retry
      await jest.advanceTimersByTimeAsync(100);
      expect(fs.promises.stat).toHaveBeenCalledTimes(2);

      const result = await resultPromise;
      expect(result).toBe(mockStats);
    });

    it('should log appropriate messages during retries', async () => {
      fs.promises.stat.mockRejectedValue(new Error('ENOENT'));

      const resultPromise = VideoMetadataProcessor.waitForFile('/test/file.mp4');

      await jest.advanceTimersByTimeAsync(100);
      expect(logger.debug).toHaveBeenCalledWith(
        { filePath: '/test/file.mp4', delayMs: 100, attempt: 1, maxRetries: 4 },
        'Waiting for file to be available'
      );

      await jest.advanceTimersByTimeAsync(200);
      expect(logger.debug).toHaveBeenCalledWith(
        { filePath: '/test/file.mp4', delayMs: 200, attempt: 2, maxRetries: 4 },
        'Waiting for file to be available'
      );

      await jest.advanceTimersByTimeAsync(400);
      expect(logger.debug).toHaveBeenCalledWith(
        { filePath: '/test/file.mp4', delayMs: 400, attempt: 3, maxRetries: 4 },
        'Waiting for file to be available'
      );

      await jest.advanceTimersByTimeAsync(800);
      await resultPromise;
    });
  });

  describe('Edge Cases and Integration', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      fs.promises.stat.mockReset();
    });

    it('should handle concurrent calls to processVideoMetadata', async () => {
      const urls1 = ['https://youtu.be/video1'];
      const urls2 = ['https://youtu.be/video2'];

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation((filePath) => {
        const videoId = path.basename(filePath, '.info.json');
        return JSON.stringify({
          id: videoId,
          uploader: `Channel ${videoId}`,
          title: `Title ${videoId}`
        });
      });
      fs.promises.stat.mockResolvedValue({ size: 1024000 });

      const [result1, result2] = await Promise.all([
        VideoMetadataProcessor.processVideoMetadata(urls1),
        VideoMetadataProcessor.processVideoMetadata(urls2)
      ]);

      expect(result1[0].youtubeId).toBe('video1');
      expect(result2[0].youtubeId).toBe('video2');
    });

    it('should handle mixed success and failure scenarios', async () => {
      const newVideoUrls = [
        'https://youtu.be/success1',
        'https://youtu.be/missing',
        'https://youtu.be/success2'
      ];

      fs.existsSync.mockImplementation((filePath) => {
        if (filePath.includes('missing')) {
          return false;
        }
        return true;
      });

      fs.readFileSync.mockImplementation((filePath) => {
        const videoId = path.basename(filePath, '.info.json');
        return JSON.stringify({
          id: videoId,
          uploader: `Channel ${videoId}`,
          title: `Title ${videoId}`
        });
      });
      fs.promises.stat.mockResolvedValue({ size: 1024000 });

      const result = await VideoMetadataProcessor.processVideoMetadata(newVideoUrls);

      expect(result).toHaveLength(2);
      expect(result[0].youtubeId).toBe('success1');
      expect(result[1].youtubeId).toBe('success2');
    });

    it('should maintain order of successfully processed videos', async () => {
      const newVideoUrls = [
        'https://youtu.be/video3',
        'https://youtu.be/video1',
        'https://youtu.be/video2'
      ];

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation((filePath) => {
        const videoId = path.basename(filePath, '.info.json');
        return JSON.stringify({
          id: videoId,
          uploader: `Channel ${videoId}`,
          title: `Title ${videoId}`
        });
      });
      fs.promises.stat.mockResolvedValue({ size: 1024000 });

      const result = await VideoMetadataProcessor.processVideoMetadata(newVideoUrls);

      expect(result[0].youtubeId).toBe('video3');
      expect(result[1].youtubeId).toBe('video1');
      expect(result[2].youtubeId).toBe('video2');
    });
  });
});
