/* eslint-env jest */

// Mock logger before any imports
jest.mock('../../logger');

jest.mock('../m3uGenerator', () => ({
  generateChannelM3UInBackground: jest.fn()
}));

jest.mock('../storageGuard', () => ({
  getStatus: jest.fn(() => ({ paused: false })),
  refresh: jest.fn().mockResolvedValue({ paused: false })
}));

describe('VideoDeletionModule', () => {
  let VideoDeletionModule;
  let mockVideo;
  let mockFs;
  let mockLogger;
  let mockFilesystem;
  let m3uGenerator;
  let MockSequelize;
  let mockSequelize;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    // Get the mocked logger
    mockLogger = require('../../logger');

    m3uGenerator = require('../m3uGenerator');

    // Mock the Video model
    mockVideo = {
      findAll: jest.fn().mockResolvedValue([]),
      findByPk: jest.fn(),
      findOne: jest.fn()
    };

    // Mock fs.promises (only the methods videoDeletionModule still calls directly,
    // i.e. flat-mode readdir/unlink). The nested-mode rm path now goes through
    // filesystem.removeDirectoryResilient and is mocked there.
    mockFs = {
      readdir: jest.fn().mockResolvedValue([]),
      unlink: jest.fn()
    };

    // Mock the filesystem module (isVideoDirectory, cleanupEmptyChannelDirectory, etc.).
    // removeDirectoryResilient defaults to success so existing tests don't need to
    // wire it up explicitly; tests that need a failure path override per-test.
    mockFilesystem = {
      isVideoDirectory: jest.fn(() => true),
      cleanupEmptyChannelDirectory: jest.fn().mockResolvedValue(false),
      cleanupEmptyParents: jest.fn().mockResolvedValue(),
      isSubfolderDir: jest.fn((name) => name.startsWith('__')),
      listSubdirectories: jest.fn().mockResolvedValue([]),
      removeDirectoryResilient: jest.fn().mockResolvedValue()
    };

    // Mock the models
    jest.doMock('../../models', () => ({
      Video: mockVideo
    }));

    // Mock fs
    jest.doMock('fs', () => ({
      promises: mockFs
    }));

    jest.doMock('../filesystem', () => mockFilesystem);

    // Mock configModule for _tryCleanupChannelDirectory
    jest.doMock('../configModule', () => ({
      directoryPath: '/test/output'
    }));

    MockSequelize = {
      Op: {
        and: Symbol('and'),
        lt: Symbol('lt'),
        not: Symbol('not'),
        notIn: Symbol('notIn'),
      },
      QueryTypes: { SELECT: 'SELECT' },
    };
    mockSequelize = {
      query: jest.fn(),
      dialect: {},
      col: jest.fn((name) => name),
      fn: jest.fn((...args) => ['fn', args]),
      where: jest.fn((...args) => ['where', args]),
      literal: jest.fn((sql) => sql),
    };
    jest.doMock('../../db.js', () => ({
      Sequelize: MockSequelize,
      sequelize: mockSequelize,
    }));

    // Require the module after mocks are in place
    VideoDeletionModule = require('../videoDeletionModule');
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

      const result = await VideoDeletionModule.deleteVideoById(1);

      expect(mockVideo.findByPk).toHaveBeenCalledWith(1);
      expect(mockFilesystem.removeDirectoryResilient).toHaveBeenCalledWith(
        '/test/output/Channel Name/Channel Name - Video Title - abc123'
      );
      expect(mockVideoRecord.update).toHaveBeenCalledWith({ removed: true });
      expect(result).toEqual({
        success: true,
        videoId: 1,
        message: 'Video deleted successfully'
      });
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ videoId: 1 }),
        'Deleted video directory'
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
      expect(mockFilesystem.removeDirectoryResilient).not.toHaveBeenCalled();
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
      expect(mockFilesystem.removeDirectoryResilient).not.toHaveBeenCalled();
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
      expect(mockFilesystem.removeDirectoryResilient).not.toHaveBeenCalled();
      expect(result).toEqual({
        success: true,
        videoId: 1,
        message: 'Video marked as removed (no file path)'
      });
    });

    test('deletes the video directory of an audio-only download', async () => {
      const mockVideoRecord = {
        id: 1,
        youtubeId: 'abc123',
        filePath: null,
        audioFilePath: '/test/output/Channel Name/Channel Name - Song - abc123/Song [abc123].mp3',
        removed: false,
        update: jest.fn().mockResolvedValue()
      };
      mockVideo.findByPk.mockResolvedValue(mockVideoRecord);

      const result = await VideoDeletionModule.deleteVideoById(1);

      expect(mockFilesystem.removeDirectoryResilient).toHaveBeenCalledWith(
        '/test/output/Channel Name/Channel Name - Song - abc123'
      );
      expect(result.message).toBe('Video deleted successfully');
    });

    test('deletes matching files of a flat audio-only download', async () => {
      mockFilesystem.isVideoDirectory.mockReturnValue(false);
      mockFs.readdir.mockResolvedValue(['Song [abc123].mp3', 'Other [zzz999].mp3']);
      mockVideo.findByPk.mockResolvedValue({
        id: 1,
        youtubeId: 'abc123',
        filePath: null,
        audioFilePath: '/test/output/Channel Name/Song [abc123].mp3',
        removed: false,
        update: jest.fn().mockResolvedValue()
      });

      await VideoDeletionModule.deleteVideoById(1);

      expect(mockFs.unlink).toHaveBeenCalledTimes(1);
      expect(mockFs.unlink).toHaveBeenCalledWith('/test/output/Channel Name/Song [abc123].mp3');
    });

    test('fails the safety check for an audio path without the youtube ID', async () => {
      mockVideo.findByPk.mockResolvedValue({
        id: 1,
        youtubeId: 'abc123',
        filePath: null,
        audioFilePath: '/test/output/wrong-directory/song.mp3',
        removed: false,
        update: jest.fn().mockResolvedValue()
      });

      const result = await VideoDeletionModule.deleteVideoById(1);

      expect(result.error).toBe('Safety check failed: invalid file path');
      expect(mockFilesystem.removeDirectoryResilient).not.toHaveBeenCalled();
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

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ videoId: 1 }),
        expect.stringContaining('Safety check failed')
      );
      expect(result).toEqual({
        success: false,
        videoId: 1,
        error: 'Safety check failed: invalid file path'
      });
      expect(mockFilesystem.removeDirectoryResilient).not.toHaveBeenCalled();
    });

    test('should report success when removeDirectoryResilient handles missing dir internally', async () => {
      // removeDirectoryResilient swallows ENOENT and resolves cleanly, so
      // videoDeletionModule still completes the DB update and reports success.
      const mockVideoRecord = {
        id: 1,
        youtubeId: 'abc123',
        filePath: '/test/output/Channel/Channel - Video - abc123/video.mp4',
        removed: false,
        update: jest.fn().mockResolvedValue()
      };

      mockVideo.findByPk.mockResolvedValue(mockVideoRecord);
      mockFilesystem.removeDirectoryResilient.mockResolvedValue();

      const result = await VideoDeletionModule.deleteVideoById(1);

      expect(mockFilesystem.removeDirectoryResilient).toHaveBeenCalledWith(
        '/test/output/Channel/Channel - Video - abc123'
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
      mockFilesystem.removeDirectoryResilient.mockRejectedValue(permissionError);

      const result = await VideoDeletionModule.deleteVideoById(1);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ videoId: 1, err: permissionError }),
        'Failed to delete video files'
      );
      expect(result).toEqual({
        success: false,
        videoId: 1,
        error: 'Failed to delete video files from disk. Please check filesystem permissions.'
      });
    });

    test('delegates nested-mode directory removal to removeDirectoryResilient', async () => {
      // The retry / AppleDouble sweep behavior is covered in directoryManager tests.
      // Here we just verify videoDeletionModule routes through the helper instead
      // of calling fs.rm directly.
      const mockVideoRecord = {
        id: 1,
        youtubeId: 'abc123',
        filePath: '/test/output/Channel/Channel - Video - abc123/video.mp4',
        removed: false,
        update: jest.fn().mockResolvedValue()
      };

      mockVideo.findByPk.mockResolvedValue(mockVideoRecord);

      const result = await VideoDeletionModule.deleteVideoById(1);

      expect(mockFilesystem.removeDirectoryResilient).toHaveBeenCalledTimes(1);
      expect(mockFilesystem.removeDirectoryResilient).toHaveBeenCalledWith(
        '/test/output/Channel/Channel - Video - abc123'
      );
      expect(result.success).toBe(true);
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

      const result = await VideoDeletionModule.deleteVideoById(1);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ videoId: 1, err: expect.any(Error) }),
        'Error deleting video'
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

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ videoId: 1, err: expect.any(Error) }),
        'Error deleting video'
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

  describe('_tryCleanupChannelDirectory', () => {
    test('should call cleanupEmptyChannelDirectory with grandparent path for nested deletion', async () => {
      const mockVideoRecord = {
        id: 1,
        youtubeId: 'abc123',
        filePath: '/test/output/Channel Name/Channel Name - Video Title - abc123/video.mp4',
        removed: false,
        update: jest.fn().mockResolvedValue()
      };

      mockVideo.findByPk.mockResolvedValue(mockVideoRecord);

      await VideoDeletionModule.deleteVideoById(1);

      expect(mockFilesystem.cleanupEmptyChannelDirectory).toHaveBeenCalledWith(
        '/test/output/Channel Name',
        '/test/output',
        { includeIgnorableFiles: true }
      );
    });

    test('should call cleanupEmptyChannelDirectory with parent path for flat deletion', async () => {
      // Override isVideoDirectory to return false for flat mode
      mockFilesystem.isVideoDirectory.mockReturnValue(false);

      const mockVideoRecord = {
        id: 1,
        youtubeId: 'abc123',
        filePath: '/test/output/Channel Name/Channel Name - Video Title [abc123].mp4',
        removed: false,
        update: jest.fn().mockResolvedValue()
      };

      mockVideo.findByPk.mockResolvedValue(mockVideoRecord);
      mockFs.readdir.mockResolvedValue([]);

      await VideoDeletionModule.deleteVideoById(1);

      expect(mockFilesystem.cleanupEmptyChannelDirectory).toHaveBeenCalledWith(
        '/test/output/Channel Name',
        '/test/output',
        { includeIgnorableFiles: true }
      );
    });

    test('should NOT call cleanup when video has no filePath', async () => {
      const mockVideoRecord = {
        id: 1,
        youtubeId: 'abc123',
        filePath: null,
        removed: false,
        update: jest.fn().mockResolvedValue()
      };

      mockVideo.findByPk.mockResolvedValue(mockVideoRecord);

      await VideoDeletionModule.deleteVideoById(1);

      expect(mockFilesystem.cleanupEmptyChannelDirectory).not.toHaveBeenCalled();
    });

    test('should NOT call cleanup when file deletion fails', async () => {
      const mockVideoRecord = {
        id: 1,
        youtubeId: 'abc123',
        filePath: '/test/output/Channel/Channel - Video - abc123/video.mp4',
        removed: false
      };

      mockVideo.findByPk.mockResolvedValue(mockVideoRecord);

      const permissionError = new Error('EACCES');
      permissionError.code = 'EACCES';
      mockFilesystem.removeDirectoryResilient.mockRejectedValue(permissionError);

      await VideoDeletionModule.deleteVideoById(1);

      expect(mockFilesystem.cleanupEmptyChannelDirectory).not.toHaveBeenCalled();
    });

    test('should not affect success response when cleanup throws', async () => {
      mockFilesystem.cleanupEmptyChannelDirectory.mockRejectedValueOnce(new Error('cleanup failed'));

      const mockVideoRecord = {
        id: 1,
        youtubeId: 'abc123',
        filePath: '/test/output/Channel Name/Channel Name - Video Title - abc123/video.mp4',
        removed: false,
        update: jest.fn().mockResolvedValue()
      };

      mockVideo.findByPk.mockResolvedValue(mockVideoRecord);

      const result = await VideoDeletionModule.deleteVideoById(1);

      expect(result.success).toBe(true);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ err: expect.any(Error) }),
        expect.stringContaining('non-fatal')
      );
    });

    test('should call cleanupEmptyParents when channel dir was removed', async () => {
      mockFilesystem.cleanupEmptyChannelDirectory.mockResolvedValueOnce(true);

      const mockVideoRecord = {
        id: 1,
        youtubeId: 'abc123',
        filePath: '/test/output/__subfolder/Channel Name/Channel Name - Video Title - abc123/video.mp4',
        removed: false,
        update: jest.fn().mockResolvedValue()
      };

      mockVideo.findByPk.mockResolvedValue(mockVideoRecord);

      await VideoDeletionModule.deleteVideoById(1);

      expect(mockFilesystem.cleanupEmptyParents).toHaveBeenCalledWith(
        '/test/output/__subfolder',
        '/test/output'
      );
    });

    test('should NOT call cleanupEmptyParents when channel dir was not removed', async () => {
      mockFilesystem.cleanupEmptyChannelDirectory.mockResolvedValueOnce(false);

      const mockVideoRecord = {
        id: 1,
        youtubeId: 'abc123',
        filePath: '/test/output/Channel Name/Channel Name - Video Title - abc123/video.mp4',
        removed: false,
        update: jest.fn().mockResolvedValue()
      };

      mockVideo.findByPk.mockResolvedValue(mockVideoRecord);

      await VideoDeletionModule.deleteVideoById(1);

      expect(mockFilesystem.cleanupEmptyParents).not.toHaveBeenCalled();
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

      mockFilesystem.removeDirectoryResilient.mockImplementation(async () => {
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
        error: 'Safety check failed: invalid file path'
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
            error: 'Safety check failed: invalid file path'
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

  describe('channel m3u regeneration after deletion', () => {
    // Uses the no-file-path branch of deleteVideoById: the video is marked
    // removed without any fs interaction, so only the Video model mock matters.
    const makeVideo = (id, channelId) => ({
      id,
      youtubeId: `yt${id}`,
      channel_id: channelId,
      removed: false,
      filePath: null,
      update: jest.fn().mockResolvedValue(undefined)
    });

    test('regenerates once per unique channel after deleteVideos', async () => {
      mockVideo.findByPk
        .mockResolvedValueOnce(makeVideo(1, 'UC1'))
        .mockResolvedValueOnce(makeVideo(2, 'UC1'))
        .mockResolvedValueOnce(makeVideo(3, 'UC2'));

      await VideoDeletionModule.deleteVideos([1, 2, 3]);

      expect(m3uGenerator.generateChannelM3UInBackground).toHaveBeenCalledTimes(2);
      expect(m3uGenerator.generateChannelM3UInBackground).toHaveBeenCalledWith('UC1', expect.any(String));
      expect(m3uGenerator.generateChannelM3UInBackground).toHaveBeenCalledWith('UC2', expect.any(String));
    });

    test('does not regenerate when nothing was deleted', async () => {
      mockVideo.findByPk.mockResolvedValue(null);

      await VideoDeletionModule.deleteVideos([99]);

      expect(m3uGenerator.generateChannelM3UInBackground).not.toHaveBeenCalled();
    });
  });

  describe('download pause re-check after deletion', () => {
    let storageGuard;

    beforeEach(() => {
      storageGuard = require('../storageGuard');
      mockVideo.findByPk.mockResolvedValue({
        id: 1,
        youtubeId: 'abc123',
        channel_id: 'UC1',
        filePath: null,
        removed: false,
        update: jest.fn().mockResolvedValue()
      });
    });

    test('re-checks the pause when videos are deleted while paused', async () => {
      storageGuard.getStatus.mockReturnValue({ paused: true });

      await VideoDeletionModule.deleteVideos([1]);

      expect(storageGuard.refresh).toHaveBeenCalledTimes(1);
    });

    test('does not re-check when downloads are not paused', async () => {
      storageGuard.getStatus.mockReturnValue({ paused: false });

      await VideoDeletionModule.deleteVideos([1]);

      expect(storageGuard.refresh).not.toHaveBeenCalled();
    });

    test('does not re-check when nothing was deleted', async () => {
      storageGuard.getStatus.mockReturnValue({ paused: true });
      mockVideo.findByPk.mockResolvedValue(null);

      await VideoDeletionModule.deleteVideos([1]);

      expect(storageGuard.refresh).not.toHaveBeenCalled();
    });
  });

  describe('formatVideoForPlan', () => {
    test('should format video metadata correctly', () => {
      const video = {
        id: 123,
        youtubeId: 'abc123',
        youTubeVideoName: 'Test Video Title',
        youTubeChannelName: 'Test Channel',
        fileSize: '1234567890',
        timeCreated: new Date('2024-01-01T00:00:00Z')
      };

      const result = VideoDeletionModule.formatVideoForPlan(video);

      expect(result).toEqual({
        id: 123,
        youtubeId: 'abc123',
        title: 'Test Video Title',
        channel: 'Test Channel',
        fileSize: 1234567890,
        timeCreated: new Date('2024-01-01T00:00:00Z')
      });
    });

    test('should handle missing fileSize', () => {
      const video = {
        id: 456,
        youtubeId: 'def456',
        youTubeVideoName: 'Another Video',
        youTubeChannelName: 'Another Channel',
        fileSize: null,
        timeCreated: new Date('2024-02-01T00:00:00Z')
      };

      const result = VideoDeletionModule.formatVideoForPlan(video);

      expect(result.fileSize).toBe(0);
    });

    test('should parse string fileSize to integer', () => {
      const video = {
        id: 789,
        youtubeId: 'ghi789',
        youTubeVideoName: 'Video',
        youTubeChannelName: 'Channel',
        fileSize: '9876543210',
        timeCreated: new Date('2024-03-01T00:00:00Z')
      };

      const result = VideoDeletionModule.formatVideoForPlan(video);

      expect(result.fileSize).toBe(9876543210);
      expect(typeof result.fileSize).toBe('number');
    });
  });

  describe('getVideosOlderThanThreshold', () => {
    beforeEach(() => {
      jest.resetModules();
      mockLogger = require('../../logger');
      VideoDeletionModule = require('../videoDeletionModule');
    });

    test('should return videos older than threshold', async () => {
      const mockVideos = [
        {
          id: 1,
          youtubeId: 'abc123',
          youTubeVideoName: 'Old Video 1',
          youTubeChannelName: 'Channel A',
          fileSize: 1000000,
          timeCreated: new Date('2023-01-01')
        },
        {
          id: 2,
          youtubeId: 'def456',
          youTubeVideoName: 'Old Video 2',
          youTubeChannelName: 'Channel B',
          fileSize: 2000000,
          timeCreated: new Date('2023-02-01')
        }
      ];

      mockVideo.findAll.mockResolvedValue(mockVideos);

      const result = await VideoDeletionModule.getVideosOlderThanThreshold(30);

      expect(mockVideo.findAll).toHaveBeenCalledWith(expect.objectContaining({
        having: {
          timeCreated: expect.objectContaining({
            [MockSequelize.Op.lt]: mockSequelize.fn(
              'DATE_SUB',
              mockSequelize.fn('NOW'),
              mockSequelize.literal('INTERVAL 30 DAY'),
            ),
          }),
        },
      }));
      expect(result).toEqual(mockVideos);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ count: 2, ageInDays: 30 }),
        '[Auto-Removal] Found videos older than threshold'
      );
    });

    test('should return empty array when no old videos found', async () => {
      const result = await VideoDeletionModule.getVideosOlderThanThreshold(60);

      expect(result).toEqual([]);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ count: 0, ageInDays: 60 }),
        '[Auto-Removal] Found videos older than threshold'
      );
    });

    test('should handle database errors gracefully', async () => {
      mockVideo.findAll.mockRejectedValue(new Error('Database error'));

      const result = await VideoDeletionModule.getVideosOlderThanThreshold(30);

      expect(result).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ err: expect.any(Error) }),
        'Error getting videos older than threshold'
      );
    });

    test('should exclude protected videos from results', async () => {
      await VideoDeletionModule.getVideosOlderThanThreshold(30);

      expect(mockVideo.findAll).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          protected: false,
        }),
      }));
    });

    test('should exclude the provided video ids', async () => {
      await VideoDeletionModule.getVideosOlderThanThreshold(30, [7, 9]);

      expect(mockVideo.findAll).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          id: {
            [MockSequelize.Op.notIn]: [7, 9],
          },
        }),
        having: {
          timeCreated: expect.objectContaining({
            [MockSequelize.Op.lt]: mockSequelize.fn(
              'DATE_SUB',
              mockSequelize.fn('NOW'),
              mockSequelize.literal('INTERVAL 30 DAY'),
            ),
          }),
        },
      }));
    });
  });

  describe('getOldestVideos', () => {
    beforeEach(() => {
      jest.resetModules();
      mockLogger = require('../../logger');
      VideoDeletionModule = require('../videoDeletionModule');
    });

    test('should return oldest N videos', async () => {
      const mockVideos = [
        {
          id: 1,
          youtubeId: 'abc123',
          youTubeVideoName: 'Oldest Video',
          youTubeChannelName: 'Channel A',
          fileSize: 5000000,
          timeCreated: new Date('2023-01-01')
        }
      ];

      mockVideo.findAll.mockResolvedValue(mockVideos);

      const result = await VideoDeletionModule.getOldestVideos(10);

      expect(mockVideo.findAll).toHaveBeenCalledWith(expect.objectContaining({
        subQuery: false,
        limit: 10,
      }));
      expect(result).toEqual(mockVideos);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ count: 1, limit: 10 }),
        '[Auto-Removal] Found oldest videos'
      );
    });

    test('should exclude specified video IDs', async () => {
      const mockVideos = [
        {
          id: 5,
          youtubeId: 'xyz789',
          youTubeVideoName: 'Video',
          youTubeChannelName: 'Channel',
          fileSize: 3000000,
          timeCreated: new Date('2023-03-01')
        }
      ];

      mockVideo.findAll.mockResolvedValue(mockVideos);

      const result = await VideoDeletionModule.getOldestVideos(10, [1, 2, 3]);

      expect(mockVideo.findAll).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          id: {
            [MockSequelize.Op.notIn]: [1, 2, 3],
          },
        }),
      }));
      expect(result).toEqual(mockVideos);
    });

    test('should handle empty exclude list', async () => {
      const result = await VideoDeletionModule.getOldestVideos(5, []);

      expect(mockVideo.findAll).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.not.objectContaining({
          id: expect.objectContaining({
            [MockSequelize.Op.notIn]: expect.anything(),
          }),
        }),
      }));
      expect(result).toEqual([]);
    });

    test('should return empty array when no videos found', async () => {
      const result = await VideoDeletionModule.getOldestVideos(50);

      expect(result).toEqual([]);
    });

    test('should handle database errors gracefully', async () => {
      mockVideo.findAll.mockRejectedValue(new Error('Query failed'));

      const result = await VideoDeletionModule.getOldestVideos(10);

      expect(result).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ err: expect.any(Error) }),
        'Error getting oldest videos'
      );
    });

    test('should exclude protected videos from results', async () => {
      await VideoDeletionModule.getOldestVideos(10);

      expect(mockVideo.findAll).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          protected: false,
        }),
      }));
    });
  });

  describe('performAutomaticCleanup', () => {
    let mockConfigModule;
    let mockAutoRemovalQueries;
    let mockStorageUsage;

    beforeEach(() => {
      mockConfigModule = {
        getConfig: jest.fn(),
        getStorageStatus: jest.fn(),
        isStorageBelowThreshold: jest.fn(),
        convertStorageThresholdToBytes: jest.fn()
      };

      mockAutoRemovalQueries = {
        getBaseRemovalQueryOptions: jest.fn().mockReturnValue({ having: { timeCreated: {} } }),
        getRecentVideoIds: jest.fn().mockResolvedValue([]),
        getChannelKeepRecentIds: jest.fn().mockResolvedValue({ channelCount: 0, ids: [] }),
        getWatchedRemovalCandidates: jest.fn().mockResolvedValue([])
      };

      jest.doMock('../configModule', () => mockConfigModule);
      jest.doMock('../autoRemovalQueries', () => mockAutoRemovalQueries);

      mockStorageUsage = {
        getDownloadedBytes: jest.fn(),
        STORED_BYTES_SQL: '(COALESCE(videos.file_size, 0) + COALESCE(videos.audio_file_size, 0))'
      };
      jest.doMock('../storageUsage', () => mockStorageUsage);

      jest.resetModules();
      mockLogger = require('../../logger');
      m3uGenerator = require('../m3uGenerator');
      VideoDeletionModule = require('../videoDeletionModule');
    });

    test('should skip cleanup when auto-removal is disabled', async () => {
      mockConfigModule.getConfig.mockReturnValue({
        autoRemovalEnabled: false,
        autoRemovalVideoAgeThreshold: null,
        autoRemovalFreeSpaceThreshold: null
      });

      const result = await VideoDeletionModule.performAutomaticCleanup();

      expect(result.totalDeleted).toBe(0);
      expect(result.success).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith(
        '[Auto-Removal] Auto-removal is disabled, skipping cleanup'
      );
    });

    test('should skip cleanup when no thresholds configured', async () => {
      mockConfigModule.getConfig.mockReturnValue({
        autoRemovalEnabled: true,
        autoRemovalVideoAgeThreshold: null,
        autoRemovalFreeSpaceThreshold: null
      });

      const result = await VideoDeletionModule.performAutomaticCleanup();

      expect(result.totalDeleted).toBe(0);
      expect(mockLogger.info).toHaveBeenCalledWith(
        '[Auto-Removal] No thresholds configured, skipping cleanup'
      );
    });

    test('should perform age-based cleanup in dry-run mode', async () => {
      mockConfigModule.getConfig.mockReturnValue({
        autoRemovalEnabled: true,
        autoRemovalVideoAgeThreshold: '30',
        autoRemovalFreeSpaceThreshold: null
      });

      const mockOldVideos = [
        {
          id: 1,
          youtubeId: 'abc123',
          youTubeVideoName: 'Old Video',
          youTubeChannelName: 'Channel',
          fileSize: '1000000',
          timeCreated: new Date('2023-01-01')
        }
      ];

      mockVideo.findAll.mockResolvedValue(mockOldVideos);

      const result = await VideoDeletionModule.performAutomaticCleanup({ dryRun: true });

      expect(result.dryRun).toBe(true);
      expect(result.simulationTotals).toEqual({
        byAge: 1,
        byWatched: 0,
        bySpace: 0,
        byUsage: 0,
        total: 1,
        estimatedFreedBytes: 1000000
      });
      expect(result.plan.ageStrategy.enabled).toBe(true);
      expect(result.plan.ageStrategy.thresholdDays).toBe(30);
      expect(result.plan.ageStrategy.candidateCount).toBe(1);
      expect(result.plan.ageStrategy.sampleVideos).toHaveLength(1);
    });

    test('should perform actual age-based cleanup', async () => {
      mockConfigModule.getConfig.mockReturnValue({
        autoRemovalEnabled: true,
        autoRemovalVideoAgeThreshold: '30',
        autoRemovalFreeSpaceThreshold: null
      });

      const mockOldVideos = [
        {
          id: 1,
          youtubeId: 'abc123',
          youTubeVideoName: 'Old Video',
          youTubeChannelName: 'Channel',
          fileSize: '1000000',
          timeCreated: new Date('2023-01-01')
        }
      ];

      mockVideo.findAll.mockResolvedValue(mockOldVideos);

      const mockVideoRecord = {
        id: 1,
        youtubeId: 'abc123',
        filePath: '/test/Channel/Channel - Old Video - abc123/video.mp4',
        removed: false,
        update: jest.fn().mockResolvedValue()
      };

      mockVideo.findByPk.mockResolvedValue(mockVideoRecord);

      const result = await VideoDeletionModule.performAutomaticCleanup({ dryRun: false });

      expect(result.dryRun).toBe(false);
      expect(result.totalDeleted).toBe(1);
      expect(result.deletedByAge).toBe(1);
      expect(result.freedBytes).toBeGreaterThan(0);
      expect(result.plan.ageStrategy.deletedCount).toBe(1);
      expect(mockFilesystem.removeDirectoryResilient).toHaveBeenCalled();
    });

    test('should perform space-based cleanup in dry-run mode', async () => {
      mockConfigModule.getConfig.mockReturnValue({
        autoRemovalEnabled: true,
        autoRemovalVideoAgeThreshold: null,
        autoRemovalFreeSpaceThreshold: '10GB'
      });

      mockConfigModule.getStorageStatus.mockResolvedValue({
        available: 5 * 1024 ** 3, // 5GB
        availableGB: 5
      });

      mockConfigModule.isStorageBelowThreshold.mockReturnValue(true);
      mockConfigModule.convertStorageThresholdToBytes.mockReturnValue(10 * 1024 ** 3); // 10GB

      const mockOldestVideos = [
        {
          id: 1,
          youtubeId: 'abc123',
          youTubeVideoName: 'Video',
          youTubeChannelName: 'Channel',
          fileSize: '3000000000',
          timeCreated: new Date('2023-01-01')
        }
      ];

      mockVideo.findAll.mockResolvedValue(mockOldestVideos);

      const result = await VideoDeletionModule.performAutomaticCleanup({ dryRun: true });

      expect(result.plan.spaceStrategy.enabled).toBe(true);
      expect(result.plan.spaceStrategy.needsCleanup).toBe(true);
      expect(result.plan.spaceStrategy.candidateCount).toBeGreaterThan(0);
      expect(result.simulationTotals.bySpace).toBeGreaterThan(0);
    });

    test('regenerates m3u once per unique channel after space-based cleanup', async () => {
      mockConfigModule.getConfig.mockReturnValue({
        autoRemovalEnabled: true,
        autoRemovalVideoAgeThreshold: null,
        autoRemovalFreeSpaceThreshold: '10GB'
      });

      mockConfigModule.getStorageStatus.mockResolvedValue({
        available: 5 * 1024 ** 3, // 5GB
        availableGB: 5
      });

      mockConfigModule.isStorageBelowThreshold.mockReturnValue(true);
      mockConfigModule.convertStorageThresholdToBytes.mockReturnValue(10 * 1024 ** 3); // need to free 5GB

      // Three videos across two channels (UC1 duplicated) whose combined size
      // crosses the 5GB space-to-free threshold, so all three get deleted in
      // a single batch.
      const mockOldestVideos = [
        { id: 1, youtubeId: 'yt1', fileSize: String(2 * 1024 ** 3), timeCreated: new Date('2023-01-01') },
        { id: 2, youtubeId: 'yt2', fileSize: String(2 * 1024 ** 3), timeCreated: new Date('2023-01-02') },
        { id: 3, youtubeId: 'yt3', fileSize: String(2 * 1024 ** 3), timeCreated: new Date('2023-01-03') }
      ];

      mockVideo.findAll.mockResolvedValueOnce(mockOldestVideos);

      const channelByVideoId = { 1: 'UC1', 2: 'UC1', 3: 'UC2' };
      mockVideo.findByPk.mockImplementation((id) => Promise.resolve({
        id,
        youtubeId: `yt${id}`,
        channel_id: channelByVideoId[id],
        removed: false,
        filePath: null,
        update: jest.fn().mockResolvedValue(undefined)
      }));

      const result = await VideoDeletionModule.performAutomaticCleanup({ dryRun: false });

      expect(result.deletedBySpace).toBe(3);
      expect(m3uGenerator.generateChannelM3UInBackground).toHaveBeenCalledTimes(2);
      expect(m3uGenerator.generateChannelM3UInBackground).toHaveBeenCalledWith('UC1', expect.any(String));
      expect(m3uGenerator.generateChannelM3UInBackground).toHaveBeenCalledWith('UC2', expect.any(String));
    });

    test('should skip space cleanup when storage is above threshold', async () => {
      mockConfigModule.getConfig.mockReturnValue({
        autoRemovalEnabled: true,
        autoRemovalVideoAgeThreshold: null,
        autoRemovalFreeSpaceThreshold: '10GB'
      });

      mockConfigModule.getStorageStatus.mockResolvedValue({
        available: 50 * 1024 ** 3, // 50GB
        availableGB: 50
      });

      mockConfigModule.isStorageBelowThreshold.mockReturnValue(false);
      mockConfigModule.convertStorageThresholdToBytes.mockReturnValue(10 * 1024 ** 3);

      const result = await VideoDeletionModule.performAutomaticCleanup();

      expect(result.plan.spaceStrategy.enabled).toBe(true);
      expect(result.plan.spaceStrategy.needsCleanup).toBe(false);
      expect(result.deletedBySpace).toBe(0);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ availableGB: 50 }),
        '[Auto-Removal] Storage is above threshold, no space-based cleanup needed'
      );
    });

    test('should handle invalid age threshold', async () => {
      mockConfigModule.getConfig.mockReturnValue({
        autoRemovalEnabled: true,
        autoRemovalVideoAgeThreshold: 'invalid',
        autoRemovalFreeSpaceThreshold: null
      });

      const result = await VideoDeletionModule.performAutomaticCleanup();

      expect(result.totalDeleted).toBe(0);
      expect(result.plan.ageStrategy.enabled).toBe(false);
    });

    test('should handle storage status unavailable', async () => {
      mockConfigModule.getConfig.mockReturnValue({
        autoRemovalEnabled: true,
        autoRemovalVideoAgeThreshold: null,
        autoRemovalFreeSpaceThreshold: '10GB'
      });

      mockConfigModule.getStorageStatus.mockResolvedValue(null);

      const result = await VideoDeletionModule.performAutomaticCleanup();

      expect(result.errors).toContain('Storage status unavailable, skipped space-based cleanup');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[Auto-Removal] Could not retrieve storage status - skipping space-based cleanup for safety'
      );
    });

    test('should handle errors during age-based cleanup', async () => {
      mockConfigModule.getConfig.mockReturnValue({
        autoRemovalEnabled: true,
        autoRemovalVideoAgeThreshold: '30',
        autoRemovalFreeSpaceThreshold: null
      });

      mockVideo.findAll.mockRejectedValue(new Error('Database error'));

      const result = await VideoDeletionModule.performAutomaticCleanup();

      // getVideosOlderThanThreshold catches errors and returns empty array
      // so the cleanup continues successfully with 0 deletions
      expect(result.success).toBe(true);
      expect(result.totalDeleted).toBe(0);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ err: expect.any(Error) }),
        'Error getting videos older than threshold'
      );
    });

    test('should use config overrides', async () => {
      mockConfigModule.getConfig.mockReturnValue({
        autoRemovalEnabled: true,
        autoRemovalVideoAgeThreshold: '30',
        autoRemovalFreeSpaceThreshold: null
      });

      const overrides = {
        autoRemovalVideoAgeThreshold: '60'
      };

      mockSequelize.query.mockResolvedValue([]);

      const result = await VideoDeletionModule.performAutomaticCleanup({ overrides });

      expect(result.plan.ageStrategy.thresholdDays).toBe(60);
    });

    test('should not include sample videos when includeSamples is false', async () => {
      mockConfigModule.getConfig.mockReturnValue({
        autoRemovalEnabled: true,
        autoRemovalVideoAgeThreshold: '30',
        autoRemovalFreeSpaceThreshold: null
      });

      const mockOldVideos = [
        {
          id: 1,
          youtubeId: 'abc123',
          youTubeVideoName: 'Video',
          youTubeChannelName: 'Channel',
          fileSize: '1000000',
          timeCreated: new Date('2023-01-01')
        }
      ];

      mockSequelize.query.mockResolvedValue(mockOldVideos);

      const result = await VideoDeletionModule.performAutomaticCleanup({
        dryRun: true,
        includeSamples: false
      });

      expect(result.plan.ageStrategy.sampleVideos).toEqual([]);
    });

    test('should handle partial deletion failures', async () => {
      mockConfigModule.getConfig.mockReturnValue({
        autoRemovalEnabled: true,
        autoRemovalVideoAgeThreshold: '30',
        autoRemovalFreeSpaceThreshold: null
      });

      const mockOldVideos = [
        {
          id: 1,
          youtubeId: 'abc123',
          youTubeVideoName: 'Video 1',
          youTubeChannelName: 'Channel',
          fileSize: '1000000',
          timeCreated: new Date('2023-01-01')
        },
        {
          id: 2,
          youtubeId: 'def456',
          youTubeVideoName: 'Video 2',
          youTubeChannelName: 'Channel',
          fileSize: '2000000',
          timeCreated: new Date('2023-02-01')
        }
      ];

      mockVideo.findAll.mockResolvedValue(mockOldVideos);

      // First video succeeds, second fails
      const mockVideoRecord1 = {
        id: 1,
        youtubeId: 'abc123',
        filePath: '/test/Channel/Channel - Video 1 - abc123/video.mp4',
        removed: false,
        update: jest.fn().mockResolvedValue()
      };

      mockVideo.findByPk
        .mockResolvedValueOnce(mockVideoRecord1)
        .mockResolvedValueOnce(null); // Second video not found

      const result = await VideoDeletionModule.performAutomaticCleanup();

      expect(result.totalDeleted).toBe(1);
      expect(result.plan.ageStrategy.deletedCount).toBe(1);
      expect(result.plan.ageStrategy.failedCount).toBe(1);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should perform watched-based cleanup in dry-run mode', async () => {
      mockConfigModule.getConfig.mockReturnValue({
        autoRemovalEnabled: true,
        autoRemovalVideoAgeThreshold: null,
        autoRemovalFreeSpaceThreshold: null,
        autoRemovalWatchedEnabled: true
      });

      mockAutoRemovalQueries.getWatchedRemovalCandidates.mockResolvedValue([
        {
          id: 1,
          youtubeId: 'abc123',
          youTubeVideoName: 'Watched Video 1',
          youTubeChannelName: 'Channel',
          fileSize: '1000000',
          timeCreated: new Date('2026-01-01')
        },
        {
          id: 2,
          youtubeId: 'def456',
          youTubeVideoName: 'Watched Video 2',
          youTubeChannelName: 'Channel',
          fileSize: '2000000',
          timeCreated: new Date('2026-02-01')
        }
      ]);

      const result = await VideoDeletionModule.performAutomaticCleanup({ dryRun: true });

      expect(mockAutoRemovalQueries.getWatchedRemovalCandidates).toHaveBeenCalledWith({
        minDaysSinceWatched: 0,
        minVideoAgeDays: 0,
        excludeIds: []
      });
      expect(result.plan.watchedStrategy.enabled).toBe(true);
      expect(result.plan.watchedStrategy.candidateCount).toBe(2);
      expect(result.plan.watchedStrategy.estimatedFreedBytes).toBe(3000000);
      expect(result.plan.watchedStrategy.sampleVideos).toHaveLength(2);
      expect(result.simulationTotals).toEqual({
        byAge: 0,
        byWatched: 2,
        bySpace: 0,
        byUsage: 0,
        total: 2,
        estimatedFreedBytes: 3000000
      });
      expect(mockFilesystem.removeDirectoryResilient).not.toHaveBeenCalled();
    });

    test('should pass configured watched thresholds to the candidate query', async () => {
      mockConfigModule.getConfig.mockReturnValue({
        autoRemovalEnabled: true,
        autoRemovalVideoAgeThreshold: null,
        autoRemovalFreeSpaceThreshold: null,
        autoRemovalWatchedEnabled: true,
        autoRemovalWatchedMinDaysSinceWatched: '7',
        autoRemovalWatchedMinVideoAgeDays: '30'
      });

      const result = await VideoDeletionModule.performAutomaticCleanup({ dryRun: true });

      expect(mockAutoRemovalQueries.getWatchedRemovalCandidates).toHaveBeenCalledWith({
        minDaysSinceWatched: 7,
        minVideoAgeDays: 30,
        excludeIds: []
      });
      expect(result.plan.watchedStrategy.minDaysSinceWatched).toBe(7);
      expect(result.plan.watchedStrategy.minVideoAgeDays).toBe(30);
    });

    test('should perform actual watched-based cleanup', async () => {
      mockConfigModule.getConfig.mockReturnValue({
        autoRemovalEnabled: true,
        autoRemovalVideoAgeThreshold: null,
        autoRemovalFreeSpaceThreshold: null,
        autoRemovalWatchedEnabled: true
      });

      mockAutoRemovalQueries.getWatchedRemovalCandidates.mockResolvedValue([
        {
          id: 1,
          youtubeId: 'abc123',
          youTubeVideoName: 'Watched Video',
          youTubeChannelName: 'Channel',
          fileSize: '1000000',
          timeCreated: new Date('2026-01-01')
        }
      ]);

      const mockVideoRecord = {
        id: 1,
        youtubeId: 'abc123',
        filePath: '/test/Channel/Channel - Watched Video - abc123/video.mp4',
        removed: false,
        update: jest.fn().mockResolvedValue()
      };
      mockVideo.findByPk.mockResolvedValue(mockVideoRecord);

      const result = await VideoDeletionModule.performAutomaticCleanup();

      expect(result.deletedByWatched).toBe(1);
      expect(result.totalDeleted).toBe(1);
      expect(result.freedBytes).toBe(1000000);
      expect(result.plan.watchedStrategy.deletedCount).toBe(1);
      expect(mockFilesystem.removeDirectoryResilient).toHaveBeenCalled();
    });

    test('should skip watched cleanup when watch status sync is disabled', async () => {
      mockConfigModule.getConfig.mockReturnValue({
        autoRemovalEnabled: true,
        autoRemovalVideoAgeThreshold: null,
        autoRemovalFreeSpaceThreshold: null,
        autoRemovalWatchedEnabled: true,
        watchStatusSyncEnabled: false
      });

      const result = await VideoDeletionModule.performAutomaticCleanup({ dryRun: true });

      expect(mockAutoRemovalQueries.getWatchedRemovalCandidates).not.toHaveBeenCalled();
      expect(result.plan.watchedStrategy.enabled).toBe(false);
      expect(result.plan.watchedStrategy.skippedReason).toMatch(/watch status sync/i);
      expect(result.errors).toEqual([]);
      expect(result.success).toBe(true);
    });

    test('should exclude age candidates from the watched query in dry-run mode', async () => {
      mockConfigModule.getConfig.mockReturnValue({
        autoRemovalEnabled: true,
        autoRemovalVideoAgeThreshold: '30',
        autoRemovalFreeSpaceThreshold: null,
        autoRemovalWatchedEnabled: true
      });

      mockVideo.findAll.mockResolvedValue([
        {
          id: 7,
          youtubeId: 'old123',
          youTubeVideoName: 'Old And Watched',
          youTubeChannelName: 'Channel',
          fileSize: '1000000',
          timeCreated: new Date('2025-01-01')
        }
      ]);

      await VideoDeletionModule.performAutomaticCleanup({ dryRun: true });

      expect(mockAutoRemovalQueries.getWatchedRemovalCandidates).toHaveBeenCalledWith({
        minDaysSinceWatched: 0,
        minVideoAgeDays: 0,
        excludeIds: [7]
      });
    });

    test('should not add dry-run exclusions to the watched query during a real run', async () => {
      mockConfigModule.getConfig.mockReturnValue({
        autoRemovalEnabled: true,
        autoRemovalVideoAgeThreshold: null,
        autoRemovalFreeSpaceThreshold: null,
        autoRemovalWatchedEnabled: true
      });

      await VideoDeletionModule.performAutomaticCleanup();

      expect(mockAutoRemovalQueries.getWatchedRemovalCandidates).toHaveBeenCalledWith({
        minDaysSinceWatched: 0,
        minVideoAgeDays: 0,
        excludeIds: []
      });
    });

    test('should abort cleanup when the keep-recent guard query fails', async () => {
      mockConfigModule.getConfig.mockReturnValue({
        autoRemovalEnabled: true,
        autoRemovalVideoAgeThreshold: '30',
        autoRemovalFreeSpaceThreshold: null,
        autoRemovalWatchedEnabled: true,
        autoRemovalKeepRecentCount: 5
      });

      mockAutoRemovalQueries.getRecentVideoIds.mockRejectedValue(new Error('db down'));

      const result = await VideoDeletionModule.performAutomaticCleanup();

      expect(result.success).toBe(false);
      expect(result.totalDeleted).toBe(0);
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringMatching(/most recent downloads/i)])
      );
      expect(mockSequelize.query).not.toHaveBeenCalled();
      expect(mockAutoRemovalQueries.getWatchedRemovalCandidates).not.toHaveBeenCalled();
    });

    test('should exclude the most recent downloads from age and watched strategies', async () => {
      mockConfigModule.getConfig.mockReturnValue({
        autoRemovalEnabled: true,
        autoRemovalVideoAgeThreshold: '30',
        autoRemovalFreeSpaceThreshold: null,
        autoRemovalWatchedEnabled: true,
        autoRemovalKeepRecentCount: 2
      });

      mockAutoRemovalQueries.getRecentVideoIds.mockResolvedValue([101, 102]);
      mockSequelize.query.mockResolvedValue([]);

      const result = await VideoDeletionModule.performAutomaticCleanup({ dryRun: true });

      expect(mockAutoRemovalQueries.getRecentVideoIds).toHaveBeenCalledWith(2);
      expect(mockAutoRemovalQueries.getBaseRemovalQueryOptions).toHaveBeenCalledWith(expect.objectContaining({
        excludeIds: [101, 102],
      }));
      expect(mockAutoRemovalQueries.getWatchedRemovalCandidates).toHaveBeenCalledWith({
        minDaysSinceWatched: 0,
        minVideoAgeDays: 0,
        excludeIds: [101, 102]
      });
      expect(result.plan.keepRecent).toEqual({ count: 2, protectedCount: 2 });
    });

    test('should exclude keep-recent ids and watched candidates from dry-run space cleanup', async () => {
      mockConfigModule.getConfig.mockReturnValue({
        autoRemovalEnabled: true,
        autoRemovalVideoAgeThreshold: null,
        autoRemovalFreeSpaceThreshold: '10GB',
        autoRemovalWatchedEnabled: true,
        autoRemovalKeepRecentCount: 1
      });

      mockAutoRemovalQueries.getRecentVideoIds.mockResolvedValue([50]);
      mockAutoRemovalQueries.getWatchedRemovalCandidates.mockResolvedValue([
        {
          id: 1,
          youtubeId: 'abc123',
          youTubeVideoName: 'Watched Video',
          youTubeChannelName: 'Channel',
          fileSize: '1000000',
          timeCreated: new Date('2026-01-01')
        }
      ]);
      mockConfigModule.getStorageStatus.mockResolvedValue({
        available: 5 * 1024 ** 3,
        availableGB: 5
      });
      mockConfigModule.isStorageBelowThreshold.mockReturnValue(true);
      mockConfigModule.convertStorageThresholdToBytes.mockReturnValue(10 * 1024 ** 3);

      await VideoDeletionModule.performAutomaticCleanup({ dryRun: true });

      expect(mockAutoRemovalQueries.getBaseRemovalQueryOptions).toHaveBeenCalledWith(expect.objectContaining({
        excludeIds: [50, 1],
      }));
    });

    test('should exclude keep-recent ids from real space cleanup', async () => {
      mockConfigModule.getConfig.mockReturnValue({
        autoRemovalEnabled: true,
        autoRemovalVideoAgeThreshold: null,
        autoRemovalFreeSpaceThreshold: '10GB',
        autoRemovalKeepRecentCount: 1
      });

      mockAutoRemovalQueries.getRecentVideoIds.mockResolvedValue([50]);
      mockConfigModule.getStorageStatus.mockResolvedValue({
        available: 5 * 1024 ** 3,
        availableGB: 5
      });
      mockConfigModule.isStorageBelowThreshold.mockReturnValue(true);
      mockConfigModule.convertStorageThresholdToBytes.mockReturnValue(10 * 1024 ** 3);

      await VideoDeletionModule.performAutomaticCleanup({ dryRun: false });

      expect(mockAutoRemovalQueries.getBaseRemovalQueryOptions).toHaveBeenCalledWith(expect.objectContaining({
        excludeIds: [50],
      }));
    });

    test('merges per-channel keep-recent ids into the exclusion set', async () => {
      mockConfigModule.getConfig.mockReturnValue({
        autoRemovalEnabled: true,
        autoRemovalVideoAgeThreshold: '30',
        autoRemovalFreeSpaceThreshold: null
      });
      mockAutoRemovalQueries.getChannelKeepRecentIds.mockResolvedValue({ channelCount: 2, ids: [7, 8] });
      mockSequelize.query.mockResolvedValue([]);

      const result = await VideoDeletionModule.performAutomaticCleanup();

      expect(result.plan.channelKeepRecent).toEqual({ channelCount: 2, protectedCount: 2 });
      expect(mockAutoRemovalQueries.getBaseRemovalQueryOptions).toHaveBeenCalledWith(expect.objectContaining({
        excludeIds: [7, 8],
      }));
    });

    test('dedupes overlapping global and per-channel keep-recent ids', async () => {
      mockConfigModule.getConfig.mockReturnValue({
        autoRemovalEnabled: true,
        autoRemovalVideoAgeThreshold: '30',
        autoRemovalFreeSpaceThreshold: null,
        autoRemovalKeepRecentCount: 2
      });
      mockAutoRemovalQueries.getRecentVideoIds.mockResolvedValue([7, 9]);
      mockAutoRemovalQueries.getChannelKeepRecentIds.mockResolvedValue({ channelCount: 1, ids: [7, 8] });

      await VideoDeletionModule.performAutomaticCleanup();

      expect(mockAutoRemovalQueries.getBaseRemovalQueryOptions).toHaveBeenCalledWith(expect.objectContaining({
        excludeIds: [7, 9, 8],
      }));
    });

    test('aborts cleanup when the per-channel keep-recent guard query fails', async () => {
      mockConfigModule.getConfig.mockReturnValue({
        autoRemovalEnabled: true,
        autoRemovalVideoAgeThreshold: '30',
        autoRemovalFreeSpaceThreshold: null
      });
      mockAutoRemovalQueries.getChannelKeepRecentIds.mockRejectedValue(new Error('db down'));

      const result = await VideoDeletionModule.performAutomaticCleanup();

      expect(result.success).toBe(false);
      expect(result.totalDeleted).toBe(0);
      expect(result.errors).toContain('Could not determine per-channel protected downloads; cleanup aborted for safety');
      expect(mockSequelize.query).not.toHaveBeenCalled();
    });

    describe('usage-based cleanup', () => {
      const GB = 1024 ** 3;
      const deletableRecord = (id) => ({
        id,
        youtubeId: `yt${id}`,
        channel_id: 'UC1',
        removed: false,
        filePath: null,
        update: jest.fn().mockResolvedValue(undefined)
      });

      beforeEach(() => {
        mockConfigModule.convertStorageThresholdToBytes.mockImplementation((value) => (
          value === '10GB' ? 10 * GB : null
        ));
        mockVideo.findByPk.mockImplementation((id) => Promise.resolve(deletableRecord(id)));
      });

      test('runs when the usage limit is the only rule configured', async () => {
        mockConfigModule.getConfig.mockReturnValue({ autoRemovalEnabled: true, autoRemovalUsageLimit: '10GB' });
        mockStorageUsage.getDownloadedBytes.mockResolvedValue(8 * GB);

        const result = await VideoDeletionModule.performAutomaticCleanup();

        expect(result.plan.usageStrategy.enabled).toBe(true);
      });

      test('deletes oldest videos until usage is back under the limit', async () => {
        mockConfigModule.getConfig.mockReturnValue({ autoRemovalEnabled: true, autoRemovalUsageLimit: '10GB' });
        mockStorageUsage.getDownloadedBytes.mockResolvedValue(13 * GB);
        mockVideo.findAll.mockResolvedValueOnce([
          { id: 1, youtubeId: 'yt1', fileSize: String(2 * GB) },
          { id: 2, youtubeId: 'yt2', fileSize: String(2 * GB) },
          { id: 3, youtubeId: 'yt3', fileSize: String(2 * GB) }
        ]);

        const result = await VideoDeletionModule.performAutomaticCleanup();

        expect(result.deletedByUsage).toBe(2);
      });

      test('does nothing while usage is within the limit', async () => {
        mockConfigModule.getConfig.mockReturnValue({ autoRemovalEnabled: true, autoRemovalUsageLimit: '10GB' });
        mockStorageUsage.getDownloadedBytes.mockResolvedValue(10 * GB);

        const result = await VideoDeletionModule.performAutomaticCleanup();

        expect(mockSequelize.query).not.toHaveBeenCalled();
        expect(result.plan.usageStrategy.needsCleanup).toBe(false);
      });

      test('dry run subtracts what earlier strategies would free', async () => {
        mockConfigModule.getConfig.mockReturnValue({
          autoRemovalEnabled: true,
          autoRemovalVideoAgeThreshold: '30',
          autoRemovalUsageLimit: '10GB'
        });
        mockStorageUsage.getDownloadedBytes.mockResolvedValue(12 * GB);
        mockVideo.findAll.mockResolvedValueOnce([
          { id: 1, youtubeId: 'yt1', fileSize: String(3 * GB), timeCreated: new Date('2023-01-01') }
        ]);

        const result = await VideoDeletionModule.performAutomaticCleanup({ dryRun: true });

        expect(result.plan.usageStrategy.usedBytes).toBe(9 * GB);
      });

      test('dry run previews only the videos a real run would delete', async () => {
        mockConfigModule.getConfig.mockReturnValue({ autoRemovalEnabled: true, autoRemovalUsageLimit: '10GB' });
        mockStorageUsage.getDownloadedBytes.mockResolvedValue(11 * GB);
        mockVideo.findAll.mockResolvedValueOnce(
          Array.from({ length: 50 }, (_, i) => ({ id: i + 1, youtubeId: `yt${i + 1}`, fileSize: String(GB) }))
        );

        const result = await VideoDeletionModule.performAutomaticCleanup({ dryRun: true });

        expect(result.plan.usageStrategy.candidateCount).toBe(1);
      });

      test('dry run excludes videos already claimed by earlier strategies', async () => {
        mockConfigModule.getConfig.mockReturnValue({
          autoRemovalEnabled: true,
          autoRemovalVideoAgeThreshold: '30',
          autoRemovalUsageLimit: '10GB'
        });
        mockStorageUsage.getDownloadedBytes.mockResolvedValue(20 * GB);
        mockVideo.findAll
          .mockResolvedValueOnce([{ id: 7, youtubeId: 'yt7', fileSize: String(GB), timeCreated: new Date('2023-01-01') }])
          .mockResolvedValue([]);

        await VideoDeletionModule.performAutomaticCleanup({ dryRun: true });

        expect(mockAutoRemovalQueries.getBaseRemovalQueryOptions).toHaveBeenCalledWith(expect.objectContaining({
          excludeIds: expect.arrayContaining([7]),
        }));
      });

      test('records an error when the limit format is invalid', async () => {
        mockConfigModule.getConfig.mockReturnValue({ autoRemovalEnabled: true, autoRemovalUsageLimit: 'lots' });

        const result = await VideoDeletionModule.performAutomaticCleanup();

        expect(result.errors).toContain('Invalid total usage limit format, skipped usage-based cleanup');
      });

      test('skips deletion and fails the run when usage cannot be measured', async () => {
        mockConfigModule.getConfig.mockReturnValue({ autoRemovalEnabled: true, autoRemovalUsageLimit: '10GB' });
        mockStorageUsage.getDownloadedBytes.mockRejectedValue(new Error('db down'));

        const result = await VideoDeletionModule.performAutomaticCleanup();

        expect(mockVideo.findByPk).not.toHaveBeenCalled();
        expect(result.success).toBe(false);
      });

      test('does not retry a video that failed to delete within the same run', async () => {
        mockConfigModule.getConfig.mockReturnValue({ autoRemovalEnabled: true, autoRemovalUsageLimit: '10GB' });
        mockStorageUsage.getDownloadedBytes.mockResolvedValue(11 * GB);
        mockVideo.findByPk.mockResolvedValue(null);
        mockVideo.findAll
          .mockResolvedValueOnce([{ id: 1, youtubeId: 'yt1', fileSize: String(2 * GB) }])
          .mockResolvedValue([]);

        await VideoDeletionModule.performAutomaticCleanup();

        expect(mockAutoRemovalQueries.getBaseRemovalQueryOptions).toHaveBeenCalledWith(expect.objectContaining({
          excludeIds: [1],
        }));
      });
    });
  });

  describe('cleanupOrphanDirectories', () => {
    test('should skip when no output directory is configured', async () => {
      jest.resetModules();
      jest.clearAllMocks();

      jest.doMock('../../logger');
      jest.doMock('../../models', () => ({ Video: mockVideo }));
      jest.doMock('fs', () => ({ promises: mockFs }));
      jest.doMock('../filesystem', () => ({
        isVideoDirectory: jest.fn(() => true),
        cleanupEmptyChannelDirectory: jest.fn().mockResolvedValue(false),
        cleanupEmptyParents: jest.fn().mockResolvedValue(),
        isSubfolderDir: jest.fn((name) => name.startsWith('__')),
        listSubdirectories: jest.fn().mockResolvedValue([]),
        removeDirectoryResilient: jest.fn().mockResolvedValue()
      }));
      jest.doMock('../configModule', () => ({
        directoryPath: null
      }));

      const module = require('../videoDeletionModule');
      const result = await module.cleanupOrphanDirectories();

      expect(result).toEqual({ removed: [], errors: [] });
    });

    test('should clean up root-level empty channel directories', async () => {
      mockFilesystem.listSubdirectories.mockResolvedValue([
        '/test/output/Empty Channel',
        '/test/output/Active Channel'
      ]);
      mockFilesystem.cleanupEmptyChannelDirectory
        .mockResolvedValueOnce(true)   // Empty Channel removed
        .mockResolvedValueOnce(false); // Active Channel kept

      const result = await VideoDeletionModule.cleanupOrphanDirectories();

      expect(result.removed).toEqual(['/test/output/Empty Channel']);
      expect(mockFilesystem.cleanupEmptyChannelDirectory).toHaveBeenCalledTimes(2);
      expect(mockFilesystem.cleanupEmptyChannelDirectory).toHaveBeenCalledWith(
        '/test/output/Empty Channel',
        '/test/output',
        { includeIgnorableFiles: true }
      );
    });

    test('should scan subfolder children as channel directories', async () => {
      mockFilesystem.listSubdirectories
        .mockResolvedValueOnce(['/test/output/__Music'])       // top-level
        .mockResolvedValueOnce(['/test/output/__Music/Empty']); // inside __Music

      mockFilesystem.cleanupEmptyChannelDirectory.mockResolvedValueOnce(true);

      const result = await VideoDeletionModule.cleanupOrphanDirectories();

      expect(result.removed).toEqual(['/test/output/__Music/Empty']);
      expect(mockFilesystem.cleanupEmptyChannelDirectory).toHaveBeenCalledWith(
        '/test/output/__Music/Empty',
        '/test/output',
        { includeIgnorableFiles: true }
      );
    });

    test('should clean up empty subfolder parents after removing channel dirs', async () => {
      mockFilesystem.listSubdirectories
        .mockResolvedValueOnce(['/test/output/__Music'])
        .mockResolvedValueOnce(['/test/output/__Music/Empty']);

      mockFilesystem.cleanupEmptyChannelDirectory.mockResolvedValueOnce(true);

      await VideoDeletionModule.cleanupOrphanDirectories();

      expect(mockFilesystem.cleanupEmptyParents).toHaveBeenCalledWith(
        '/test/output/__Music',
        '/test/output'
      );
    });

    test('should not call cleanupEmptyParents for root-level directories', async () => {
      mockFilesystem.listSubdirectories.mockResolvedValue([
        '/test/output/Channel'
      ]);
      mockFilesystem.cleanupEmptyChannelDirectory.mockResolvedValueOnce(true);

      await VideoDeletionModule.cleanupOrphanDirectories();

      expect(mockFilesystem.cleanupEmptyParents).not.toHaveBeenCalled();
    });

    test('should handle errors gracefully and return them', async () => {
      mockFilesystem.listSubdirectories.mockRejectedValue(new Error('disk error'));

      const result = await VideoDeletionModule.cleanupOrphanDirectories();

      expect(result.errors).toEqual(['disk error']);
      expect(result.removed).toEqual([]);
    });

    test('should continue processing after a subfolder error', async () => {
      mockFilesystem.listSubdirectories
        .mockResolvedValueOnce([
          '/test/output/__Broken',
          '/test/output/GoodChannel',
        ])
        .mockRejectedValueOnce(new Error('EACCES: permission denied')); // __Broken fails

      mockFilesystem.cleanupEmptyChannelDirectory.mockResolvedValueOnce(true); // GoodChannel removed

      const result = await VideoDeletionModule.cleanupOrphanDirectories();

      expect(result.removed).toEqual(['/test/output/GoodChannel']);
      expect(result.errors).toEqual(['EACCES: permission denied']);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ err: expect.any(Error), dir: '/test/output/__Broken' }),
        expect.stringContaining('Error processing subfolder directory')
      );
    });

    test('should handle mixed root and subfolder directories', async () => {
      mockFilesystem.listSubdirectories
        .mockResolvedValueOnce([
          '/test/output/RootChannel',
          '/test/output/__Videos',
        ])
        .mockResolvedValueOnce([
          '/test/output/__Videos/SubChannel',
        ]);

      mockFilesystem.cleanupEmptyChannelDirectory
        .mockResolvedValueOnce(true)   // RootChannel removed
        .mockResolvedValueOnce(false); // SubChannel kept

      const result = await VideoDeletionModule.cleanupOrphanDirectories();

      expect(result.removed).toEqual(['/test/output/RootChannel']);
      expect(mockFilesystem.cleanupEmptyChannelDirectory).toHaveBeenCalledTimes(2);
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
