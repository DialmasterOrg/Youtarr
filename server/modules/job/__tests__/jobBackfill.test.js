/* eslint-env jest */

jest.mock('node-cron');
jest.mock('../../messageEmitter.js');
jest.mock('../../configModule');
jest.mock('../../../models/job');
jest.mock('../../../models/video');
jest.mock('../../../models/jobvideo');
jest.mock('../../../models/channelvideo');
jest.mock('../../channelVideoReanchor', () => ({
  applyExactDateForGroup: jest.fn().mockResolvedValue(undefined),
  applyExactDateForVideo: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../logger');

describe('jobBackfill', () => {
  let jobBackfill;
  let fs;
  let fsPromises;
  let cron;
  let MessageEmitter;
  let Video;
  let ChannelVideo;
  let logger;
  let scheduledTaskRuns;
  let videosModule;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    jest.doMock('fs', () => ({
      existsSync: jest.fn(),
      mkdirSync: jest.fn(),
      readFileSync: jest.fn(),
      renameSync: jest.fn(),
      writeFileSync: jest.fn(),
      promises: {
        readFile: jest.fn(),
        writeFile: jest.fn(),
        stat: jest.fn(),
        access: jest.fn()
      }
    }));
    fs = require('fs');
    fsPromises = fs.promises;

    cron = require('node-cron');
    cron.validate.mockReturnValue(true);
    cron.getTasks.mockReturnValue(new Map());
    cron.schedule = jest.fn(() => ({ start: jest.fn(), stop: jest.fn() }));

    MessageEmitter = require('../../messageEmitter.js');
    MessageEmitter.emitMessage = jest.fn();

    logger = require('../../../logger');

    jest.doMock('../../configModule', () => ({
      getJobsPath: jest.fn().mockReturnValue('/test/jobs'),
      getConfig: jest.fn().mockReturnValue({}),
      onConfigChange: jest.fn(),
      directoryPath: '/test/output'
    }));

    jest.doMock('../../scheduledTaskRuns', () => ({
      record: jest.fn().mockResolvedValue(undefined)
    }));
    scheduledTaskRuns = require('../../scheduledTaskRuns');

    // Library repair walks the downloads folder through videosModule.
    jest.doMock('../../videosModule', () => ({
      scanForVideoFiles: jest.fn().mockResolvedValue({ fileMap: new Map(), duplicates: new Map(), unreadable: 0 })
    }));
    videosModule = require('../../videosModule');

    Video = require('../../../models/video');
    ChannelVideo = require('../../../models/channelvideo');

    Video.findAll = jest.fn().mockResolvedValue([]);
    Video.findOne = jest.fn().mockResolvedValue(null);
    Video.create = jest.fn().mockImplementation(data => Promise.resolve({ id: data.youtubeId, ...data }));

    ChannelVideo.findOrCreate = jest.fn().mockResolvedValue([{}, true]);
  });

  describe('backfillFromCompleteList', () => {
    beforeEach(() => {
      jobBackfill = require('../jobBackfill');
    });

    test('should skip when complete.list does not exist', async () => {
      fsPromises.readFile.mockRejectedValue({ code: 'ENOENT' });

      await expect(jobBackfill.backfillFromCompleteList()).resolves.toEqual(expect.objectContaining({
        status: 'skipped', message: 'No download archive (complete.list) found.'
      }));

      expect(logger.info).toHaveBeenCalledWith('No complete.list found for backfill. Skipping.');
    });

    test('reports records that could not be written as a partial failure', async () => {
      fsPromises.readFile.mockImplementation(async (path) => {
        if (path.includes('complete.list')) {
          return 'youtube video-1\nyoutube video-2\n';
        }
        if (path.includes('.info.json')) {
          const id = path.includes('video-1') ? 'video-1' : 'video-2';
          return JSON.stringify({
            id,
            uploader: 'Channel',
            title: `Video ${id}`,
            duration: 100,
            description: 'Description',
            upload_date: '20240101',
            channel_id: 'channel-1'
          });
        }
        throw new Error('Unknown file');
      });
      fsPromises.stat.mockRejectedValue(new Error('ENOENT'));
      Video.findAll.mockResolvedValue([]);
      ChannelVideo.findAll.mockResolvedValue([]);
      Video.findOne.mockResolvedValue(null);
      Video.create.mockRejectedValueOnce(new Error('deadlock'));

      await expect(jobBackfill.backfillFromCompleteList()).resolves.toEqual(expect.objectContaining({
        status: 'error',
        outcome: 'partial',
        message: 'Recovered 1 video records and 2 channel video records; 1 write failed.',
        details: { videosUpserts: 1, channelVideosUpserts: 2, failed: 1, unreadableOnDisk: 0, recreatedUnverified: 0 }
      }));
    });

    test('resolves to an error record when the archive cannot be read', async () => {
      fsPromises.readFile.mockRejectedValue(new Error('EACCES: permission denied'));

      await expect(jobBackfill.backfillFromCompleteList()).resolves.toEqual(expect.objectContaining({
        status: 'error', outcome: 'error', message: 'EACCES: permission denied'
      }));
    });

    test('should backfill missing videos from complete.list', async () => {
      fsPromises.readFile.mockImplementation(async (path) => {
        if (path.includes('complete.list')) {
          return 'youtube video-1\nyoutube video-2\n';
        }
        if (path.includes('video-1.info.json')) {
          return JSON.stringify({
            id: 'video-1',
            uploader: 'Channel 1',
            title: 'Video 1',
            duration: 100,
            description: 'Description 1',
            upload_date: '20240101',
            channel_id: 'channel-1'
          });
        }
        if (path.includes('video-2.info.json')) {
          return JSON.stringify({
            id: 'video-2',
            uploader: 'Channel 2',
            title: 'Video 2',
            duration: 200,
            description: 'Description 2',
            upload_date: '20240102',
            channel_id: 'channel-2'
          });
        }
        throw new Error('Unknown file');
      });

      // Mock stat to simulate file not found (new functionality tries to check file existence)
      fsPromises.stat.mockRejectedValue(new Error('ENOENT'));

      Video.findAll.mockResolvedValue([]);
      ChannelVideo.findAll.mockResolvedValue([]);
      Video.findOne.mockResolvedValue(null);

      const record = await jobBackfill.backfillFromCompleteList();

      expect(record).toEqual(expect.objectContaining({
        status: 'success',
        outcome: 'completed',
        message: 'Recovered 2 video records and 2 channel video records.',
        details: { videosUpserts: 2, channelVideosUpserts: 2, failed: 0, unreadableOnDisk: 0, recreatedUnverified: 0 }
      }));
      expect(Video.create).toHaveBeenCalledTimes(2);
      // Recreated without a file on disk: missing, not deleted.
      expect(Video.create).toHaveBeenCalledWith(expect.objectContaining({
        youtubeId: 'video-1',
        removed: true,
        removed_reason: 'not_found',
        removed_at: expect.any(Date),
        removed_detail: null
      }));
      expect(ChannelVideo.findOrCreate).toHaveBeenCalledTimes(2);
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          videosUpserts: 2,
          channelVideosUpserts: 2
        }),
        'Backfill complete'
      );

    });

    test('should cap backfill to 300 items per run', async () => {

      // Create 350 video IDs
      const videoIds = Array.from({ length: 350 }, (_, i) => `youtube video-${i}`).join('\n');
      fsPromises.readFile.mockImplementation(async (path) => {
        if (path.includes('complete.list')) {
          return videoIds;
        }
        // Return valid info for any video
        const match = path.match(/video-(\d+)/);
        const videoNum = match ? match[1] : '0';
        return JSON.stringify({
          id: `video-${videoNum}`,
          channel_id: 'channel-1',
          title: 'Video',
          upload_date: '20240101'
        });
      });

      // Mock stat to simulate file not found
      fsPromises.stat.mockRejectedValue(new Error('ENOENT'));

      Video.findAll.mockResolvedValue([]);
      ChannelVideo.findAll.mockResolvedValue([]);

      // All videos return as "not exists"
      Video.findOne.mockResolvedValue(null);

      // Wait for any pending async operations from module init to complete
      await new Promise(resolve => setTimeout(resolve, 50));

      // Clear any previous calls from module initialization
      Video.create.mockClear();
      ChannelVideo.findOrCreate.mockClear();

      await jobBackfill.backfillFromCompleteList();

      // Should only process 300 items per run
      // Check that ChannelVideo operations are capped at 300
      expect(ChannelVideo.findOrCreate).toHaveBeenCalledTimes(300);
      // Video.create should also be capped at 300 for new videos
      expect(Video.create).toHaveBeenCalledTimes(300);

    });

    test('recovers nothing and names the ids whose info.json is missing', async () => {
      fsPromises.readFile.mockImplementation(async (path) => {
        if (path.includes('complete.list')) {
          return 'youtube video-1\nyoutube video-2\n';
        }
        throw { code: 'ENOENT' };
      });

      Video.findAll.mockResolvedValue([]);
      ChannelVideo.findAll.mockResolvedValue([]);

      const result = await jobBackfill.backfillFromCompleteList();

      expect(result).toMatchObject({
        status: 'success',
        outcome: 'completed',
        details: { videosUpserts: 0, channelVideosUpserts: 0 },
      });
      expect(Video.create).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ missingCount: 2 }),
        'Backfill skipped due to missing info.json'
      );
    });

    test('should skip already existing videos', async () => {

      fsPromises.readFile.mockImplementation(async (path) => {
        if (path.includes('complete.list')) {
          return 'youtube existing-video\nyoutube new-video\n';
        }
        return JSON.stringify({
          id: path.includes('existing') ? 'existing-video' : 'new-video',
          channel_id: 'channel-1',
          title: 'Video',
          upload_date: '20240101'
        });
      });

      // Mock stat to simulate file not found
      fsPromises.stat.mockRejectedValue(new Error('ENOENT'));

      // Existing video already in DB
      Video.findAll.mockResolvedValue([
        { youtubeId: 'existing-video' }
      ]);
      ChannelVideo.findAll.mockResolvedValue([]);
      Video.findOne.mockImplementation(async ({ where }) => {
        if (where.youtubeId === 'existing-video') {
          return { youtubeId: 'existing-video' };
        }
        return null;
      });

      await jobBackfill.backfillFromCompleteList();

      // Should only create the new video
      expect(Video.create).toHaveBeenCalledTimes(1);
      expect(Video.create).toHaveBeenCalledWith(
        expect.objectContaining({ youtubeId: 'new-video' })
      );

    });

    test('should include file metadata when video file exists', async () => {

      fsPromises.readFile.mockImplementation(async (path) => {
        if (path.includes('complete.list')) {
          return 'youtube video-1\n';
        }
        if (path.includes('video-1.info.json')) {
          return JSON.stringify({
            id: 'video-1',
            uploader: 'Channel 1',
            title: 'Video 1',
            duration: 100,
            description: 'Description 1',
            upload_date: '20240101',
            channel_id: 'channel-1'
          });
        }
        throw new Error('Unknown file');
      });

      const filePath = '/test/output/Channel 1/Channel 1 - Video 1 - video-1/Channel 1 - Video 1  [video-1].mp4';
      videosModule.scanForVideoFiles.mockResolvedValue({
        fileMap: new Map([['video-1', { videoFilePath: filePath, videoFileSize: 123456789, audioFilePath: null, audioFileSize: null }]]),
        duplicates: new Map(),
      });

      Video.findAll.mockResolvedValue([]);
      ChannelVideo.findAll.mockResolvedValue([]);
      Video.findOne.mockResolvedValue(null);

      await jobBackfill.backfillFromCompleteList();

      expect(videosModule.scanForVideoFiles).toHaveBeenCalledWith('/test/output');
      expect(Video.create).toHaveBeenCalledTimes(1);
      expect(Video.create).toHaveBeenCalledWith(
        expect.objectContaining({
          youtubeId: 'video-1',
          filePath,
          fileSize: '123456789',
          removed: false,
          removed_reason: null,
          removed_at: null,
          removed_detail: null
        })
      );

    });

    describe('existing and recreated rows', () => {
      const mp4Path = '/test/output/Channel 1/Channel 1 - Video 1 - video-1/Channel 1 - Video 1  [video-1].mp4';
      const existingRow = (overrides = {}) => ({
        id: 7,
        youtubeId: 'video-1',
        removed: false,
        filePath: null,
        fileSize: null,
        audioFilePath: null,
        audioFileSize: null,
        video_resolution: null,
        last_downloaded_at: null,
        media_type: 'video',
        normalized_rating: null,
        update: jest.fn(),
        ...overrides,
      });
      const fileStat = (size) => ({ size, isFile: () => true });

      beforeEach(() => {
        fsPromises.readFile.mockImplementation(async (path) => {
          if (path.includes('complete.list')) return 'youtube video-1\n';
          if (path.includes('video-1.info.json')) {
            return JSON.stringify({
              id: 'video-1',
              uploader: 'Channel 1',
              title: 'Video 1',
              duration: 100,
              upload_date: '20240101',
              channel_id: 'channel-1'
            });
          }
          throw new Error('Unknown file');
        });
        ChannelVideo.findAll.mockResolvedValue([]);
        Video.update.mockResolvedValue([1]);
      });

      test('fills in the found file on a row missing its size, if the row is unchanged', async () => {
        const row = existingRow({ filePath: mp4Path });
        fsPromises.stat.mockResolvedValue(fileStat(987654321));
        Video.findAll.mockResolvedValue([{ youtubeId: 'video-1' }]);
        Video.findOne.mockResolvedValue(row);

        await jobBackfill.backfillFromCompleteList();

        expect(Video.create).not.toHaveBeenCalled();
        expect(Video.update).toHaveBeenCalledWith(
          { filePath: mp4Path, fileSize: '987654321', removed: false, removed_reason: null, removed_at: null, removed_detail: null },
          { where: expect.objectContaining({ id: 7, removed: false, filePath: mp4Path, fileSize: null }) }
        );
      });

      test('leaves an audio-only row without a video path', async () => {
        const row = existingRow({ audioFilePath: '/test/output/Channel 1/Video 1 [video-1].mp3', audioFileSize: '4096' });
        fsPromises.stat.mockRejectedValue(new Error('ENOENT'));
        Video.findAll.mockResolvedValue([{ youtubeId: 'video-1' }]);
        Video.findOne.mockResolvedValue(row);

        await jobBackfill.backfillFromCompleteList();

        expect(Video.update).not.toHaveBeenCalled();
        expect(row.update).not.toHaveBeenCalled();
      });

      test('keeps a deleted row missing when its file is not found', async () => {
        const row = existingRow({ removed: true, filePath: mp4Path });
        fsPromises.stat.mockRejectedValue(new Error('ENOENT'));
        Video.findAll.mockResolvedValue([{ youtubeId: 'video-1' }]);
        Video.findOne.mockResolvedValue(row);

        await jobBackfill.backfillFromCompleteList();

        expect(Video.update).not.toHaveBeenCalled();
        expect(row.update).not.toHaveBeenCalled();
      });

      test('does not restore a row deleted just before it was read', async () => {
        // Cleanup deletes the file and marks the row removed; the repair only
        // sees that if it checks the disk after reading the row.
        let deleted = false;
        fsPromises.stat.mockImplementation(async () => {
          if (deleted) throw new Error('ENOENT');
          return fileStat(123);
        });
        const row = existingRow({ removed: true, filePath: mp4Path });
        Video.findAll.mockResolvedValue([{ youtubeId: 'video-1' }]);
        Video.findOne.mockImplementation(async () => {
          deleted = true;
          return row;
        });

        await jobBackfill.backfillFromCompleteList();

        expect(Video.update).not.toHaveBeenCalled();
        expect(row.update).not.toHaveBeenCalled();
      });

      test('skips the file update without a failure when the row changed after it was read', async () => {
        fsPromises.stat.mockResolvedValue(fileStat(123));
        Video.findAll.mockResolvedValue([{ youtubeId: 'video-1' }]);
        Video.findOne.mockResolvedValue(existingRow({ filePath: mp4Path }));
        Video.update.mockResolvedValue([0]);

        const record = await jobBackfill.backfillFromCompleteList();

        expect(record.details.failed).toBe(0);
        expect(logger.info).toHaveBeenCalledWith(
          { youtubeId: 'video-1' },
          'Video changed during backfill, skipping file update'
        );
      });

      test('does not record a directory at the guessed path as the file', async () => {
        fsPromises.stat.mockResolvedValue({ size: 4096, isFile: () => false });
        Video.findAll.mockResolvedValue([{ youtubeId: 'video-1' }]);
        Video.findOne.mockResolvedValue(existingRow({ filePath: mp4Path }));

        await jobBackfill.backfillFromCompleteList();

        expect(Video.update).not.toHaveBeenCalled();
      });

      test('recreates a missing row as removed when its file is not found', async () => {
        Video.findAll.mockResolvedValue([]);
        Video.findOne.mockResolvedValue(null);

        await jobBackfill.backfillFromCompleteList();

        expect(Video.create).toHaveBeenCalledWith(
          expect.objectContaining({ youtubeId: 'video-1', filePath: mp4Path, fileSize: null, removed: true })
        );
      });

      test('keeps an age limit of 0 on a recreated row', async () => {
        fsPromises.readFile.mockImplementation(async (path) => {
          if (path.includes('complete.list')) return 'youtube video-1\n';
          return JSON.stringify({
            id: 'video-1', uploader: 'Channel 1', title: 'Video 1', channel_id: 'channel-1', age_limit: 0,
          });
        });
        Video.findAll.mockResolvedValue([]);
        Video.findOne.mockResolvedValue(null);

        await jobBackfill.backfillFromCompleteList();

        expect(Video.create).toHaveBeenCalledWith(expect.objectContaining({ youtubeId: 'video-1', age_limit: 0 }));
      });

      test('recreates a lost audio-only row from the audio file found on disk', async () => {
        const mp3Path = '/test/output/Channel 1/Video 1 [video-1].mp3';
        videosModule.scanForVideoFiles.mockResolvedValue({
          fileMap: new Map([['video-1', { videoFilePath: null, videoFileSize: null, audioFilePath: mp3Path, audioFileSize: 4096 }]]),
          duplicates: new Map(),
        });
        Video.findAll.mockResolvedValue([]);
        Video.findOne.mockResolvedValue(null);

        await jobBackfill.backfillFromCompleteList();

        expect(Video.create).toHaveBeenCalledWith(expect.objectContaining({
          filePath: null, fileSize: null, audioFilePath: mp3Path, audioFileSize: '4096', removed: false,
        }));
      });

      test('walks the downloads folder once per run however many rows were lost', async () => {
        fsPromises.readFile.mockImplementation(async (path) => {
          if (path.includes('complete.list')) return 'youtube video-1\nyoutube video-2\n';
          const id = path.includes('video-1') ? 'video-1' : 'video-2';
          return JSON.stringify({ id, uploader: 'Channel 1', title: id, channel_id: 'channel-1' });
        });
        Video.findAll.mockResolvedValue([]);
        Video.findOne.mockResolvedValue(null);

        await jobBackfill.backfillFromCompleteList();

        expect(Video.create).toHaveBeenCalledTimes(2);
        expect(videosModule.scanForVideoFiles).toHaveBeenCalledTimes(1);
      });

      test('logs how many files the walk found', async () => {
        Video.findAll.mockResolvedValue([]);
        Video.findOne.mockResolvedValue(null);

        await jobBackfill.backfillFromCompleteList();

        expect(logger.info).toHaveBeenCalledWith(
          { filesOnDisk: 0 },
          'Searched the downloads folder for lost video records'
        );
      });

      test('still recreates a lost row as missing when parts of the folder could not be read', async () => {
        videosModule.scanForVideoFiles.mockResolvedValue({ fileMap: new Map(), duplicates: new Map(), unreadable: 2 });
        Video.findAll.mockResolvedValue([]);
        Video.findOne.mockResolvedValue(null);

        await jobBackfill.backfillFromCompleteList();

        expect(logger.warn).toHaveBeenCalledWith(
          { unreadable: 2 },
          'Parts of the downloads folder could not be read; lost videos stored there are recreated as missing'
        );
        expect(Video.create).toHaveBeenCalledWith(expect.objectContaining({ youtubeId: 'video-1', removed: true }));
      });

      test('reports a run as partial when a lost row was recreated as missing during a partial walk', async () => {
        videosModule.scanForVideoFiles.mockResolvedValue({ fileMap: new Map(), duplicates: new Map(), unreadable: 2 });
        Video.findAll.mockResolvedValue([]);
        Video.findOne.mockResolvedValue(null);

        const record = await jobBackfill.backfillFromCompleteList();

        expect(record).toEqual(expect.objectContaining({
          status: 'error',
          outcome: 'partial',
          message: 'Recovered 1 video records and 1 channel video records; 1 recreated as missing because parts of the downloads folder could not be read.',
          details: expect.objectContaining({ unreadableOnDisk: 2, recreatedUnverified: 1 }),
        }));
      });

      test('keeps a partial walk completed when every lost row was found', async () => {
        videosModule.scanForVideoFiles.mockResolvedValue({
          fileMap: new Map([['video-1', { videoFilePath: mp4Path, videoFileSize: 123, audioFilePath: null, audioFileSize: null }]]),
          duplicates: new Map(),
          unreadable: 2,
        });
        Video.findAll.mockResolvedValue([]);
        Video.findOne.mockResolvedValue(null);

        const record = await jobBackfill.backfillFromCompleteList();

        expect(record).toEqual(expect.objectContaining({
          outcome: 'completed',
          details: expect.objectContaining({ unreadableOnDisk: 2, recreatedUnverified: 0 }),
        }));
      });

      test('does not walk the downloads folder when no row was lost', async () => {
        fsPromises.stat.mockRejectedValue(new Error('ENOENT'));
        Video.findAll.mockResolvedValue([{ youtubeId: 'video-1' }]);
        Video.findOne.mockResolvedValue(existingRow({ filePath: mp4Path }));

        await jobBackfill.backfillFromCompleteList();

        expect(videosModule.scanForVideoFiles).not.toHaveBeenCalled();
      });

      test('finds another extension even when the title contains ".mp4"', async () => {
        const base = '/test/output/Channel 1/Channel 1 - Convert .mp4 Files - video-1/Channel 1 - Convert .mp4 Files  [video-1]';
        fsPromises.readFile.mockImplementation(async (path) => {
          if (path.includes('complete.list')) return 'youtube video-1\n';
          return JSON.stringify({ id: 'video-1', uploader: 'Channel 1', title: 'Convert .mp4 Files', channel_id: 'channel-1' });
        });
        fsPromises.stat.mockImplementation(async (path) => {
          if (path === `${base}.webm`) return fileStat(777);
          throw new Error('ENOENT');
        });
        Video.findAll.mockResolvedValue([{ youtubeId: 'video-1' }]);
        Video.findOne.mockResolvedValue(existingRow());

        await jobBackfill.backfillFromCompleteList();

        expect(Video.update).toHaveBeenCalledWith(
          { filePath: `${base}.webm`, fileSize: '777', removed: false, removed_reason: null, removed_at: null, removed_detail: null },
          expect.anything()
        );
      });

      test('treats a row created concurrently by a download as already existing', async () => {
        Video.findAll.mockResolvedValue([]);
        Video.findOne.mockResolvedValue(null);
        Video.create.mockRejectedValueOnce(Object.assign(new Error('Duplicate'), { name: 'SequelizeUniqueConstraintError' }));

        const record = await jobBackfill.backfillFromCompleteList();

        expect(record.details).toEqual(expect.objectContaining({ videosUpserts: 0, failed: 0 }));
      });
    });
  });

  describe('archive repair locking', () => {
    let scheduledTaskManager;

    beforeEach(() => {
      jobBackfill = require('../jobBackfill');
      scheduledTaskManager = require('../../scheduledTaskManager');
    });

    // Holds the complete.list read open until release() is called, so a
    // second call can be made while the first is still in progress.
    function deferArchiveRead() {
      let releaseRead;
      let readCalls = 0;
      fsPromises.readFile.mockImplementation((filePath) => {
        if (String(filePath).includes('complete.list')) {
          readCalls += 1;
          return new Promise((resolve, reject) => {
            releaseRead = () => reject(Object.assign(new Error('missing'), { code: 'ENOENT' }));
          });
        }
        return Promise.reject(Object.assign(new Error('missing'), { code: 'ENOENT' }));
      });
      return { release: () => releaseRead(), readCalls: () => readCalls };
    }

    test('resolves an overlapping call as skipped and reads the archive only once', async () => {
      const archiveRead = deferArchiveRead();

      const first = jobBackfill.backfillFromCompleteList();
      const second = await jobBackfill.backfillFromCompleteList();

      expect(second).toEqual({
        status: 'skipped',
        outcome: 'skipped',
        message: 'A library repair was already running.',
      });

      archiveRead.release();
      await first;

      expect(archiveRead.readCalls()).toBe(1);
    });

    test('isArchiveRepairRunning is true while the repair is pending and false once it finishes', async () => {
      const archiveRead = deferArchiveRead();

      expect(jobBackfill.isArchiveRepairRunning()).toBe(false);

      const pending = jobBackfill.backfillFromCompleteList();

      expect(jobBackfill.isArchiveRepairRunning()).toBe(true);

      archiveRead.release();
      await pending;

      expect(jobBackfill.isArchiveRepairRunning()).toBe(false);
    });

    test('releases the lock when the repair throws', async () => {
      jobBackfill._repairFromArchive = jest.fn().mockRejectedValue(new Error('boom'));

      await expect(jobBackfill.backfillFromCompleteList()).rejects.toThrow('boom');

      expect(jobBackfill.isArchiveRepairRunning()).toBe(false);
    });

    test('the repair reports as running through the scheduler', async () => {
      const archiveRead = deferArchiveRead();

      const pending = jobBackfill.backfillFromCompleteList();
      jobBackfill.scheduleDailyBackfill();

      expect(
        scheduledTaskManager.getStatus().find((t) => t.id === 'archiveBackfillFrequency').running
      ).toBe(true);

      archiveRead.release();
      await pending;

      expect(
        scheduledTaskManager.getStatus().find((t) => t.id === 'archiveBackfillFrequency').running
      ).toBe(false);
    });
  });

  describe('runStartupBackfill announces', () => {
    let scheduledTaskManager;

    beforeEach(() => {
      fsPromises.readFile.mockRejectedValue({ code: 'ENOENT' });
      jobBackfill = require('../jobBackfill');
      scheduledTaskManager = require('../../scheduledTaskManager');
    });

    test('calls announceRun with the archive lock already held, and still records the startup run', async () => {
      let runningAtCall;
      const announceRunSpy = jest.spyOn(scheduledTaskManager, 'announceRun').mockImplementation((id, promise) => {
        runningAtCall = jobBackfill.isArchiveRepairRunning();
        return promise;
      });

      await jobBackfill.runStartupBackfill();

      expect(announceRunSpy).toHaveBeenCalledWith('archiveBackfillFrequency', expect.any(Promise));
      expect(runningAtCall).toBe(true);
      expect(scheduledTaskRuns.record).toHaveBeenCalledWith(
        expect.objectContaining({ taskKey: 'archiveBackfillFrequency', trigger: 'startup' })
      );
    });

    test('broadcasts the archive task status through messageEmitter when the startup pass runs', async () => {
      jest.spyOn(scheduledTaskManager, 'announceRun');

      await jobBackfill.runStartupBackfill();

      expect(MessageEmitter.emitMessage).toHaveBeenCalledWith(
        'broadcast', null, 'schedules', 'scheduledTaskStatus', { key: 'archiveBackfillFrequency' }
      );
    });
  });

  describe('scheduleDailyBackfill', () => {
    beforeEach(() => {
      jobBackfill = require('../jobBackfill');
    });

    test('should schedule cron job for daily backfill', () => {

      jobBackfill.scheduleDailyBackfill();

      expect(cron.schedule).toHaveBeenCalledWith('20 2 * * *', expect.any(Function), expect.objectContaining({ scheduled: false }));
      expect(logger.info).toHaveBeenCalled();

    });

    test('should handle cron scheduling errors', () => {
      require('../../configModule').getConfig.mockReturnValue({ archiveBackfillFrequency: '0 18 * * *' });
      cron.schedule.mockImplementation(() => {
        throw new Error('Cron error');
      });

      expect(() => jobBackfill.scheduleDailyBackfill()).not.toThrow();

      expect(logger.error).toHaveBeenCalled();

    });
  });

  describe('archive location', () => {
    beforeEach(() => {
      jobBackfill = require('../jobBackfill');
    });

    test('reads the archive from config/complete.list', async () => {
      fsPromises.readFile.mockRejectedValue(Object.assign(new Error('missing'), { code: 'ENOENT' }));

      await jobBackfill.backfillFromCompleteList();

      const archivePath = fsPromises.readFile.mock.calls[0][0];
      expect(archivePath).toBe(require('path').resolve(__dirname, '../../../../config/complete.list'));
    });

    test('reads info.json from the configured jobs folder', async () => {
      ChannelVideo.findAll = jest.fn().mockResolvedValue([]);
      fsPromises.readFile.mockImplementation(async (filePath) => {
        if (String(filePath).includes('complete.list')) return 'youtube video-1\n';
        throw Object.assign(new Error('missing'), { code: 'ENOENT' });
      });

      await jobBackfill.backfillFromCompleteList();

      expect(fsPromises.readFile).toHaveBeenCalledWith('/test/jobs/info/video-1.info.json', 'utf-8');
    });
  });
});
