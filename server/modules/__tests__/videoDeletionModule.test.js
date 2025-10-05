/* eslint-env jest */

describe('VideoDeletionModule', () => {
  let VideoDeletionModule;
  let mockVideo;
  let mockFs;
  let consoleErrorSpy;
  let consoleLogSpy;
  let consoleInfoSpy;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    // Mock the Video model
    mockVideo = {
      findByPk: jest.fn(),
      findOne: jest.fn()
    };

    // Mock fs.promises
    mockFs = {
      rm: jest.fn()
    };

    // Mock the models
    jest.doMock('../../models', () => ({
      Video: mockVideo
    }));

    // Mock fs
    jest.doMock('fs', () => ({
      promises: mockFs
    }));

    // Spy on console methods
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();

    // Require the module after mocks are in place
    VideoDeletionModule = require('../videoDeletionModule');
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
    consoleInfoSpy.mockRestore();
  });

  describe('deleteVideoById', () => {
    test('should successfully delete video with file', async () => {
      const mockVideoRecord = {
        id: 1,
        youtubeId: 'abc123',
        filePath: '/test/output/Channel Name/Channel Name - Video Title - abc123/video.mp4',
        removed: false,
        update: jest.fn().mockResolvedValue()
      };

      mockVideo.findByPk.mockResolvedValue(mockVideoRecord);
      mockFs.rm.mockResolvedValue();

      const result = await VideoDeletionModule.deleteVideoById(1);

      expect(mockVideo.findByPk).toHaveBeenCalledWith(1);
      expect(mockFs.rm).toHaveBeenCalledWith(
        '/test/output/Channel Name/Channel Name - Video Title - abc123',
        { recursive: true, force: true }
      );
      expect(mockVideoRecord.update).toHaveBeenCalledWith({ removed: true });
      expect(result).toEqual({
        success: true,
        videoId: 1,
        message: 'Video deleted successfully'
      });
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Deleted video directory')
      );
    });

    test('should return error when video not found', async () => {
      mockVideo.findByPk.mockResolvedValue(null);

      const result = await VideoDeletionModule.deleteVideoById(999);

      expect(result).toEqual({
        success: false,
        videoId: 999,
        error: 'Video not found in database'
      });
      expect(mockFs.rm).not.toHaveBeenCalled();
    });

    test('should return error when video already marked as removed', async () => {
      const mockVideoRecord = {
        id: 1,
        youtubeId: 'abc123',
        filePath: '/test/path/video.mp4',
        removed: true
      };

      mockVideo.findByPk.mockResolvedValue(mockVideoRecord);

      const result = await VideoDeletionModule.deleteVideoById(1);

      expect(result).toEqual({
        success: false,
        videoId: 1,
        error: 'Video is already marked as removed'
      });
      expect(mockFs.rm).not.toHaveBeenCalled();
    });

    test('should mark video as removed when no file path exists', async () => {
      const mockVideoRecord = {
        id: 1,
        youtubeId: 'abc123',
        filePath: null,
        removed: false,
        update: jest.fn().mockResolvedValue()
      };

      mockVideo.findByPk.mockResolvedValue(mockVideoRecord);

      const result = await VideoDeletionModule.deleteVideoById(1);

      expect(mockVideoRecord.update).toHaveBeenCalledWith({ removed: true });
      expect(mockFs.rm).not.toHaveBeenCalled();
      expect(result).toEqual({
        success: true,
        videoId: 1,
        message: 'Video marked as removed (no file path)'
      });
    });

    test('should fail safety check when directory does not contain youtube ID', async () => {
      const mockVideoRecord = {
        id: 1,
        youtubeId: 'abc123',
        filePath: '/test/output/wrong-directory/video.mp4',
        removed: false
      };

      mockVideo.findByPk.mockResolvedValue(mockVideoRecord);

      const result = await VideoDeletionModule.deleteVideoById(1);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Safety check failed')
      );
      expect(result).toEqual({
        success: false,
        videoId: 1,
        error: 'Safety check failed: invalid directory path'
      });
      expect(mockFs.rm).not.toHaveBeenCalled();
    });

    test('should handle ENOENT error when directory already deleted', async () => {
      const mockVideoRecord = {
        id: 1,
        youtubeId: 'abc123',
        filePath: '/test/output/Channel/Channel - Video - abc123/video.mp4',
        removed: false,
        update: jest.fn().mockResolvedValue()
      };

      mockVideo.findByPk.mockResolvedValue(mockVideoRecord);

      const enoentError = new Error('ENOENT: no such file or directory');
      enoentError.code = 'ENOENT';
      mockFs.rm.mockRejectedValue(enoentError);

      const result = await VideoDeletionModule.deleteVideoById(1);

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('already removed')
      );
      expect(mockVideoRecord.update).toHaveBeenCalledWith({ removed: true });
      expect(result).toEqual({
        success: true,
        videoId: 1,
        message: 'Video deleted successfully'
      });
    });

    test('should return error when file deletion fails with permission error', async () => {
      const mockVideoRecord = {
        id: 1,
        youtubeId: 'abc123',
        filePath: '/test/output/Channel/Channel - Video - abc123/video.mp4',
        removed: false
      };

      mockVideo.findByPk.mockResolvedValue(mockVideoRecord);

      const permissionError = new Error('EACCES: permission denied');
      permissionError.code = 'EACCES';
      mockFs.rm.mockRejectedValue(permissionError);

      const result = await VideoDeletionModule.deleteVideoById(1);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to delete directory'),
        permissionError
      );
      expect(result).toEqual({
        success: false,
        videoId: 1,
        error: 'Failed to delete video files from disk. Please check filesystem permissions.'
      });
    });

    test('should handle database update errors', async () => {
      const mockVideoRecord = {
        id: 1,
        youtubeId: 'abc123',
        filePath: '/test/output/Channel/Channel - Video - abc123/video.mp4',
        removed: false,
        update: jest.fn().mockRejectedValue(new Error('Database error'))
      };

      mockVideo.findByPk.mockResolvedValue(mockVideoRecord);
      mockFs.rm.mockResolvedValue();

      const result = await VideoDeletionModule.deleteVideoById(1);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error deleting video'),
        expect.any(Error)
      );
      expect(result).toEqual({
        success: false,
        videoId: 1,
        error: 'Database error'
      });
    });

    test('should handle unexpected errors gracefully', async () => {
      mockVideo.findByPk.mockRejectedValue(new Error('Unexpected error'));

      const result = await VideoDeletionModule.deleteVideoById(1);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error deleting video'),
        expect.any(Error)
      );
      expect(result).toEqual({
        success: false,
        videoId: 1,
        error: 'Unexpected error'
      });
    });

    test('should return generic error message when error has no message', async () => {
      mockVideo.findByPk.mockRejectedValue({});

      const result = await VideoDeletionModule.deleteVideoById(1);

      expect(result).toEqual({
        success: false,
        videoId: 1,
        error: 'Unknown error occurred'
      });
    });
  });

  describe('deleteVideos', () => {
    test('should successfully delete multiple videos', async () => {
      const mockVideo1 = {
        id: 1,
        youtubeId: 'abc123',
        filePath: '/test/output/Channel/Channel - Video1 - abc123/video.mp4',
        removed: false,
        update: jest.fn().mockResolvedValue()
      };

      const mockVideo2 = {
        id: 2,
        youtubeId: 'def456',
        filePath: '/test/output/Channel/Channel - Video2 - def456/video.mp4',
        removed: false,
        update: jest.fn().mockResolvedValue()
      };

      mockVideo.findByPk
        .mockResolvedValueOnce(mockVideo1)
        .mockResolvedValueOnce(mockVideo2);
      mockFs.rm.mockResolvedValue();

      const result = await VideoDeletionModule.deleteVideos([1, 2]);

      expect(result).toEqual({
        success: true,
        deleted: [1, 2],
        failed: []
      });
    });

    test('should handle partial failures', async () => {
      const mockVideo1 = {
        id: 1,
        youtubeId: 'abc123',
        filePath: '/test/output/Channel/Channel - Video1 - abc123/video.mp4',
        removed: false,
        update: jest.fn().mockResolvedValue()
      };

      mockVideo.findByPk
        .mockResolvedValueOnce(mockVideo1)
        .mockResolvedValueOnce(null); // Second video not found
      mockFs.rm.mockResolvedValue();

      const result = await VideoDeletionModule.deleteVideos([1, 2]);

      expect(result).toEqual({
        success: false,
        deleted: [1],
        failed: [
          {
            videoId: 2,
            error: 'Video not found in database'
          }
        ]
      });
    });

    test('should handle all videos failing', async () => {
      mockVideo.findByPk.mockResolvedValue(null);

      const result = await VideoDeletionModule.deleteVideos([1, 2, 3]);

      expect(result).toEqual({
        success: false,
        deleted: [],
        failed: [
          { videoId: 1, error: 'Video not found in database' },
          { videoId: 2, error: 'Video not found in database' },
          { videoId: 3, error: 'Video not found in database' }
        ]
      });
    });

    test('should handle empty video array', async () => {
      const result = await VideoDeletionModule.deleteVideos([]);

      expect(result).toEqual({
        success: true,
        deleted: [],
        failed: []
      });
      expect(mockVideo.findByPk).not.toHaveBeenCalled();
    });

    test('should process videos sequentially', async () => {
      const callOrder = [];

      const mockVideo1 = {
        id: 1,
        youtubeId: 'abc123',
        filePath: '/test/output/Channel/Channel - Video1 - abc123/video.mp4',
        removed: false,
        update: jest.fn().mockImplementation(async () => {
          callOrder.push('update1');
        })
      };

      const mockVideo2 = {
        id: 2,
        youtubeId: 'def456',
        filePath: '/test/output/Channel/Channel - Video2 - def456/video.mp4',
        removed: false,
        update: jest.fn().mockImplementation(async () => {
          callOrder.push('update2');
        })
      };

      mockVideo.findByPk
        .mockImplementation(async (id) => {
          callOrder.push(`find${id}`);
          return id === 1 ? mockVideo1 : mockVideo2;
        });

      mockFs.rm.mockImplementation(async () => {
        callOrder.push('rm');
      });

      await VideoDeletionModule.deleteVideos([1, 2]);

      // Verify sequential processing
      expect(callOrder).toEqual(['find1', 'rm', 'update1', 'find2', 'rm', 'update2']);
    });

    test('should include error message when deletion fails', async () => {
      const mockVideo1 = {
        id: 1,
        youtubeId: 'abc123',
        filePath: '/test/wrong-path/video.mp4',
        removed: false
      };

      mockVideo.findByPk.mockResolvedValue(mockVideo1);

      const result = await VideoDeletionModule.deleteVideos([1]);

      expect(result.failed[0]).toEqual({
        videoId: 1,
        error: 'Safety check failed: invalid directory path'
      });
    });
  });

  describe('deleteVideosByYoutubeIds', () => {
    test('should successfully delete videos by YouTube IDs', async () => {
      const mockVideo1 = {
        id: 1,
        youtubeId: 'abc123',
        filePath: '/test/output/Channel/Channel - Video1 - abc123/video.mp4',
        removed: false,
        update: jest.fn().mockResolvedValue()
      };

      const mockVideo2 = {
        id: 2,
        youtubeId: 'def456',
        filePath: '/test/output/Channel/Channel - Video2 - def456/video.mp4',
        removed: false,
        update: jest.fn().mockResolvedValue()
      };

      // Mock findOne to return the videos when searching by YouTube ID
      mockVideo.findOne
        .mockResolvedValueOnce(mockVideo1)
        .mockResolvedValueOnce(mockVideo2);

      // Mock findByPk which is called by deleteVideoById
      mockVideo.findByPk
        .mockResolvedValueOnce(mockVideo1)
        .mockResolvedValueOnce(mockVideo2);

      mockFs.rm.mockResolvedValue();

      const result = await VideoDeletionModule.deleteVideosByYoutubeIds(['abc123', 'def456']);

      expect(mockVideo.findOne).toHaveBeenCalledWith({
        where: { youtubeId: 'abc123' }
      });
      expect(mockVideo.findOne).toHaveBeenCalledWith({
        where: { youtubeId: 'def456' }
      });
      expect(result).toEqual({
        success: true,
        deleted: ['abc123', 'def456'],
        failed: []
      });
    });

    test('should handle video not found by YouTube ID', async () => {
      mockVideo.findOne.mockResolvedValue(null);

      const result = await VideoDeletionModule.deleteVideosByYoutubeIds(['nonexistent123']);

      expect(result).toEqual({
        success: false,
        deleted: [],
        failed: [
          {
            youtubeId: 'nonexistent123',
            error: 'Video not found in database'
          }
        ]
      });
    });

    test('should handle partial failures with YouTube IDs', async () => {
      const mockVideo1 = {
        id: 1,
        youtubeId: 'abc123',
        filePath: '/test/output/Channel/Channel - Video1 - abc123/video.mp4',
        removed: false,
        update: jest.fn().mockResolvedValue()
      };

      mockVideo.findOne
        .mockResolvedValueOnce(mockVideo1)
        .mockResolvedValueOnce(null);

      // Mock findByPk for the successful deletion
      mockVideo.findByPk.mockResolvedValueOnce(mockVideo1);

      mockFs.rm.mockResolvedValue();

      const result = await VideoDeletionModule.deleteVideosByYoutubeIds(['abc123', 'notfound456']);

      expect(result).toEqual({
        success: false,
        deleted: ['abc123'],
        failed: [
          {
            youtubeId: 'notfound456',
            error: 'Video not found in database'
          }
        ]
      });
    });

    test('should handle database errors when finding video', async () => {
      mockVideo.findOne.mockRejectedValue(new Error('Database connection lost'));

      const result = await VideoDeletionModule.deleteVideosByYoutubeIds(['abc123']);

      expect(result).toEqual({
        success: false,
        deleted: [],
        failed: [
          {
            youtubeId: 'abc123',
            error: 'Database connection lost'
          }
        ]
      });
    });

    test('should handle errors during deletion with YouTube IDs', async () => {
      const mockVideo1 = {
        id: 1,
        youtubeId: 'abc123',
        filePath: '/test/wrong-path/video.mp4',
        removed: false
      };

      mockVideo.findOne.mockResolvedValue(mockVideo1);
      mockVideo.findByPk.mockResolvedValue(mockVideo1);

      const result = await VideoDeletionModule.deleteVideosByYoutubeIds(['abc123']);

      expect(result).toEqual({
        success: false,
        deleted: [],
        failed: [
          {
            youtubeId: 'abc123',
            error: 'Safety check failed: invalid directory path'
          }
        ]
      });
    });

    test('should handle empty YouTube IDs array', async () => {
      const result = await VideoDeletionModule.deleteVideosByYoutubeIds([]);

      expect(result).toEqual({
        success: true,
        deleted: [],
        failed: []
      });
      expect(mockVideo.findOne).not.toHaveBeenCalled();
    });

    test('should handle error with no message', async () => {
      mockVideo.findOne.mockRejectedValue({});

      const result = await VideoDeletionModule.deleteVideosByYoutubeIds(['abc123']);

      expect(result.failed[0]).toEqual({
        youtubeId: 'abc123',
        error: 'Unknown error occurred'
      });
    });
  });

  describe('module export', () => {
    test('should export a singleton instance', () => {
      jest.resetModules();

      jest.doMock('../../models', () => ({
        Video: mockVideo
      }));

      jest.doMock('fs', () => ({
        promises: mockFs
      }));

      const VideoDeletionModule1 = require('../videoDeletionModule');
      const VideoDeletionModule2 = require('../videoDeletionModule');

      expect(VideoDeletionModule1).toBe(VideoDeletionModule2);
    });
  });
});
