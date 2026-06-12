/* eslint-env jest */

// Mock fs module - must define mockFsPromises before jest.mock
const mockFsPromises = {
  access: jest.fn(),
  readdir: jest.fn(),
  stat: jest.fn(),
  unlink: jest.fn(),
  rm: jest.fn(),
  rmdir: jest.fn(),
};
jest.mock('fs', () => {
  const mockActualFs = jest.requireActual('fs');
  return {
    ...mockActualFs,
    promises: mockFsPromises,
  };
});

jest.mock('../../../logger');

jest.mock('../../configModule', () => ({
  directoryPath: '/mock/output'
}));

jest.mock('../../filesystem', () => ({
  isVideoDirectory: jest.fn(),
  cleanupEmptyChannelDirectory: jest.fn().mockResolvedValue(false),
}));

jest.mock('../tempPathManager');

jest.mock('../../../models', () => ({
  JobVideoDownload: {
    findAll: jest.fn().mockResolvedValue([])
  }
}));

const filesystem = require('../../filesystem');
const tempPathManager = require('../tempPathManager');
const { JobVideoDownload } = require('../../../models');
const logger = require('../../../logger');
const { cleanupInProgressVideos, cleanupPartialFiles } = require('../downloadCleanup');

describe('downloadCleanup', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    filesystem.isVideoDirectory.mockReturnValue(true);
    filesystem.cleanupEmptyChannelDirectory.mockResolvedValue(false);
    tempPathManager.isTempPath.mockReturnValue(false);
    tempPathManager.convertFinalToTemp.mockImplementation((p) => p);

    mockFsPromises.access.mockResolvedValue();
    mockFsPromises.readdir.mockResolvedValue([]);
    mockFsPromises.stat.mockResolvedValue({ isFile: () => true, isDirectory: () => false });
    mockFsPromises.unlink.mockResolvedValue();
    mockFsPromises.rm.mockResolvedValue();
    mockFsPromises.rmdir.mockResolvedValue();
  });

  describe('cleanupInProgressVideos', () => {
    it('should handle no in-progress videos', async () => {
      JobVideoDownload.findAll.mockResolvedValue([]);

      await cleanupInProgressVideos('job-123');

      expect(logger.info).toHaveBeenCalledWith('No in-progress videos to clean up');
    });

    it('should cleanup video directory and database entry', async () => {
      const mockVideoDownload = {
        youtube_id: 'abc123XYZ_d',
        file_path: '/output/Channel - Title - abc123XYZ_d',
        destroy: jest.fn().mockResolvedValue()
      };

      JobVideoDownload.findAll.mockResolvedValue([mockVideoDownload]);
      // File path is a final path, not a temp path
      tempPathManager.isTempPath.mockReturnValue(false);
      // Mock temp path conversion to return a different path
      tempPathManager.convertFinalToTemp.mockReturnValue('/tmp/youtarr-downloads/Channel - Title - abc123XYZ_d');
      // Final path exists, temp path doesn't
      mockFsPromises.access.mockImplementation((path) => {
        if (path === '/output/Channel - Title - abc123XYZ_d') return Promise.resolve();
        return Promise.reject(new Error('ENOENT'));
      });
      mockFsPromises.readdir.mockResolvedValue(['video.mp4', 'poster.jpg']);

      await cleanupInProgressVideos('job-123');

      expect(mockFsPromises.readdir).toHaveBeenCalledWith('/output/Channel - Title - abc123XYZ_d');
      expect(mockFsPromises.unlink).toHaveBeenCalledTimes(2);
      expect(mockFsPromises.rmdir).toHaveBeenCalledWith('/output/Channel - Title - abc123XYZ_d');
      expect(mockVideoDownload.destroy).toHaveBeenCalled();
    });

    it('should clean up individual files in flat mode (non-video directories)', async () => {
      const mockVideoDownload = {
        youtube_id: 'abc123XYZ_d',
        file_path: '/output/Channel',
        destroy: jest.fn().mockResolvedValue()
      };

      JobVideoDownload.findAll.mockResolvedValue([mockVideoDownload]);
      mockFsPromises.access.mockResolvedValue(); // Directory exists
      // Mock filesystem.isVideoDirectory to return false (flat mode)
      filesystem.isVideoDirectory.mockReturnValue(false);
      // Mock directory contents with matching files
      mockFsPromises.readdir.mockResolvedValue([
        'Channel - Title [abc123XYZ_d].mp4',
        'Channel - Title [abc123XYZ_d].jpg',
        'other-video.mp4'
      ]);
      mockFsPromises.stat.mockResolvedValue({ isFile: () => true, isDirectory: () => false });
      mockFsPromises.unlink.mockResolvedValue();

      await cleanupInProgressVideos('job-123');

      expect(logger.info).toHaveBeenCalledWith(
        { youtubeId: 'abc123XYZ_d', dirPath: '/output/Channel' },
        'Flat structure detected, cleaning up individual files'
      );
      // Should NOT remove the directory itself
      expect(mockFsPromises.rmdir).not.toHaveBeenCalled();
      // Should delete files matching the youtube ID
      expect(mockFsPromises.unlink).toHaveBeenCalledWith('/output/Channel/Channel - Title [abc123XYZ_d].mp4');
      expect(mockFsPromises.unlink).toHaveBeenCalledWith('/output/Channel/Channel - Title [abc123XYZ_d].jpg');
      // Should NOT delete unrelated files
      expect(mockFsPromises.unlink).not.toHaveBeenCalledWith('/output/Channel/other-video.mp4');
      // Should destroy the tracking entry
      expect(mockVideoDownload.destroy).toHaveBeenCalled();
    });

    it('should check temp location when file path is final path', async () => {
      tempPathManager.isTempPath.mockReturnValue(false);
      tempPathManager.convertFinalToTemp.mockReturnValue('/tmp/Channel - Title - abc123XYZ_d');

      const mockVideoDownload = {
        youtube_id: 'abc123XYZ_d',
        file_path: '/output/Channel - Title - abc123XYZ_d',
        destroy: jest.fn().mockResolvedValue()
      };

      JobVideoDownload.findAll.mockResolvedValue([mockVideoDownload]);
      mockFsPromises.access.mockResolvedValue(); // Both paths exist
      mockFsPromises.readdir.mockResolvedValue([]);

      await cleanupInProgressVideos('job-123');

      expect(mockFsPromises.access).toHaveBeenCalledWith('/output/Channel - Title - abc123XYZ_d');
      expect(mockFsPromises.access).toHaveBeenCalledWith('/tmp/Channel - Title - abc123XYZ_d');
    });

    it('should not convert to temp path when file path is already a temp path', async () => {
      // When file_path is already a temp path, convertFinalToTemp should NOT be called
      tempPathManager.isTempPath.mockReturnValue(true);

      const mockVideoDownload = {
        youtube_id: 'abc123XYZ_d',
        file_path: '/output/.youtarr_tmp/Channel - Title - abc123XYZ_d',
        destroy: jest.fn().mockResolvedValue()
      };

      JobVideoDownload.findAll.mockResolvedValue([mockVideoDownload]);
      mockFsPromises.access.mockResolvedValue(); // Path exists
      mockFsPromises.readdir.mockResolvedValue(['video.mp4']);
      mockFsPromises.stat.mockResolvedValue({ isFile: () => true, isDirectory: () => false });

      await cleanupInProgressVideos('job-123');

      // Should check the original temp path (first call)
      expect(mockFsPromises.access).toHaveBeenNthCalledWith(1, '/output/.youtarr_tmp/Channel - Title - abc123XYZ_d');
      // convertFinalToTemp should not be called since file_path is already temp
      expect(tempPathManager.convertFinalToTemp).not.toHaveBeenCalled();
    });

    it('should handle file removal errors gracefully', async () => {
      const mockVideoDownload = {
        youtube_id: 'abc123XYZ_d',
        file_path: '/output/Channel - Title - abc123XYZ_d',
        destroy: jest.fn().mockResolvedValue()
      };

      JobVideoDownload.findAll.mockResolvedValue([mockVideoDownload]);
      mockFsPromises.access.mockResolvedValue(); // Directory exists
      mockFsPromises.readdir.mockResolvedValue(['video.mp4']);
      mockFsPromises.stat.mockResolvedValue({ isFile: () => true, isDirectory: () => false });
      mockFsPromises.unlink.mockRejectedValue(new Error('Permission denied'));

      await cleanupInProgressVideos('job-123');

      expect(logger.error).toHaveBeenCalledWith(
        { err: expect.any(Error), fileName: 'video.mp4' },
        'Error removing file'
      );
    });
  });

  describe('cleanupPartialFiles', () => {
    it('should remove .part files', async () => {
      const files = ['/output/video.mp4'];
      // access() resolves to indicate file exists
      mockFsPromises.access
        .mockResolvedValueOnce() // .part file exists
        .mockRejectedValueOnce(); // For subsequent call in readdir error catch

      await cleanupPartialFiles(files);

      expect(mockFsPromises.access).toHaveBeenCalledWith('/output/video.mp4.part');
      expect(mockFsPromises.unlink).toHaveBeenCalledWith('/output/video.mp4.part');
    });

    it('should remove fragment files', async () => {
      const path = require('path');
      const files = ['/output/Channel - Title [abc123XYZ_d].mp4'];
      mockFsPromises.access
        .mockRejectedValueOnce(new Error('Not found')); // .part doesn't exist
      mockFsPromises.readdir.mockResolvedValue([
        'Channel - Title [abc123XYZ_d].f137.mp4',
        'Channel - Title [abc123XYZ_d].f140.m4a',
        'other-file.txt'
      ]);

      await cleanupPartialFiles(files);

      const dir = path.dirname(files[0]);
      expect(mockFsPromises.readdir).toHaveBeenCalledWith(dir);
      // Check that fragment files were removed
      const unlinkCalls = mockFsPromises.unlink.mock.calls;
      expect(unlinkCalls.some(call => call[0].includes('.f137.mp4'))).toBe(true);
      expect(unlinkCalls.some(call => call[0].includes('.f140.m4a'))).toBe(true);
      expect(unlinkCalls.some(call => call[0].includes('other-file.txt'))).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      const files = ['/output/video.mp4'];
      mockFsPromises.access.mockRejectedValue(new Error('Access error'));
      mockFsPromises.readdir.mockRejectedValue(new Error('Read error'));

      await cleanupPartialFiles(files);

      expect(logger.error).toHaveBeenCalledWith(
        { err: expect.any(Error), dir: '/output' },
        'Error reading directory'
      );
    });

    it('should not log an error when the partial file directory was already moved', async () => {
      const files = ['/output/video.mp4'];
      const enoent = new Error('No such file or directory');
      enoent.code = 'ENOENT';
      mockFsPromises.access.mockRejectedValue(new Error('Access error'));
      mockFsPromises.readdir.mockRejectedValue(enoent);

      await cleanupPartialFiles(files);

      expect(logger.debug).toHaveBeenCalledWith(
        { err: enoent, dir: '/output' },
        'Partial file directory already removed'
      );
      expect(logger.error).not.toHaveBeenCalledWith(
        expect.objectContaining({ dir: '/output' }),
        'Error reading directory'
      );
    });
  });
});
