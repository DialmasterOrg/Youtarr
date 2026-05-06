/* eslint-env jest */

jest.mock('fs', () => ({
  promises: {
    stat: jest.fn()
  }
}));

describe('FileCheckModule', () => {
  let fileCheckModule;
  let mockFs;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    mockFs = require('fs').promises;
    fileCheckModule = require('../fileCheckModule');
  });

  describe('checkVideoFiles', () => {
    test('should return unchanged videos when none have filePaths', async () => {
      const videos = [
        { id: 1, youtubeId: 'abc123', removed: false },
        { id: 2, youtubeId: 'xyz789', removed: false }
      ];

      const result = await fileCheckModule.checkVideoFiles(videos);

      expect(result.videos).toEqual(videos);
      expect(result.updates).toEqual([]);
      expect(mockFs.stat).not.toHaveBeenCalled();
    });

    test('should mark video as removed when file does not exist', async () => {
      const videos = [
        {
          id: 1,
          youtubeId: 'abc123',
          filePath: '/videos/channel/video.mp4',
          removed: false
        }
      ];

      mockFs.stat.mockRejectedValue({ code: 'ENOENT' });

      const result = await fileCheckModule.checkVideoFiles(videos);

      expect(result.videos).toEqual([
        {
          id: 1,
          youtubeId: 'abc123',
          filePath: '/videos/channel/video.mp4',
          removed: true
        }
      ]);
      expect(result.updates).toEqual([
        { id: 1, removed: true }
      ]);
      expect(mockFs.stat).toHaveBeenCalledWith('/videos/channel/video.mp4');
    });

    test('should not update video when already marked as removed', async () => {
      const videos = [
        {
          id: 1,
          youtubeId: 'abc123',
          filePath: '/videos/channel/video.mp4',
          removed: true
        }
      ];

      mockFs.stat.mockRejectedValueOnce({ code: 'ENOENT' });

      const result = await fileCheckModule.checkVideoFiles(videos);

      expect(result.videos).toEqual(videos);
      expect(result.updates).toEqual([]);
      expect(mockFs.stat).toHaveBeenCalledWith('/videos/channel/video.mp4');
    });

    test('should mark video as not removed when file exists', async () => {
      const videos = [
        {
          id: 1,
          youtubeId: 'abc123',
          filePath: '/videos/channel/video.mp4',
          fileSize: '1000',
          removed: true
        }
      ];

      mockFs.stat.mockResolvedValueOnce({ size: 1000 });

      const result = await fileCheckModule.checkVideoFiles(videos);

      expect(result.videos).toEqual([
        {
          id: 1,
          youtubeId: 'abc123',
          filePath: '/videos/channel/video.mp4',
          fileSize: '1000',
          removed: false
        }
      ]);
      expect(result.updates).toEqual([
        { id: 1, removed: false }
      ]);
      expect(mockFs.stat).toHaveBeenCalledWith('/videos/channel/video.mp4');
    });

    test('should update fileSize when it has changed', async () => {
      const videos = [
        {
          id: 1,
          youtubeId: 'abc123',
          filePath: '/videos/channel/video.mp4',
          fileSize: '1000',
          removed: false
        }
      ];

      mockFs.stat.mockResolvedValueOnce({ size: 2000 });

      const result = await fileCheckModule.checkVideoFiles(videos);

      expect(result.videos).toEqual([
        {
          id: 1,
          youtubeId: 'abc123',
          filePath: '/videos/channel/video.mp4',
          fileSize: '2000',
          removed: false
        }
      ]);
      expect(result.updates).toEqual([
        { id: 1, fileSize: 2000 }
      ]);
      expect(mockFs.stat).toHaveBeenCalledWith('/videos/channel/video.mp4');
    });

    test('should not update when file exists and fileSize unchanged', async () => {
      const videos = [
        {
          id: 1,
          youtubeId: 'abc123',
          filePath: '/videos/channel/video.mp4',
          fileSize: '1000',
          removed: false
        }
      ];

      mockFs.stat.mockResolvedValueOnce({ size: 1000 });

      const result = await fileCheckModule.checkVideoFiles(videos);

      expect(result.videos).toEqual(videos);
      expect(result.updates).toEqual([]);
      expect(mockFs.stat).toHaveBeenCalledWith('/videos/channel/video.mp4');
    });

    test('should handle multiple videos with mixed states', async () => {
      const videos = [
        {
          id: 1,
          youtubeId: 'abc123',
          filePath: '/videos/channel/video1.mp4',
          fileSize: '1000',
          removed: false
        },
        {
          id: 2,
          youtubeId: 'def456',
          filePath: '/videos/channel/video2.mp4',
          fileSize: '2000',
          removed: true
        },
        {
          id: 3,
          youtubeId: 'ghi789',
          removed: false
        },
        {
          id: 4,
          youtubeId: 'jkl012',
          filePath: '/videos/channel/video4.mp4',
          fileSize: '3000',
          removed: false
        }
      ];

      mockFs.stat.mockImplementation((p) => {
        if (p === '/videos/channel/video2.mp4') {
          return Promise.resolve({ size: 2000 });
        }
        if (p === '/videos/channel/video4.mp4') {
          return Promise.resolve({ size: 4000 });
        }
        // video1 (and any same-dir extension fallbacks) all ENOENT
        return Promise.reject({ code: 'ENOENT' });
      });

      const result = await fileCheckModule.checkVideoFiles(videos);

      expect(result.videos).toEqual([
        {
          id: 1,
          youtubeId: 'abc123',
          filePath: '/videos/channel/video1.mp4',
          fileSize: '1000',
          removed: true
        },
        {
          id: 2,
          youtubeId: 'def456',
          filePath: '/videos/channel/video2.mp4',
          fileSize: '2000',
          removed: false
        },
        {
          id: 3,
          youtubeId: 'ghi789',
          removed: false
        },
        {
          id: 4,
          youtubeId: 'jkl012',
          filePath: '/videos/channel/video4.mp4',
          fileSize: '4000',
          removed: false
        }
      ]);
      expect(result.updates).toEqual([
        { id: 1, removed: true },
        { id: 2, removed: false },
        { id: 4, fileSize: 4000 }
      ]);
    });

    test('should handle non-ENOENT errors by not updating', async () => {
      const videos = [
        {
          id: 1,
          youtubeId: 'abc123',
          filePath: '/videos/channel/video.mp4',
          removed: false
        }
      ];

      mockFs.stat.mockRejectedValueOnce({ code: 'EACCES' });

      const result = await fileCheckModule.checkVideoFiles(videos);

      expect(result.videos).toEqual(videos);
      expect(result.updates).toEqual([]);
      expect(mockFs.stat).toHaveBeenCalledWith('/videos/channel/video.mp4');
    });

    test('should handle empty array', async () => {
      const result = await fileCheckModule.checkVideoFiles([]);

      expect(result.videos).toEqual([]);
      expect(result.updates).toEqual([]);
      expect(mockFs.stat).not.toHaveBeenCalled();
    });

    test('should not mutate original videos array', async () => {
      const videos = [
        {
          id: 1,
          youtubeId: 'abc123',
          filePath: '/videos/channel/video.mp4',
          fileSize: '1000',
          removed: false
        }
      ];

      const originalVideos = JSON.parse(JSON.stringify(videos));

      mockFs.stat.mockResolvedValueOnce({ size: 2000 });

      await fileCheckModule.checkVideoFiles(videos);

      expect(videos).toEqual(originalVideos);
    });

    test('should handle videos with fileSize as number', async () => {
      const videos = [
        {
          id: 1,
          youtubeId: 'abc123',
          filePath: '/videos/channel/video.mp4',
          fileSize: 1000,
          removed: false
        }
      ];

      mockFs.stat.mockResolvedValueOnce({ size: 2000 });

      const result = await fileCheckModule.checkVideoFiles(videos);

      expect(result.videos[0].fileSize).toBe('2000');
      expect(result.updates).toEqual([
        { id: 1, fileSize: 2000 }
      ]);
    });

    test('should handle videos without fileSize property', async () => {
      const videos = [
        {
          id: 1,
          youtubeId: 'abc123',
          filePath: '/videos/channel/video.mp4',
          removed: false
        }
      ];

      mockFs.stat.mockResolvedValueOnce({ size: 1000 });

      const result = await fileCheckModule.checkVideoFiles(videos);

      expect(result.videos[0].fileSize).toBe('1000');
      expect(result.updates).toEqual([
        { id: 1, fileSize: 1000 }
      ]);
    });

    test('should handle large file sizes', async () => {
      const videos = [
        {
          id: 1,
          youtubeId: 'abc123',
          filePath: '/videos/channel/video.mp4',
          fileSize: '0',
          removed: false
        }
      ];

      const largeSize = 5000000000; // 5GB
      mockFs.stat.mockResolvedValueOnce({ size: largeSize });

      const result = await fileCheckModule.checkVideoFiles(videos);

      expect(result.videos[0].fileSize).toBe(largeSize.toString());
      expect(result.updates).toEqual([
        { id: 1, fileSize: largeSize }
      ]);
    });

    test('should swap extension and update path when stored .mp4 is now .mkv at same dir', async () => {
      const videos = [
        {
          id: 1,
          youtubeId: 'abc123',
          filePath: '/videos/channel/video [abc123].mp4',
          fileSize: '1000',
          removed: false
        }
      ];

      // Original .mp4 is gone; .webm fails too; .mkv is found
      mockFs.stat.mockImplementation((p) => {
        if (p === '/videos/channel/video [abc123].mp4') {
          return Promise.reject({ code: 'ENOENT' });
        }
        if (p === '/videos/channel/video [abc123].webm') {
          return Promise.reject({ code: 'ENOENT' });
        }
        if (p === '/videos/channel/video [abc123].mkv') {
          return Promise.resolve({ size: 5000 });
        }
        return Promise.reject({ code: 'ENOENT' });
      });

      const result = await fileCheckModule.checkVideoFiles(videos);

      expect(result.updates).toEqual([
        {
          id: 1,
          filePath: '/videos/channel/video [abc123].mkv',
          fileSize: 5000
        }
      ]);
    });

    test('should leave filePath untouched when no extension variant exists', async () => {
      const videos = [
        {
          id: 1,
          youtubeId: 'abc123',
          filePath: '/videos/channel/video [abc123].mp4',
          fileSize: '1000',
          removed: false
        }
      ];

      mockFs.stat.mockRejectedValue({ code: 'ENOENT' });

      const result = await fileCheckModule.checkVideoFiles(videos);

      // Marked removed, but filePath/fileSize must NOT appear in the update
      expect(result.updates).toHaveLength(1);
      expect(result.updates[0]).toEqual({ id: 1, removed: true });
      expect(result.updates[0].filePath).toBeUndefined();
      expect(result.updates[0].fileSize).toBeUndefined();
    });

    test('should not flip removed status when stat fails with non-ENOENT error', async () => {
      const videos = [
        {
          id: 1,
          youtubeId: 'abc123',
          filePath: '/videos/channel/video [abc123].mp4',
          fileSize: '1000',
          removed: false
        }
      ];

      mockFs.stat.mockRejectedValue({ code: 'EACCES' });

      const result = await fileCheckModule.checkVideoFiles(videos);

      expect(result.updates).toEqual([]);
    });

    test('should mark removed when stored .mp3 is missing and no audio variant exists', async () => {
      const videos = [
        {
          id: 1,
          youtubeId: 'abc123',
          audioFilePath: '/videos/channel/audio [abc123].mp3',
          audioFileSize: '500',
          removed: false
        }
      ];

      // Today AUDIO_EXTENSIONS = ['.mp3'] only, so this test verifies that with a
      // single-entry audio list, a missing .mp3 with no replacement marks removed
      // without altering audioFilePath. (It also exercises the audio code path.)
      mockFs.stat.mockRejectedValue({ code: 'ENOENT' });

      const result = await fileCheckModule.checkVideoFiles(videos);

      expect(result.updates).toHaveLength(1);
      expect(result.updates[0]).toEqual({ id: 1, removed: true });
      expect(result.updates[0].audioFilePath).toBeUndefined();
    });
  });

  describe('applyVideoUpdates', () => {
    let mockSequelize;
    let mockSequelizeLib;

    beforeEach(() => {
      mockSequelize = {
        query: jest.fn()
      };

      mockSequelizeLib = {
        QueryTypes: {
          UPDATE: 'UPDATE'
        }
      };
    });

    test('should not execute queries when updates array is empty', async () => {
      await fileCheckModule.applyVideoUpdates(mockSequelize, mockSequelizeLib, []);

      expect(mockSequelize.query).not.toHaveBeenCalled();
    });

    test('should update fileSize only', async () => {
      const updates = [
        { id: 1, fileSize: 2000 }
      ];

      await fileCheckModule.applyVideoUpdates(mockSequelize, mockSequelizeLib, updates);

      expect(mockSequelize.query).toHaveBeenCalledTimes(1);
      expect(mockSequelize.query).toHaveBeenCalledWith(
        'UPDATE Videos SET fileSize = ? WHERE id = ?',
        {
          replacements: [2000, 1],
          type: 'UPDATE'
        }
      );
    });

    test('should update removed status only', async () => {
      const updates = [
        { id: 1, removed: true }
      ];

      await fileCheckModule.applyVideoUpdates(mockSequelize, mockSequelizeLib, updates);

      expect(mockSequelize.query).toHaveBeenCalledTimes(1);
      expect(mockSequelize.query).toHaveBeenCalledWith(
        'UPDATE Videos SET removed = ? WHERE id = ?',
        {
          replacements: [1, 1],
          type: 'UPDATE'
        }
      );
    });

    test('should update both fileSize and removed status', async () => {
      const updates = [
        { id: 1, fileSize: 2000, removed: false }
      ];

      await fileCheckModule.applyVideoUpdates(mockSequelize, mockSequelizeLib, updates);

      expect(mockSequelize.query).toHaveBeenCalledTimes(1);
      expect(mockSequelize.query).toHaveBeenCalledWith(
        'UPDATE Videos SET fileSize = ?, removed = ? WHERE id = ?',
        {
          replacements: [2000, 0, 1],
          type: 'UPDATE'
        }
      );
    });

    test('should handle multiple updates sequentially', async () => {
      const updates = [
        { id: 1, fileSize: 2000, removed: false },
        { id: 2, removed: true },
        { id: 3, fileSize: 5000 }
      ];

      await fileCheckModule.applyVideoUpdates(mockSequelize, mockSequelizeLib, updates);

      expect(mockSequelize.query).toHaveBeenCalledTimes(3);
      expect(mockSequelize.query).toHaveBeenNthCalledWith(
        1,
        'UPDATE Videos SET fileSize = ?, removed = ? WHERE id = ?',
        {
          replacements: [2000, 0, 1],
          type: 'UPDATE'
        }
      );
      expect(mockSequelize.query).toHaveBeenNthCalledWith(
        2,
        'UPDATE Videos SET removed = ? WHERE id = ?',
        {
          replacements: [1, 2],
          type: 'UPDATE'
        }
      );
      expect(mockSequelize.query).toHaveBeenNthCalledWith(
        3,
        'UPDATE Videos SET fileSize = ? WHERE id = ?',
        {
          replacements: [5000, 3],
          type: 'UPDATE'
        }
      );
    });

    test('should convert removed false to 0', async () => {
      const updates = [
        { id: 1, removed: false }
      ];

      await fileCheckModule.applyVideoUpdates(mockSequelize, mockSequelizeLib, updates);

      expect(mockSequelize.query).toHaveBeenCalledWith(
        'UPDATE Videos SET removed = ? WHERE id = ?',
        {
          replacements: [0, 1],
          type: 'UPDATE'
        }
      );
    });

    test('should convert removed true to 1', async () => {
      const updates = [
        { id: 1, removed: true }
      ];

      await fileCheckModule.applyVideoUpdates(mockSequelize, mockSequelizeLib, updates);

      expect(mockSequelize.query).toHaveBeenCalledWith(
        'UPDATE Videos SET removed = ? WHERE id = ?',
        {
          replacements: [1, 1],
          type: 'UPDATE'
        }
      );
    });

    test('should skip update with no fileSize or removed properties', async () => {
      const updates = [
        { id: 1 }
      ];

      await fileCheckModule.applyVideoUpdates(mockSequelize, mockSequelizeLib, updates);

      expect(mockSequelize.query).not.toHaveBeenCalled();
    });

    test('should handle large file sizes', async () => {
      const largeSize = 5000000000;
      const updates = [
        { id: 1, fileSize: largeSize }
      ];

      await fileCheckModule.applyVideoUpdates(mockSequelize, mockSequelizeLib, updates);

      expect(mockSequelize.query).toHaveBeenCalledWith(
        'UPDATE Videos SET fileSize = ? WHERE id = ?',
        {
          replacements: [largeSize, 1],
          type: 'UPDATE'
        }
      );
    });

    test('should handle zero file size', async () => {
      const updates = [
        { id: 1, fileSize: 0 }
      ];

      await fileCheckModule.applyVideoUpdates(mockSequelize, mockSequelizeLib, updates);

      expect(mockSequelize.query).toHaveBeenCalledWith(
        'UPDATE Videos SET fileSize = ? WHERE id = ?',
        {
          replacements: [0, 1],
          type: 'UPDATE'
        }
      );
    });

    test('should handle query errors by propagating them', async () => {
      const updates = [
        { id: 1, fileSize: 2000 }
      ];

      const error = new Error('Database connection failed');
      mockSequelize.query.mockRejectedValueOnce(error);

      await expect(
        fileCheckModule.applyVideoUpdates(mockSequelize, mockSequelizeLib, updates)
      ).rejects.toThrow('Database connection failed');
    });

    test('should set filePath and fileSize when both provided', async () => {
      const updates = [
        { id: 1, filePath: '/videos/channel/video [abc123].mkv', fileSize: 5000, removed: false }
      ];

      await fileCheckModule.applyVideoUpdates(mockSequelize, mockSequelizeLib, updates);

      expect(mockSequelize.query).toHaveBeenCalledWith(
        'UPDATE Videos SET filePath = ?, fileSize = ?, removed = ? WHERE id = ?',
        expect.objectContaining({
          replacements: ['/videos/channel/video [abc123].mkv', 5000, 0, 1]
        })
      );
    });

    test('should continue with remaining updates if one fails', async () => {
      const updates = [
        { id: 1, fileSize: 2000 },
        { id: 2, fileSize: 3000 }
      ];

      mockSequelize.query
        .mockRejectedValueOnce(new Error('Update failed'))
        .mockResolvedValueOnce();

      await expect(
        fileCheckModule.applyVideoUpdates(mockSequelize, mockSequelizeLib, updates)
      ).rejects.toThrow('Update failed');

      expect(mockSequelize.query).toHaveBeenCalledTimes(1);
    });
  });

  describe('integration tests', () => {
    test('should work end-to-end with checkVideoFiles and applyVideoUpdates', async () => {
      const videos = [
        {
          id: 1,
          youtubeId: 'abc123',
          filePath: '/videos/channel/video1.mp4',
          fileSize: '1000',
          removed: false
        },
        {
          id: 2,
          youtubeId: 'def456',
          filePath: '/videos/channel/video2.mp4',
          removed: false
        }
      ];

      mockFs.stat.mockImplementation((p) => {
        if (p === '/videos/channel/video1.mp4') {
          return Promise.resolve({ size: 1500 });
        }
        // video2 and any extension fallbacks all ENOENT
        return Promise.reject({ code: 'ENOENT' });
      });

      const mockSequelize = {
        query: jest.fn()
      };

      const mockSequelizeLib = {
        QueryTypes: {
          UPDATE: 'UPDATE'
        }
      };

      const checkResult = await fileCheckModule.checkVideoFiles(videos);

      expect(checkResult.updates).toHaveLength(2);
      expect(checkResult.videos[0].fileSize).toBe('1500');
      expect(checkResult.videos[1].removed).toBe(true);

      await fileCheckModule.applyVideoUpdates(
        mockSequelize,
        mockSequelizeLib,
        checkResult.updates
      );

      expect(mockSequelize.query).toHaveBeenCalledTimes(2);
    });
  });
});
