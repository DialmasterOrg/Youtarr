/* eslint-env jest */

// Mock logger before any imports
jest.mock('../../logger');

describe('VideoDeletionModule', () => {
  let VideoDeletionModule;
  let mockVideo;
  let mockFs;
  let mockLogger;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    // Get the mocked logger
    mockLogger = require('../../logger');

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

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ videoId: 1 }),
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

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ videoId: 1 }),
        'Directory already removed'
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

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ videoId: 1, err: permissionError }),
        'Failed to delete directory'
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
    let mockSequelize;

    beforeEach(() => {
      mockSequelize = {
        query: jest.fn()
      };

      jest.doMock('../../db.js', () => ({
        Sequelize: {
          QueryTypes: { SELECT: 'SELECT' }
        },
        sequelize: mockSequelize
      }));

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

      mockSequelize.query.mockResolvedValue(mockVideos);

      const result = await VideoDeletionModule.getVideosOlderThanThreshold(30);

      expect(mockSequelize.query).toHaveBeenCalledWith(
        expect.stringContaining('DATE_SUB(NOW(), INTERVAL :ageInDays DAY)'),
        expect.objectContaining({
          replacements: { ageInDays: 30 },
          type: 'SELECT'
        })
      );
      expect(result).toEqual(mockVideos);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ count: 2, ageInDays: 30 }),
        '[Auto-Removal] Found videos older than threshold'
      );
    });

    test('should return empty array when no old videos found', async () => {
      mockSequelize.query.mockResolvedValue([]);

      const result = await VideoDeletionModule.getVideosOlderThanThreshold(60);

      expect(result).toEqual([]);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ count: 0, ageInDays: 60 }),
        '[Auto-Removal] Found videos older than threshold'
      );
    });

    test('should handle database errors gracefully', async () => {
      mockSequelize.query.mockRejectedValue(new Error('Database error'));

      const result = await VideoDeletionModule.getVideosOlderThanThreshold(30);

      expect(result).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ err: expect.any(Error) }),
        'Error getting videos older than threshold'
      );
    });
  });

  describe('getOldestVideos', () => {
    let mockSequelize;

    beforeEach(() => {
      mockSequelize = {
        query: jest.fn()
      };

      jest.doMock('../../db.js', () => ({
        Sequelize: {
          QueryTypes: { SELECT: 'SELECT' }
        },
        sequelize: mockSequelize
      }));

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

      mockSequelize.query.mockResolvedValue(mockVideos);

      const result = await VideoDeletionModule.getOldestVideos(10);

      expect(mockSequelize.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT :limit'),
        expect.objectContaining({
          replacements: { limit: 10 },
          type: 'SELECT'
        })
      );
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

      mockSequelize.query.mockResolvedValue(mockVideos);

      const result = await VideoDeletionModule.getOldestVideos(10, [1, 2, 3]);

      expect(mockSequelize.query).toHaveBeenCalledWith(
        expect.stringContaining('NOT IN (:excludeIds)'),
        expect.objectContaining({
          replacements: { limit: 10, excludeIds: [1, 2, 3] },
          type: 'SELECT'
        })
      );
      expect(result).toEqual(mockVideos);
    });

    test('should handle empty exclude list', async () => {
      mockSequelize.query.mockResolvedValue([]);

      const result = await VideoDeletionModule.getOldestVideos(5, []);

      expect(mockSequelize.query).toHaveBeenCalledWith(
        expect.not.stringContaining('NOT IN'),
        expect.objectContaining({
          replacements: { limit: 5 },
          type: 'SELECT'
        })
      );
      expect(result).toEqual([]);
    });

    test('should return empty array when no videos found', async () => {
      mockSequelize.query.mockResolvedValue([]);

      const result = await VideoDeletionModule.getOldestVideos(50);

      expect(result).toEqual([]);
    });

    test('should handle database errors gracefully', async () => {
      mockSequelize.query.mockRejectedValue(new Error('Query failed'));

      const result = await VideoDeletionModule.getOldestVideos(10);

      expect(result).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ err: expect.any(Error) }),
        'Error getting oldest videos'
      );
    });
  });

  describe('performAutomaticCleanup', () => {
    let mockConfigModule;
    let mockSequelize;

    beforeEach(() => {
      mockConfigModule = {
        getConfig: jest.fn(),
        getStorageStatus: jest.fn(),
        isStorageBelowThreshold: jest.fn(),
        convertStorageThresholdToBytes: jest.fn()
      };

      mockSequelize = {
        query: jest.fn()
      };

      jest.doMock('../configModule', () => mockConfigModule);
      jest.doMock('../../db.js', () => ({
        Sequelize: {
          QueryTypes: { SELECT: 'SELECT' }
        },
        sequelize: mockSequelize
      }));

      jest.resetModules();
      mockLogger = require('../../logger');
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

      mockSequelize.query.mockResolvedValue(mockOldVideos);

      const result = await VideoDeletionModule.performAutomaticCleanup({ dryRun: true });

      expect(result.dryRun).toBe(true);
      expect(result.simulationTotals).toEqual({
        byAge: 1,
        bySpace: 0,
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

      mockSequelize.query.mockResolvedValue(mockOldVideos);

      const mockVideoRecord = {
        id: 1,
        youtubeId: 'abc123',
        filePath: '/test/Channel/Channel - Old Video - abc123/video.mp4',
        removed: false,
        update: jest.fn().mockResolvedValue()
      };

      mockVideo.findByPk.mockResolvedValue(mockVideoRecord);
      mockFs.rm.mockResolvedValue();

      const result = await VideoDeletionModule.performAutomaticCleanup({ dryRun: false });

      expect(result.dryRun).toBe(false);
      expect(result.totalDeleted).toBe(1);
      expect(result.deletedByAge).toBe(1);
      expect(result.freedBytes).toBeGreaterThan(0);
      expect(result.plan.ageStrategy.deletedCount).toBe(1);
      expect(mockFs.rm).toHaveBeenCalled();
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

      mockSequelize.query.mockResolvedValue(mockOldestVideos);

      const result = await VideoDeletionModule.performAutomaticCleanup({ dryRun: true });

      expect(result.plan.spaceStrategy.enabled).toBe(true);
      expect(result.plan.spaceStrategy.needsCleanup).toBe(true);
      expect(result.plan.spaceStrategy.candidateCount).toBeGreaterThan(0);
      expect(result.simulationTotals.bySpace).toBeGreaterThan(0);
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

      mockSequelize.query.mockRejectedValue(new Error('Database error'));

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

      mockSequelize.query.mockResolvedValue(mockOldVideos);

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

      mockFs.rm.mockResolvedValue();

      const result = await VideoDeletionModule.performAutomaticCleanup();

      expect(result.totalDeleted).toBe(1);
      expect(result.plan.ageStrategy.deletedCount).toBe(1);
      expect(result.plan.ageStrategy.failedCount).toBe(1);
      expect(result.errors.length).toBeGreaterThan(0);
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
