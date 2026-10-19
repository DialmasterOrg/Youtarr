/* eslint-env jest */

jest.mock('fs', () => ({
  promises: {
    stat: jest.fn()
  }
}));

// What the check writes when a file is gone, and when it is (back) on disk.
const MISSING_COLUMNS = { removed: true, removed_reason: 'not_found', removed_at: expect.any(Date), removed_detail: null };
const PRESENT_COLUMNS = { removed: false, removed_reason: null, removed_at: null, removed_detail: null };

describe('FileCheckModule', () => {
  let fileCheckModule;
  let mockFs;
  let mockVideo;
  let mockLibraryRootCheck;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    mockFs = require('fs').promises;

    // Mock the Video model
    mockVideo = {
      update: jest.fn().mockResolvedValue(),
    };
    jest.doMock('../../models', () => ({
      Video: mockVideo
    }));

    // The downloads folder looks mounted unless a test says otherwise.
    mockLibraryRootCheck = {
      ...jest.requireActual('../libraryRootCheck'),
      checkLibraryRoot: jest.fn().mockResolvedValue({ ok: true }),
    };
    jest.doMock('../libraryRootCheck', () => mockLibraryRootCheck);
    jest.doMock('../configModule', () => ({ directoryPath: '/videos' }));

    fileCheckModule = require('../fileCheckModule');
  });

  describe('while the downloads folder looks unmounted', () => {
    const failedCheck = { ok: false, reason: 'empty', path: '/videos', message: 'The downloads folder is empty.' };
    const presentRow = (id, youtubeId) => ({
      id, youtubeId, filePath: `/videos/channel/${youtubeId}.mp4`, fileSize: '1000', removed: false
    });

    test('holds back the missing mark and reports how many rows it held', async () => {
      mockLibraryRootCheck.checkLibraryRoot.mockResolvedValue(failedCheck);
      mockFs.stat.mockRejectedValue({ code: 'ENOENT' });

      const result = await fileCheckModule.checkVideoFiles([presentRow(1, 'abc123'), presentRow(2, 'def456')]);

      expect(result.updates).toEqual([]);
      expect(result.videos.map((v) => v.removed)).toEqual([false, false]);
      expect(result.libraryWarning).toEqual({ reason: 'empty', path: '/videos', message: failedCheck.message, heldBack: 2 });
      expect(mockLibraryRootCheck.checkLibraryRoot).toHaveBeenCalledTimes(1);
      expect(mockLibraryRootCheck.checkLibraryRoot).toHaveBeenCalledWith('/videos');
    });

    test('still records a present file\'s new size', async () => {
      mockLibraryRootCheck.checkLibraryRoot.mockResolvedValue(failedCheck);
      mockFs.stat.mockResolvedValue({ size: 2000 });

      const result = await fileCheckModule.checkVideoFiles([presentRow(1, 'abc123')]);

      expect(result.updates).toEqual([{ id: 1, fileSize: 2000 }]);
      expect(result.libraryWarning).toBeNull();
    });

    describe('when only a subfolder looks unmounted', () => {
      const emptySubfolder = { ok: false, reason: 'subfolder-empty', path: '/videos/__Music', message: 'The subfolder __Music is empty.' };
      const rowAt = (id, filePath) => ({ id, youtubeId: `vid${id}`, filePath, fileSize: '1000', removed: false });

      test('still marks a video stored outside that subfolder missing', async () => {
        mockLibraryRootCheck.checkLibraryRoot.mockResolvedValue(emptySubfolder);
        mockFs.stat.mockRejectedValue({ code: 'ENOENT' });

        const result = await fileCheckModule.checkVideoFiles([rowAt(1, '/videos/__Videos/channel/vid1.mp4')]);

        expect(result.updates).toEqual([{ id: 1, ...MISSING_COLUMNS }]);
        expect(result.libraryWarning).toBeNull();
      });

      test('holds back only the videos under that subfolder', async () => {
        mockLibraryRootCheck.checkLibraryRoot.mockResolvedValue(emptySubfolder);
        mockFs.stat.mockRejectedValue({ code: 'ENOENT' });

        const result = await fileCheckModule.checkVideoFiles([
          rowAt(1, '/videos/__Music/artist/vid1.mp4'),
          rowAt(2, '/videos/__Videos/channel/vid2.mp4'),
        ]);

        expect(result.updates).toEqual([{ id: 2, ...MISSING_COLUMNS }]);
        expect(result.libraryWarning).toEqual(expect.objectContaining({ reason: 'subfolder-empty', heldBack: 1 }));
      });

      test('holds back the videos under every failing subfolder, not just the first', async () => {
        mockLibraryRootCheck.checkLibraryRoot.mockResolvedValue({
          ...emptySubfolder, paths: ['/videos/__Music', '/videos/__Kids'], message: 'The subfolders __Music and __Kids are empty.',
        });
        mockFs.stat.mockRejectedValue({ code: 'ENOENT' });

        const result = await fileCheckModule.checkVideoFiles([
          rowAt(1, '/videos/__Music/artist/vid1.mp4'),
          rowAt(2, '/videos/__Kids/channel/vid2.mp4'),
        ]);

        expect(result.updates).toEqual([]);
        expect(result.libraryWarning).toEqual(expect.objectContaining({ heldBack: 2 }));
      });
    });

    test('does not run the check when no row would be marked missing', async () => {
      mockFs.stat.mockResolvedValue({ size: 1000 });

      const result = await fileCheckModule.checkVideoFiles([presentRow(1, 'abc123')]);

      expect(mockLibraryRootCheck.checkLibraryRoot).not.toHaveBeenCalled();
      expect(result.libraryWarning).toBeNull();
    });
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
          ...MISSING_COLUMNS
        }
      ]);
      expect(result.updates).toEqual([
        { id: 1, ...MISSING_COLUMNS }
      ]);
      expect(result.libraryWarning).toBeNull();
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

    test('leaves a deleted video deleted while its file is still gone', async () => {
      const videos = [
        {
          id: 1,
          youtubeId: 'abc123',
          filePath: '/videos/channel/video.mp4',
          removed: true,
          removed_reason: 'user_deleted',
          removed_at: new Date('2026-10-03T00:00:00Z'),
          removed_detail: null
        }
      ];

      mockFs.stat.mockRejectedValueOnce({ code: 'ENOENT' });

      const result = await fileCheckModule.checkVideoFiles(videos);

      expect(result.videos).toEqual(videos);
      expect(result.updates).toEqual([]);
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
          ...PRESENT_COLUMNS
        }
      ]);
      expect(result.updates).toEqual([
        { id: 1, ...PRESENT_COLUMNS }
      ]);
      expect(mockFs.stat).toHaveBeenCalledWith('/videos/channel/video.mp4');
    });

    test('clears the recorded reason when a deleted video\'s file is back', async () => {
      const videos = [
        {
          id: 1,
          youtubeId: 'abc123',
          filePath: '/videos/channel/video.mp4',
          fileSize: '1000',
          removed: true,
          removed_reason: 'user_deleted',
          removed_at: new Date('2026-10-03T00:00:00Z'),
          removed_detail: null
        }
      ];

      mockFs.stat.mockResolvedValueOnce({ size: 1000 });

      const result = await fileCheckModule.checkVideoFiles(videos);

      expect(result.updates).toEqual([{ id: 1, ...PRESENT_COLUMNS }]);
      expect(result.videos[0]).toEqual(expect.objectContaining(PRESENT_COLUMNS));
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
          ...MISSING_COLUMNS
        },
        {
          id: 2,
          youtubeId: 'def456',
          filePath: '/videos/channel/video2.mp4',
          fileSize: '2000',
          ...PRESENT_COLUMNS
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
        { id: 1, ...MISSING_COLUMNS },
        { id: 2, ...PRESENT_COLUMNS },
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

    test('runs checks concurrently but never more than 16 at once', async () => {
      const videos = Array.from({ length: 40 }, (_, i) => ({
        id: i + 1,
        youtubeId: `id${i}`,
        filePath: `/videos/channel/video${i}.mp4`,
        fileSize: '100',
        removed: false
      }));

      let inFlight = 0;
      let maxInFlight = 0;
      mockFs.stat.mockImplementation(() => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        return new Promise((resolve) => {
          setImmediate(() => {
            inFlight--;
            resolve({ size: 100 });
          });
        });
      });

      const result = await fileCheckModule.checkVideoFiles(videos);

      expect(mockFs.stat).toHaveBeenCalledTimes(40);
      expect(maxInFlight).toBeGreaterThan(1);
      expect(maxInFlight).toBeLessThanOrEqual(16);
      expect(result.updates).toEqual([]);
    });

    test('keeps updates in input order under concurrency', async () => {
      const videos = [
        { id: 1, youtubeId: 'a', filePath: '/videos/a.mp4', fileSize: '100', removed: false },
        { id: 2, youtubeId: 'b', filePath: '/videos/b.mp4', fileSize: '100', removed: false },
        { id: 3, youtubeId: 'c', filePath: '/videos/c.mp4', fileSize: '100', removed: false }
      ];

      // The first video's stat resolves last; its update must still come first.
      mockFs.stat.mockImplementation((p) => {
        const delay = p.includes('/a.mp4') ? 20 : 1;
        return new Promise((resolve) => {
          setTimeout(() => resolve({ size: 999 }), delay);
        });
      });

      const result = await fileCheckModule.checkVideoFiles(videos);

      expect(result.updates.map((u) => u.id)).toEqual([1, 2, 3]);
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
      expect(result.updates[0]).toEqual({ id: 1, ...MISSING_COLUMNS });
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
      expect(result.updates[0]).toEqual({ id: 1, ...MISSING_COLUMNS });
      expect(result.updates[0].audioFilePath).toBeUndefined();
    });
  });

  describe('applyVideoUpdates', () => {
    test('should not execute queries when updates array is empty', async () => {
      await fileCheckModule.applyVideoUpdates([]);

      expect(mockVideo.update).not.toHaveBeenCalled();
    });

    test('should update fileSize only', async () => {
      const updates = [
        { id: 1, fileSize: 2000 }
      ];

      await fileCheckModule.applyVideoUpdates(updates);

      expect(mockVideo.update).toHaveBeenCalledTimes(1);
      expect(mockVideo.update).toHaveBeenCalledWith(
        { fileSize: 2000 },
        { where: { id: 1 } },
      );
    });

    test('marks missing only while the row is still present, so a delete landing meanwhile wins', async () => {
      const updates = [
        { id: 1, removed: true }
      ];

      await fileCheckModule.applyVideoUpdates(updates);

      expect(mockVideo.update).toHaveBeenCalledTimes(1);
      expect(mockVideo.update).toHaveBeenCalledWith(
        { removed: true },
        { where: { id: 1, removed: false } },
      );
    });

    test('writes the removal reason columns along with the flag', async () => {
      const at = new Date('2026-10-03T00:00:00Z');
      await fileCheckModule.applyVideoUpdates([
        { id: 1, removed: true, removed_reason: 'not_found', removed_at: at, removed_detail: null }
      ]);

      expect(mockVideo.update).toHaveBeenCalledWith(
        { removed: true, removed_reason: 'not_found', removed_at: at, removed_detail: null },
        { where: { id: 1, removed: false } },
      );
    });

    test('restores a row only while it is still removed', async () => {
      const updates = [
        { id: 1, fileSize: 2000, removed: false }
      ];

      await fileCheckModule.applyVideoUpdates(updates);

      expect(mockVideo.update).toHaveBeenCalledTimes(1);
      expect(mockVideo.update).toHaveBeenCalledWith(
        { fileSize: 2000, removed: false },
        { where: { id: 1, removed: true } },
      );
    });

    test('should handle multiple updates sequentially', async () => {
      const updates = [
        { id: 1, fileSize: 2000, removed: false },
        { id: 2, removed: true },
        { id: 3, fileSize: 5000 }
      ];

      await fileCheckModule.applyVideoUpdates(updates);

      expect(mockVideo.update).toHaveBeenCalledTimes(3);
      expect(mockVideo.update).toHaveBeenNthCalledWith(
        1,
        { fileSize: 2000, removed: false },
        { where: { id: 1, removed: true } },
      );
      expect(mockVideo.update).toHaveBeenNthCalledWith(
        2,
        { removed: true },
        { where: { id: 2, removed: false } },
      );
      expect(mockVideo.update).toHaveBeenNthCalledWith(
        3,
        { fileSize: 5000 },
        { where: { id: 3 } },
      );
    });

    test('should convert removed false to 0', async () => {
      const updates = [
        { id: 1, removed: false }
      ];

      await fileCheckModule.applyVideoUpdates(updates);

      expect(mockVideo.update).toHaveBeenCalledWith(
        { removed: false },
        { where: { id: 1, removed: true } },
      );
    });

    test('should convert removed true to 1', async () => {
      const updates = [
        { id: 1, removed: true }
      ];

      await fileCheckModule.applyVideoUpdates(updates);

      expect(mockVideo.update).toHaveBeenCalledWith(
        { removed: true },
        { where: { id: 1, removed: false } },
      );
    });

    test('should skip update with no fileSize or removed properties', async () => {
      const updates = [
        { id: 1 }
      ];

      await fileCheckModule.applyVideoUpdates(updates);

      expect(mockVideo.update).not.toHaveBeenCalled();
    });

    test('should handle large file sizes', async () => {
      const largeSize = 5000000000;
      const updates = [
        { id: 1, fileSize: largeSize }
      ];

      await fileCheckModule.applyVideoUpdates(updates);

      expect(mockVideo.update).toHaveBeenCalledWith(
        { fileSize: largeSize },
        { where: { id: 1 } },
      );
    });

    test('should handle zero file size', async () => {
      const updates = [
        { id: 1, fileSize: 0 }
      ];

      await fileCheckModule.applyVideoUpdates(updates);

      expect(mockVideo.update).toHaveBeenCalledWith(
        { fileSize: 0 },
        { where: { id: 1 } },
      );
    });

    test('should handle query errors by propagating them', async () => {
      const updates = [
        { id: 1, fileSize: 2000 }
      ];

      const error = new Error('Database connection failed');
      mockVideo.update.mockRejectedValueOnce(error);

      await expect(
        fileCheckModule.applyVideoUpdates(updates)
      ).rejects.toThrow('Database connection failed');
    });

    test('should set filePath and fileSize when both provided', async () => {
      const updates = [
        { id: 1, filePath: '/videos/channel/video [abc123].mkv', fileSize: 5000, removed: false }
      ];

      await fileCheckModule.applyVideoUpdates(updates);

      expect(mockVideo.update).toHaveBeenCalledWith(
        { filePath: '/videos/channel/video [abc123].mkv', fileSize: 5000, removed: false },
        { where: { id: 1, removed: true } },
      );
    });

    test('should continue with remaining updates if one fails', async () => {
      const updates = [
        { id: 1, fileSize: 2000 },
        { id: 2, fileSize: 3000 }
      ];

      mockVideo.update
        .mockRejectedValueOnce(new Error('Update failed'))
        .mockResolvedValueOnce();

      await expect(
        fileCheckModule.applyVideoUpdates(updates)
      ).rejects.toThrow('Update failed');

      expect(mockVideo.update).toHaveBeenCalledTimes(1);
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

      const checkResult = await fileCheckModule.checkVideoFiles(videos);

      expect(checkResult.updates).toHaveLength(2);
      expect(checkResult.videos[0].fileSize).toBe('1500');
      expect(checkResult.videos[1].removed).toBe(true);

      await fileCheckModule.applyVideoUpdates(checkResult.updates);

      expect(mockVideo.update).toHaveBeenCalledTimes(2);
    });
  });
});
