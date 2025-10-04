/* eslint-env jest */
const path = require('path');

jest.mock('fs', () => ({
  promises: {
    access: jest.fn(),
    stat: jest.fn(),
    readdir: jest.fn()
  }
}));

describe('videoFileLocator', () => {
  let videoFileLocator;
  let fsPromises;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    fsPromises = require('fs').promises;
    videoFileLocator = require('../videoFileLocator');
  });

  describe('resolveVideoFilePath', () => {
    describe('with expectedFullPath', () => {
      test('should return file info when expectedFullPath exists', async () => {
        const expectedPath = '/videos/channel/video.mp4';
        const mockStats = { size: 1024, mtime: new Date() };

        fsPromises.stat.mockResolvedValueOnce(mockStats);

        const result = await videoFileLocator.resolveVideoFilePath({
          expectedFullPath: expectedPath
        });

        expect(result).toEqual({
          path: expectedPath,
          stats: mockStats
        });
        expect(fsPromises.stat).toHaveBeenCalledWith(expectedPath);
      });

      test('should try alternative extensions when main file not found', async () => {
        const expectedPath = '/videos/channel/video.mp4';
        const alternativePath = '/videos/channel/video.webm';
        const mockStats = { size: 2048, mtime: new Date() };

        // First call for expectedPath fails
        fsPromises.stat.mockRejectedValueOnce({ code: 'ENOENT' });
        // Second call for alternative extension succeeds
        fsPromises.stat.mockResolvedValueOnce(mockStats);

        const result = await videoFileLocator.resolveVideoFilePath({
          expectedFullPath: expectedPath,
          alternativeExtensions: ['.webm']
        });

        expect(result).toEqual({
          path: alternativePath,
          stats: mockStats
        });
        expect(fsPromises.stat).toHaveBeenCalledTimes(2);
        expect(fsPromises.stat).toHaveBeenNthCalledWith(1, expectedPath);
        expect(fsPromises.stat).toHaveBeenNthCalledWith(2, alternativePath);
      });

      test('should try default extensions when file not found', async () => {
        const expectedPath = '/videos/channel/video.mp4';
        const webmPath = '/videos/channel/video.webm';
        const mkvPath = '/videos/channel/video.mkv';
        const mockStats = { size: 3072, mtime: new Date() };

        // First two calls fail, third succeeds
        fsPromises.stat
          .mockRejectedValueOnce({ code: 'ENOENT' }) // .mp4
          .mockRejectedValueOnce({ code: 'ENOENT' }) // .webm
          .mockResolvedValueOnce(mockStats); // .mkv

        const result = await videoFileLocator.resolveVideoFilePath({
          expectedFullPath: expectedPath
        });

        expect(result).toEqual({
          path: mkvPath,
          stats: mockStats
        });
        expect(fsPromises.stat).toHaveBeenCalledWith(expectedPath);
        expect(fsPromises.stat).toHaveBeenCalledWith(webmPath);
        expect(fsPromises.stat).toHaveBeenCalledWith(mkvPath);
      });

      test('should not retry the same path twice', async () => {
        const expectedPath = '/videos/channel/video.mp4';

        fsPromises.stat.mockRejectedValue({ code: 'ENOENT' });

        const result = await videoFileLocator.resolveVideoFilePath({
          expectedFullPath: expectedPath,
          alternativeExtensions: ['.mp4'] // Same as original
        });

        expect(result).toBeNull();
        // Should only call stat once for .mp4, not twice
        expect(fsPromises.stat).toHaveBeenCalledTimes(5); // Original .mp4 + 4 other default extensions (.webm, .mkv, .m4v, .avi)
        const statCalls = fsPromises.stat.mock.calls.map(call => call[0]);
        const mp4Calls = statCalls.filter(p => p.endsWith('.mp4'));
        expect(mp4Calls).toHaveLength(1);
      });

      test('should handle permission errors by throwing', async () => {
        const expectedPath = '/videos/channel/video.mp4';
        const permissionError = { code: 'EACCES' };

        fsPromises.stat.mockRejectedValueOnce(permissionError);

        await expect(
          videoFileLocator.resolveVideoFilePath({
            expectedFullPath: expectedPath
          })
        ).rejects.toEqual(permissionError);
      });
    });

    describe('with baseOutputPath and videoId', () => {
      test('should search in channel directory for video folder', async () => {
        const baseOutputPath = '/videos';
        const channelName = 'TestChannel';
        const videoId = 'abc123';
        const mockStats = { size: 4096, mtime: new Date() };

        // Mock channel directory exists
        fsPromises.access.mockResolvedValueOnce();

        // Mock channel directory contents
        fsPromises.readdir.mockImplementation((dir) => {
          if (dir === path.join(baseOutputPath, channelName)) {
            return Promise.resolve([
              { name: 'Some Video - abc123', isDirectory: () => true },
              { name: 'Other Video - xyz789', isDirectory: () => true }
            ]);
          }
          if (dir === path.join(baseOutputPath, channelName, 'Some Video - abc123')) {
            return Promise.resolve([
              { name: 'video [abc123].mp4', isFile: () => true, isDirectory: () => false },
              { name: 'thumbnail.jpg', isFile: () => true, isDirectory: () => false }
            ]);
          }
          return Promise.resolve([]);
        });

        // Mock stat for the video file
        fsPromises.stat.mockResolvedValueOnce(mockStats);

        const result = await videoFileLocator.resolveVideoFilePath({
          baseOutputPath,
          channelName,
          videoId
        });

        expect(result).toEqual({
          path: path.join(baseOutputPath, channelName, 'Some Video - abc123', 'video [abc123].mp4'),
          stats: mockStats
        });
      });

      test('should search all subdirectories when channel not specified', async () => {
        const baseOutputPath = '/videos';
        const videoId = 'abc123';
        const mockStats = { size: 5120, mtime: new Date() };

        // Mock base directory contents
        fsPromises.readdir.mockImplementation((dir) => {
          if (dir === baseOutputPath) {
            return Promise.resolve([
              { name: 'Channel1', isDirectory: () => true },
              { name: 'Channel2', isDirectory: () => true },
              { name: 'file.txt', isDirectory: () => false }
            ]);
          }
          if (dir === '/videos/Channel2') {
            return Promise.resolve([
              { name: 'Video Title - abc123', isDirectory: () => true }
            ]);
          }
          if (dir === '/videos/Channel2/Video Title - abc123') {
            return Promise.resolve([
              { name: 'video [abc123].webm', isFile: () => true, isDirectory: () => false }
            ]);
          }
          return Promise.resolve([]);
        });

        fsPromises.stat.mockResolvedValueOnce(mockStats);

        const result = await videoFileLocator.resolveVideoFilePath({
          baseOutputPath,
          videoId
        });

        expect(result).toEqual({
          path: '/videos/Channel2/Video Title - abc123/video [abc123].webm',
          stats: mockStats
        });
      });

      test('should prefer extensions in order specified', async () => {
        const baseOutputPath = '/videos';
        const channelName = 'TestChannel';
        const videoId = 'abc123';
        const mockStats = { size: 6144, mtime: new Date() };

        fsPromises.access.mockResolvedValueOnce();

        fsPromises.readdir.mockImplementation((dir) => {
          if (dir === path.join(baseOutputPath, channelName)) {
            return Promise.resolve([
              { name: 'Video - abc123', isDirectory: () => true }
            ]);
          }
          if (dir === path.join(baseOutputPath, channelName, 'Video - abc123')) {
            return Promise.resolve([
              { name: 'video [abc123].mkv', isFile: () => true, isDirectory: () => false },
              { name: 'video [abc123].mp4', isFile: () => true, isDirectory: () => false },
              { name: 'video [abc123].webm', isFile: () => true, isDirectory: () => false }
            ]);
          }
          return Promise.resolve([]);
        });

        fsPromises.stat.mockResolvedValueOnce(mockStats);

        const result = await videoFileLocator.resolveVideoFilePath({
          baseOutputPath,
          channelName,
          videoId,
          alternativeExtensions: ['.mkv', '.mp4']
        });

        // Should prefer .mkv since it's first in alternativeExtensions
        expect(result.path).toBe(
          path.join(baseOutputPath, channelName, 'Video - abc123', 'video [abc123].mkv')
        );
      });

      test('should handle missing videoId in filename gracefully', async () => {
        const baseOutputPath = '/videos';
        const channelName = 'TestChannel';
        const videoId = 'abc123';

        fsPromises.access.mockResolvedValueOnce();

        fsPromises.readdir.mockImplementation((dir) => {
          if (dir === path.join(baseOutputPath, channelName)) {
            return Promise.resolve([
              { name: 'Video - abc123', isDirectory: () => true }
            ]);
          }
          if (dir === path.join(baseOutputPath, channelName, 'Video - abc123')) {
            return Promise.resolve([
              { name: 'video.mp4', isFile: () => true, isDirectory: () => false }, // No videoId in filename
              { name: 'thumbnail.jpg', isFile: () => true, isDirectory: () => false }
            ]);
          }
          return Promise.resolve([]);
        });

        const result = await videoFileLocator.resolveVideoFilePath({
          baseOutputPath,
          channelName,
          videoId
        });

        expect(result).toBeNull();
      });

      test('should handle ENOENT errors gracefully', async () => {
        const baseOutputPath = '/videos';
        const channelName = 'NonExistentChannel';
        const videoId = 'abc123';

        // Channel directory doesn't exist
        fsPromises.access.mockRejectedValueOnce({ code: 'ENOENT' });

        // Base directory also doesn't exist
        fsPromises.readdir.mockRejectedValueOnce({ code: 'ENOENT' });

        const result = await videoFileLocator.resolveVideoFilePath({
          baseOutputPath,
          channelName,
          videoId
        });

        expect(result).toBeNull();
      });

      test('should handle ENOTDIR errors gracefully', async () => {
        const baseOutputPath = '/videos';
        const channelName = 'TestChannel';
        const videoId = 'abc123';

        fsPromises.access.mockResolvedValueOnce();

        // Channel path exists but is not a directory
        fsPromises.readdir.mockRejectedValueOnce({ code: 'ENOTDIR' });

        const result = await videoFileLocator.resolveVideoFilePath({
          baseOutputPath,
          channelName,
          videoId
        });

        expect(result).toBeNull();
      });

      test('should throw on unexpected readdir errors', async () => {
        const baseOutputPath = '/videos';
        const channelName = 'TestChannel';
        const videoId = 'abc123';
        const unexpectedError = new Error('Disk failure');

        fsPromises.access.mockResolvedValueOnce();
        fsPromises.readdir.mockRejectedValueOnce(unexpectedError);

        await expect(
          videoFileLocator.resolveVideoFilePath({
            baseOutputPath,
            channelName,
            videoId
          })
        ).rejects.toThrow('Disk failure');
      });
    });

    describe('edge cases', () => {
      test('should return null when no parameters provided', async () => {
        const result = await videoFileLocator.resolveVideoFilePath({});

        expect(result).toBeNull();
        expect(fsPromises.stat).not.toHaveBeenCalled();
      });

      test('should return null when only baseOutputPath provided', async () => {
        const result = await videoFileLocator.resolveVideoFilePath({
          baseOutputPath: '/videos'
        });

        expect(result).toBeNull();
      });

      test('should return null when only videoId provided', async () => {
        const result = await videoFileLocator.resolveVideoFilePath({
          videoId: 'abc123'
        });

        expect(result).toBeNull();
      });

      test('should handle empty extension in expectedFullPath', async () => {
        const expectedPath = '/videos/channel/video';
        const mockStats = { size: 7168, mtime: new Date() };

        // First call fails, try with default extensions
        fsPromises.stat
          .mockRejectedValueOnce({ code: 'ENOENT' })
          .mockResolvedValueOnce(mockStats);

        const result = await videoFileLocator.resolveVideoFilePath({
          expectedFullPath: expectedPath
        });

        expect(result.path).toBe('/videos/channel/video.mp4');
      });

      test('should deduplicate extensions from all sources', async () => {
        const expectedPath = '/videos/channel/video.mp4';

        fsPromises.stat.mockRejectedValue({ code: 'ENOENT' });

        await videoFileLocator.resolveVideoFilePath({
          expectedFullPath: expectedPath,
          alternativeExtensions: ['.mp4', '.MP4', '.webm', '.WEBM', '.mp4']
        });

        // Check that we don't have duplicate calls for the same extension
        const statCalls = fsPromises.stat.mock.calls.map(call => call[0]);
        const uniqueCalls = [...new Set(statCalls)];
        expect(statCalls.length).toBe(uniqueCalls.length);
      });

      test('should handle case-insensitive extensions', async () => {
        const expectedPath = '/videos/channel/video.MP4';
        const mockStats = { size: 8192, mtime: new Date() };

        fsPromises.stat.mockResolvedValueOnce(mockStats);

        const result = await videoFileLocator.resolveVideoFilePath({
          expectedFullPath: expectedPath
        });

        expect(result).toEqual({
          path: expectedPath,
          stats: mockStats
        });
      });

      test('should handle multiple video folders with same suffix', async () => {
        const baseOutputPath = '/videos';
        const channelName = 'TestChannel';
        const videoId = 'abc123';
        const mockStats1 = { size: 1000, mtime: new Date('2024-01-01') };
        const mockStats2 = { size: 2000, mtime: new Date('2024-01-02') };

        fsPromises.access.mockResolvedValueOnce();

        fsPromises.readdir.mockImplementation((dir) => {
          if (dir === path.join(baseOutputPath, channelName)) {
            return Promise.resolve([
              { name: 'Video Part 1 - abc123', isDirectory: () => true },
              { name: 'Video Part 2 - abc123', isDirectory: () => true }
            ]);
          }
          if (dir === path.join(baseOutputPath, channelName, 'Video Part 1 - abc123')) {
            return Promise.resolve([
              { name: 'video [abc123].mp4', isFile: () => true, isDirectory: () => false }
            ]);
          }
          if (dir === path.join(baseOutputPath, channelName, 'Video Part 2 - abc123')) {
            return Promise.resolve([
              { name: 'video [abc123].webm', isFile: () => true, isDirectory: () => false }
            ]);
          }
          return Promise.resolve([]);
        });

        fsPromises.stat
          .mockResolvedValueOnce(mockStats1)
          .mockResolvedValueOnce(mockStats2);

        const result = await videoFileLocator.resolveVideoFilePath({
          baseOutputPath,
          channelName,
          videoId
        });

        // Should return the first matching file found
        expect(result.path).toBe(
          path.join(baseOutputPath, channelName, 'Video Part 1 - abc123', 'video [abc123].mp4')
        );
      });

      test('should handle null/undefined in readdir errors', async () => {
        const baseOutputPath = '/videos';
        const videoId = 'abc123';

        // Simulate null error object
        fsPromises.readdir.mockRejectedValueOnce(null);

        await expect(
          videoFileLocator.resolveVideoFilePath({
            baseOutputPath,
            videoId
          })
        ).rejects.toBeNull();
      });

      test('should not check the same path multiple times', async () => {
        const baseOutputPath = '/videos';
        const channelName = 'TestChannel';
        const videoId = 'abc123';
        const expectedFullPath = '/videos/TestChannel/video.mp4';

        fsPromises.access.mockResolvedValueOnce();
        fsPromises.readdir.mockImplementation((dir) => {
          if (dir === path.join(baseOutputPath, channelName)) {
            return Promise.resolve([
              { name: 'Video - abc123', isDirectory: () => true }
            ]);
          }
          if (dir === path.join(baseOutputPath, channelName, 'Video - abc123')) {
            return Promise.resolve([
              { name: 'video [abc123].mp4', isFile: () => true, isDirectory: () => false },
              { name: 'video2 [abc123].mp4', isFile: () => true, isDirectory: () => false }
            ]);
          }
          return Promise.resolve([]);
        });

        const mockStats = { size: 9216, mtime: new Date() };
        fsPromises.stat.mockResolvedValue(mockStats);

        await videoFileLocator.resolveVideoFilePath({
          expectedFullPath,
          baseOutputPath,
          channelName,
          videoId
        });

        // Verify triedPaths prevents duplicate stat calls
        const statCalls = fsPromises.stat.mock.calls.map(call => call[0]);
        const uniqueCalls = [...new Set(statCalls)];
        expect(statCalls.length).toBe(uniqueCalls.length);
      });
    });
  });
});