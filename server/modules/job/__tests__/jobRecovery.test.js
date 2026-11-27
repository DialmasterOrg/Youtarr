/* eslint-env jest */

jest.mock('../../configModule');
jest.mock('../../../models/job');
jest.mock('../../../models/video');
jest.mock('../../../models/jobvideo');
jest.mock('../../../models/jobvideodownload');
jest.mock('../../../models/channelvideo');
jest.mock('../../download/downloadCleanup', () => ({
  cleanupInProgressVideos: jest.fn().mockResolvedValue()
}));
jest.mock('../../channelVideoReanchor', () => ({
  applyExactDateForGroup: jest.fn().mockResolvedValue(undefined),
  applyExactDateForVideo: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../logger');

describe('jobRecovery', () => {
  let jobRecovery;
  let jobRegistry;
  let fs;
  let fsPromises;
  let Job;
  let Video;
  let JobVideo;
  let ChannelVideo;
  let logger;

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

    logger = require('../../../logger');

    jest.doMock('../../configModule', () => ({
      getJobsPath: jest.fn().mockReturnValue('/test/jobs'),
      getConfig: jest.fn().mockReturnValue({}),
      onConfigChange: jest.fn(),
      directoryPath: '/test/output'
    }));

    Job = require('../../../models/job');
    Video = require('../../../models/video');
    JobVideo = require('../../../models/jobvideo');
    const JobVideoDownload = require('../../../models/jobvideodownload');
    ChannelVideo = require('../../../models/channelvideo');

    Job.findAll = jest.fn().mockResolvedValue([]);
    Job.findOne = jest.fn().mockResolvedValue(null);
    Job.create = jest.fn().mockImplementation(data => Promise.resolve({ id: data.id, ...data }));
    Job.update = jest.fn().mockResolvedValue([1]);

    Video.findAll = jest.fn().mockResolvedValue([]);
    Video.findOne = jest.fn().mockResolvedValue(null);
    Video.create = jest.fn().mockImplementation(data => Promise.resolve({ id: data.youtubeId, ...data }));

    JobVideo.findAll = jest.fn().mockResolvedValue([]);
    JobVideo.create = jest.fn().mockResolvedValue({});

    JobVideoDownload.findAll = jest.fn().mockResolvedValue([]);
    JobVideoDownload.destroy = jest.fn().mockResolvedValue(0);

    ChannelVideo.findOrCreate = jest.fn().mockResolvedValue([{}, true]);
  });

  describe('terminateInProgressJobs', () => {
    let JobVideoDownload;

    beforeEach(() => {
      JobVideoDownload = require('../../../models/jobvideodownload');
    });

    test('should change In Progress jobs to Terminated and recover completed videos', async () => {

      jobRegistry = require('../jobRegistry');
      jobRecovery = require('../jobRecovery');

      // Mock completed video downloads - return different data based on job_id
      JobVideoDownload.findAll.mockImplementation(async ({ where }) => {
        if (where.job_id === 'job-1' && where.status === 'completed') {
          return [{ job_id: 'job-1', youtube_id: 'video-1', status: 'completed' }];
        }
        if (where.job_id === 'job-1' && where.status === 'in_progress') {
          return [];
        }
        return [];
      });
      JobVideoDownload.destroy.mockResolvedValue(1);

      // Mock info.json file
      fsPromises.readFile.mockResolvedValue(JSON.stringify({
        id: 'video-1',
        uploader: 'Test Channel',
        title: 'Test Video',
        duration: 100,
        description: 'Test description',
        upload_date: '20240101',
        channel_id: 'channel-1'
      }));
      fsPromises.access.mockResolvedValue();
      fsPromises.stat.mockResolvedValue({ size: 12345 });

      Job.findOne.mockResolvedValue({ id: 'job-1' });
      Job.update = jest.fn().mockResolvedValue([1]);
      Video.findOne.mockResolvedValue(null);

      jobRegistry.replaceAll({
        'job-1': { status: 'In Progress', id: 'job-1' },
        'job-2': { status: 'Pending', id: 'job-2', jobType: 'Channel Downloads' },
        'job-3': { status: 'In Progress', id: 'job-3' },
        'job-4': { status: 'Complete', id: 'job-4' }
      });

      await jobRecovery.terminateInProgressJobs();

      expect(jobRegistry.jobs['job-1'].status).toBe('Terminated');
      expect(jobRegistry.jobs['job-1'].output).toContain('1 video completed');
      // Pending jobs are now also terminated on startup
      expect(jobRegistry.jobs['job-2'].status).toBe('Terminated');
      expect(jobRegistry.jobs['job-3'].status).toBe('Terminated');
      expect(jobRegistry.jobs['job-4'].status).toBe('Complete');
      expect(Job.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'Terminated',
          output: expect.stringContaining('completed')
        }),
        expect.any(Object)
      );
      expect(JobVideoDownload.destroy).toHaveBeenCalled();
    });

    test('should cleanup in-progress videos from disk', async () => {

      JobVideoDownload.findAll.mockResolvedValue([]);
      JobVideoDownload.destroy.mockResolvedValue(0);

      // Reset and reconfigure the downloadCleanup mock for this specific test
      const mockCleanup = jest.fn().mockResolvedValue();
      jest.resetModules();
      jest.doMock('../../download/downloadCleanup', () => ({
        cleanupInProgressVideos: mockCleanup
      }));

      jobRegistry = require('../jobRegistry');
      jobRecovery = require('../jobRecovery');

      jobRegistry.replaceAll({
        'job-1': { status: 'In Progress', id: 'job-1' }
      });

      await jobRecovery.terminateInProgressJobs();

      expect(mockCleanup).toHaveBeenCalledWith('job-1');
    });

    test('should handle jobs with no completed videos', async () => {

      JobVideoDownload.findAll.mockResolvedValue([]);
      JobVideoDownload.destroy.mockResolvedValue(0);

      jobRegistry = require('../jobRegistry');
      jobRecovery = require('../jobRecovery');

      jobRegistry.replaceAll({
        'job-1': { status: 'In Progress', id: 'job-1' }
      });

      await jobRecovery.terminateInProgressJobs();

      expect(jobRegistry.jobs['job-1'].status).toBe('Terminated');
      expect(jobRegistry.jobs['job-1'].output).toBe('Job terminated due to server restart');
    });

    test('should handle recovery errors gracefully', async () => {

      JobVideoDownload.findAll.mockRejectedValue(new Error('DB Error'));


      jobRegistry = require('../jobRegistry');
      jobRecovery = require('../jobRecovery');

      jobRegistry.replaceAll({
        'job-1': { status: 'In Progress', id: 'job-1' }
      });

      await jobRecovery.terminateInProgressJobs();

      expect(jobRegistry.jobs['job-1'].status).toBe('Terminated');
      expect(logger.error).toHaveBeenCalled();

    });

    test('should terminate all Pending jobs on startup', async () => {

      JobVideoDownload.findAll.mockResolvedValue([]);
      JobVideoDownload.destroy.mockResolvedValue(0);

      jobRegistry = require('../jobRegistry');
      jobRecovery = require('../jobRecovery');

      jobRegistry.replaceAll({
        'job-1': { status: 'In Progress', id: 'job-1', jobType: 'Channel Downloads' },
        'job-2': { status: 'Pending', id: 'job-2', jobType: 'Manually Added Urls' },
        'job-3': { status: 'Pending', id: 'job-3', jobType: 'Channel Downloads' },
        'job-4': { status: 'Complete', id: 'job-4', jobType: 'Channel Downloads' }
      });

      await jobRecovery.terminateInProgressJobs();

      // In Progress jobs should be terminated
      expect(jobRegistry.jobs['job-1'].status).toBe('Terminated');
      // Pending jobs should also be terminated
      expect(jobRegistry.jobs['job-2'].status).toBe('Terminated');
      expect(jobRegistry.jobs['job-2'].output).toBe('Job terminated during server restart');
      expect(jobRegistry.jobs['job-3'].status).toBe('Terminated');
      expect(jobRegistry.jobs['job-3'].output).toBe('Job terminated during server restart');
      // Complete jobs should remain unchanged
      expect(jobRegistry.jobs['job-4'].status).toBe('Complete');

      // Verify DB updates were called for both Pending jobs
      expect(Job.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'Terminated',
          output: 'Job terminated during server restart'
        }),
        expect.objectContaining({ where: { id: 'job-2' } })
      );
      expect(Job.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'Terminated',
          output: 'Job terminated during server restart'
        }),
        expect.objectContaining({ where: { id: 'job-3' } })
      );
    });

    test('should handle DB update errors for Pending jobs gracefully', async () => {

      JobVideoDownload.findAll.mockResolvedValue([]);
      Job.update.mockRejectedValue(new Error('DB Update Error'));

      jobRegistry = require('../jobRegistry');
      jobRecovery = require('../jobRecovery');

      jobRegistry.replaceAll({
        'job-1': { status: 'Pending', id: 'job-1', jobType: 'Channel Downloads' }
      });

      await jobRecovery.terminateInProgressJobs();

      // Job should still be terminated in memory
      expect(jobRegistry.jobs['job-1'].status).toBe('Terminated');
      // Error should be logged
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('recoverCompletedVideos', () => {
    let JobVideoDownload;

    beforeEach(() => {
      jobRegistry = require('../jobRegistry');
      jobRecovery = require('../jobRecovery');
      JobVideoDownload = require('../../../models/jobvideodownload');
    });

    test('should recover completed videos from info.json files', async () => {
      const mockCompletedDownloads = [
        { job_id: 'job-1', youtube_id: 'video-1', status: 'completed' },
        { job_id: 'job-1', youtube_id: 'video-2', status: 'completed' }
      ];

      JobVideoDownload.findAll.mockResolvedValue(mockCompletedDownloads);

      fsPromises.readFile.mockImplementation(async (filePath) => {
        if (filePath.includes('video-1')) {
          return JSON.stringify({
            id: 'video-1',
            uploader: 'Channel 1',
            title: 'Video 1',
            duration: 100,
            description: 'Test',
            upload_date: '20240101',
            channel_id: 'channel-1',
            _actual_filepath: '/test/output/Channel 1/Channel 1 - Video 1 - video-1/Channel 1 - Video 1  [video-1].mp4'
          });
        }
        if (filePath.includes('video-2')) {
          return JSON.stringify({
            id: 'video-2',
            uploader: 'Channel 1',
            title: 'Video 2',
            duration: 200,
            description: 'Test',
            upload_date: '20240102',
            channel_id: 'channel-1',
            _actual_filepath: '/test/output/Channel 1/Channel 1 - Video 2 - video-2/Channel 1 - Video 2  [video-2].mp4'
          });
        }
        throw new Error('File not found');
      });

      fsPromises.access.mockResolvedValue();
      fsPromises.stat.mockResolvedValue({ size: 12345 });
      Job.findOne.mockResolvedValue({ id: 'job-1' });
      Video.findOne.mockResolvedValue(null);

      const count = await jobRecovery.recoverCompletedVideos('job-1');

      expect(count).toBe(2);
      expect(Video.create).toHaveBeenCalledTimes(2);
      expect(JobVideo.create).toHaveBeenCalledTimes(2);
    });

    test('uses _actual_filepath from info.json when available', async () => {
      const actualPath = '/data/Channel/Test Channel - Actual Video - video-1/Test Channel - Actual Video  [video-1].mkv';
      JobVideoDownload.findAll.mockResolvedValue([
        { job_id: 'job-1', youtube_id: 'video-1', status: 'completed' }
      ]);

      fsPromises.readFile.mockResolvedValue(JSON.stringify({
        id: 'video-1',
        uploader: 'Test Channel',
        title: 'Actual Video',
        duration: 321,
        description: 'Test description',
        upload_date: '20240103',
        channel_id: 'channel-1',
        _actual_filepath: actualPath
      }));

      fsPromises.access.mockResolvedValue();
      fsPromises.stat.mockImplementation(async (filePath) => {
        expect(filePath).toBe(actualPath);
        return { size: 98765 };
      });

      Job.findOne.mockResolvedValue({ id: 'job-1' });
      Video.findOne.mockResolvedValue(null);

      await jobRecovery.recoverCompletedVideos('job-1');

      expect(Video.create).toHaveBeenCalledWith(expect.objectContaining({
        youtubeId: 'video-1',
        filePath: actualPath,
        fileSize: '98765',
        removed: false,
        removed_reason: null,
        removed_at: null,
        removed_detail: null
      }));
    });

    test('should return 0 when no completed videos found', async () => {
      JobVideoDownload.findAll.mockResolvedValue([]);

      const count = await jobRecovery.recoverCompletedVideos('job-1');

      expect(count).toBe(0);
      expect(Video.create).not.toHaveBeenCalled();
    });

    test('leaves the removal columns alone when the recovered file is not found', async () => {
      JobVideoDownload.findAll.mockResolvedValue([
        { job_id: 'job-1', youtube_id: 'video-1', status: 'completed' }
      ]);
      fsPromises.readFile.mockResolvedValue(JSON.stringify({
        id: 'video-1',
        uploader: 'Channel 1',
        title: 'Video 1',
        duration: 100,
        upload_date: '20240101',
        channel_id: 'channel-1',
        _actual_filepath: '/data/Channel 1/Channel 1 - Video 1 - video-1/Channel 1 - Video 1  [video-1].mp4'
      }));
      fsPromises.access.mockResolvedValue();
      fsPromises.stat.mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
      Job.findOne.mockResolvedValue({ id: 'job-1' });
      Video.findOne.mockResolvedValue(null);

      await jobRecovery.recoverCompletedVideos('job-1');

      expect(Video.create).toHaveBeenCalledTimes(1);
      const created = Video.create.mock.calls[0][0];
      expect(created.fileSize).toBeNull();
      expect(created).not.toHaveProperty('removed');
      expect(created).not.toHaveProperty('removed_reason');
    });

    test('should skip videos with missing info.json files', async () => {

      JobVideoDownload.findAll.mockResolvedValue([
        { job_id: 'job-1', youtube_id: 'video-1', status: 'completed' }
      ]);

      fsPromises.access.mockRejectedValue(new Error('ENOENT'));

      const count = await jobRecovery.recoverCompletedVideos('job-1');

      expect(count).toBe(0);
      expect(logger.warn).toHaveBeenCalled();

    });

    test('should handle videos that already exist in database and create JobVideo relationship', async () => {
      JobVideoDownload.findAll.mockResolvedValue([
        { job_id: 'job-1', youtube_id: 'video-1', status: 'completed' }
      ]);

      fsPromises.readFile.mockResolvedValue(JSON.stringify({
        id: 'video-1',
        uploader: 'Channel 1',
        title: 'Video 1',
        duration: 100,
        upload_date: '20240101',
        channel_id: 'channel-1',
        _actual_filepath: '/test/output/Channel 1/Channel 1 - Video 1 - video-1/Channel 1 - Video 1  [video-1].mp4'
      }));
      fsPromises.access.mockResolvedValue();
      fsPromises.stat.mockResolvedValue({ size: 12345 });

      const mockVideoInstance = {
        id: 'video-1',
        youtubeId: 'video-1',
        update: jest.fn().mockResolvedValue()
      };
      Job.findOne.mockResolvedValue({ id: 'job-1' });
      Video.findOne.mockResolvedValue(mockVideoInstance);
      JobVideo.findOne.mockResolvedValue(null); // No existing JobVideo relationship

      const count = await jobRecovery.recoverCompletedVideos('job-1');

      expect(count).toBe(1);
      expect(Video.create).not.toHaveBeenCalled();
      expect(mockVideoInstance.update).toHaveBeenCalled();
      // Should create JobVideo relationship for existing video during recovery
      expect(JobVideo.create).toHaveBeenCalledWith({
        job_id: 'job-1',
        video_id: 'video-1'
      });
    });

    test('should not create duplicate JobVideo relationships', async () => {
      JobVideoDownload.findAll.mockResolvedValue([
        { job_id: 'job-1', youtube_id: 'video-1', status: 'completed' }
      ]);

      fsPromises.readFile.mockResolvedValue(JSON.stringify({
        id: 'video-1',
        uploader: 'Channel 1',
        title: 'Video 1',
        duration: 100,
        upload_date: '20240101',
        channel_id: 'channel-1'
      }));
      fsPromises.access.mockResolvedValue();
      fsPromises.stat.mockResolvedValue({ size: 12345 });

      const mockVideoInstance = {
        id: 'video-1',
        youtubeId: 'video-1',
        update: jest.fn().mockResolvedValue()
      };
      const mockJobVideoInstance = { job_id: 'job-1', video_id: 'video-1' };

      Job.findOne.mockResolvedValue({ id: 'job-1' });
      Video.findOne.mockResolvedValue(mockVideoInstance);
      JobVideo.findOne.mockResolvedValue(mockJobVideoInstance); // JobVideo already exists

      const count = await jobRecovery.recoverCompletedVideos('job-1');

      expect(count).toBe(1);
      expect(Video.create).not.toHaveBeenCalled();
      expect(mockVideoInstance.update).toHaveBeenCalled();
      // Should NOT create duplicate JobVideo relationship
      expect(JobVideo.create).not.toHaveBeenCalled();
    });

    test('should try alternative file extensions when video not found', async () => {
      JobVideoDownload.findAll.mockResolvedValue([
        { job_id: 'job-1', youtube_id: 'video-1', status: 'completed' }
      ]);

      fsPromises.readFile.mockResolvedValue(JSON.stringify({
        id: 'video-1',
        uploader: 'Channel 1',
        title: 'Video 1',
        duration: 100,
        upload_date: '20240101',
        channel_id: 'channel-1'
      }));
      fsPromises.access.mockResolvedValue();

      // Fail for .mp4, succeed for .webm
      fsPromises.stat.mockImplementation(async (path) => {
        if (path.includes('.mp4')) {
          throw new Error('ENOENT');
        }
        if (path.includes('.webm')) {
          return { size: 67890 };
        }
        throw new Error('ENOENT');
      });

      Job.findOne.mockResolvedValue({ id: 'job-1' });
      Video.findOne.mockResolvedValue(null);

      const count = await jobRecovery.recoverCompletedVideos('job-1');

      expect(count).toBe(1);
      expect(Video.create).toHaveBeenCalledWith(
        expect.objectContaining({
          filePath: expect.stringContaining('.webm'),
          fileSize: '67890'
        })
      );
    });

    test('should handle errors for individual videos gracefully', async () => {

      JobVideoDownload.findAll.mockResolvedValue([
        { job_id: 'job-1', youtube_id: 'video-1', status: 'completed' },
        { job_id: 'job-1', youtube_id: 'video-2', status: 'completed' }
      ]);

      fsPromises.access.mockResolvedValue();
      fsPromises.readFile.mockImplementation(async (path) => {
        if (path.includes('video-1')) {
          throw new Error('Parse error');
        }
        if (path.includes('video-2')) {
          return JSON.stringify({
            id: 'video-2',
            uploader: 'Channel 1',
            title: 'Video 2',
            duration: 200,
            upload_date: '20240102',
            channel_id: 'channel-1'
          });
        }
        throw new Error('File not found');
      });
      fsPromises.stat.mockResolvedValue({ size: 12345 });

      Job.findOne.mockResolvedValue({ id: 'job-1' });
      Video.findOne.mockResolvedValue(null);

      const count = await jobRecovery.recoverCompletedVideos('job-1');

      // Should still recover video-2 even though video-1 failed
      expect(count).toBe(1);
      expect(logger.error).toHaveBeenCalled();

    });
  });

  describe('restart recovery edge cases', () => {
    let JobVideoDownload;

    beforeEach(() => {
      JobVideoDownload = require('../../../models/jobvideodownload');
      jobRegistry = require('../jobRegistry');
      jobRecovery = require('../jobRecovery');
    });

    test('still marks the job Terminated when clearing its tracking rows fails', async () => {
      jobRegistry.replaceAll({ 'job-1': { status: 'In Progress', jobType: 'Channel Downloads' } });
      JobVideoDownload.destroy.mockRejectedValue(new Error('db down'));

      await jobRecovery.terminateInProgressJobs();

      expect(jobRegistry.jobs['job-1'].status).toBe('Terminated');
      expect(Job.update).toHaveBeenCalledWith(
        { status: 'Terminated', output: 'Job terminated due to server restart' },
        { where: { id: 'job-1' } }
      );
    });

    test('loads the videos still linked to an interrupted job into memory', async () => {
      const JobVideo = require('../../../models/jobvideo');
      const Video = require('../../../models/video');
      jobRegistry.replaceAll({ 'job-1': { status: 'In Progress', jobType: 'Channel Downloads' } });
      JobVideo.findAll.mockResolvedValue([{ job_id: 'job-1', video_id: 4 }]);
      Video.findAll.mockResolvedValue([{ id: 4, dataValues: { id: 4, youtubeId: 'kept' } }]);

      await jobRecovery.terminateInProgressJobs();

      expect(jobRegistry.jobs['job-1'].data.videos).toEqual([{ id: 4, youtubeId: 'kept' }]);
    });

    test('leaves finished jobs untouched', async () => {
      jobRegistry.replaceAll({ 'job-1': { status: 'Complete', output: '2 videos.' } });

      await jobRecovery.terminateInProgressJobs();

      expect(jobRegistry.jobs['job-1']).toEqual({ status: 'Complete', output: '2 videos.' });
      expect(Job.update).not.toHaveBeenCalled();
    });
  });
});
