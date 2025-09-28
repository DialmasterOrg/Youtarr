/* eslint-env jest */

const fs = require('fs');
const path = require('path');

// Mock dependencies - must be done before requiring the module
jest.mock('fs');
jest.mock('../../configModule', () => ({
  getJobsPath: jest.fn(),
  directoryPath: '/output/directory'
}));

// Set up fs.promises mock before requiring the module
fs.promises = {
  stat: jest.fn()
};

const VideoMetadataProcessor = require('../videoMetadataProcessor');
const configModule = require('../../configModule');

describe('VideoMetadataProcessor', () => {
  const mockJobsPath = '/jobs/path';

  beforeEach(() => {
    jest.clearAllMocks();
    configModule.getJobsPath.mockReturnValue(mockJobsPath);
    jest.spyOn(console, 'log').mockImplementation(() => {});
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
      upload_date: '20240101'
    };

    // Clear mocks before each test
    beforeEach(() => {
      jest.clearAllMocks();
      // Reset the fs.promises.stat mock
      fs.promises.stat.mockReset();
    });

    it('should process single video URL successfully with file metadata', async () => {
      const newVideoUrls = ['https://youtu.be/abc123'];
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify(mockVideoData));
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
        filePath: '/output/directory/Test Channel/Test Channel - Test Video Title - abc123/Test Channel - Test Video Title  [abc123].mp4',
        fileSize: '1024000',
        removed: false
      });

      expect(fs.existsSync).toHaveBeenCalledWith(
        path.join(mockJobsPath, 'info/abc123.info.json')
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
      expect(result[0].filePath).toBe('/output/directory/Test Channel/Test Channel - Test Video Title - abc123/Test Channel - Test Video Title  [abc123].mp4');
      expect(result[0].fileSize).toBeNull();
      expect(result[0].removed).toBe(false);
    });

    it('should find video with alternative extension', async () => {
      const newVideoUrls = ['https://youtu.be/abc123'];
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify(mockVideoData));

      // First call fails for .mp4, second succeeds for .webm
      fs.promises.stat
        .mockRejectedValueOnce(new Error('File not found'))
        .mockResolvedValueOnce({ size: 2048000 });

      const result = await VideoMetadataProcessor.processVideoMetadata(newVideoUrls);

      expect(result).toHaveLength(1);
      expect(result[0].filePath).toContain('.webm');
      expect(result[0].fileSize).toBe('2048000');
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
          title: `Video ${videoId}`
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
      fs.readFileSync.mockReturnValue(JSON.stringify(mockVideoData));
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
        fs.readFileSync.mockReturnValue(JSON.stringify(testCase.data));
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
        title: 'Incomplete Video'
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
        filePath: '/output/directory/Unknown Channel/Unknown Channel - Incomplete Video - incomplete123/Unknown Channel - Incomplete Video  [incomplete123].mp4',
        fileSize: null,
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
      fs.readFileSync.mockReturnValue(JSON.stringify(mockVideoData));
      fs.promises.stat.mockResolvedValue({ size: 1024000 });

      await VideoMetadataProcessor.processVideoMetadata(newVideoUrls);

      expect(console.log).toHaveBeenCalledWith(
        'Looking for info.json file at',
        path.join(mockJobsPath, 'info/logtest.info.json')
      );
      expect(console.log).toHaveBeenCalledWith(
        'Found info.json file at',
        path.join(mockJobsPath, 'info/logtest.info.json')
      );
    });

    it('should log when info.json is not found', async () => {
      const newVideoUrls = ['https://youtu.be/notfound'];
      fs.existsSync.mockReturnValue(false);

      await VideoMetadataProcessor.processVideoMetadata(newVideoUrls);

      expect(console.log).toHaveBeenCalledWith(
        'No info.json file at',
        path.join(mockJobsPath, 'info/notfound.info.json')
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

      let callCount = 0;
      fs.existsSync.mockImplementation(() => {
        callCount++;
        return callCount !== 2; // Second file doesn't exist
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