/* eslint-env jest */

// Mock dependencies
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'generated-uuid')
}));
jest.mock('node-cron');
jest.mock('../messageEmitter.js');
jest.mock('../configModule');
jest.mock('../../models/job');
jest.mock('../../models/video');
jest.mock('../../models/jobvideo');
jest.mock('../../models/jobvideodownload');
jest.mock('../../models/channelvideo');
jest.mock('../download/downloadExecutor', () => {
  return jest.fn().mockImplementation(() => ({
    cleanupInProgressVideos: jest.fn().mockResolvedValue()
  }));
});
jest.mock('../../logger');

const { v4: uuidv4 } = require('uuid');

describe('JobModule', () => {
  let JobModule;
  let fs;
  let fsPromises;
  let cron;
  let MessageEmitter;
  let Job;
  let Video;
  let JobVideo;
  let ChannelVideo;
  let logger;
  let originalDisableInitialBackfill;

  const mockJobsDir = '/test/jobs';
  const mockJobsFilePath = '/test/jobs/jobs.json';
  const mockJobsFilePathOld = '/test/jobs/jobs.json.old';

  const mockJobData = {
    id: 'test-job-id',
    status: 'Pending',
    jobType: 'download',
    timeCreated: Date.now(),
    timeInitiated: Date.now(),
    data: {
      videos: [
        {
          youtubeId: 'test-video-1',
          youTubeChannelName: 'Test Channel',
          youTubeVideoName: 'Test Video',
          duration: 300,
          description: 'Test description',
          originalDate: '20240101',
          channel_id: 'test-channel-id'
        }
      ]
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    originalDisableInitialBackfill = process.env.JOBMODULE_DISABLE_INITIAL_BACKFILL;
    process.env.JOBMODULE_DISABLE_INITIAL_BACKFILL = 'true';

    // Reset uuid mock
    uuidv4.mockClear();
    uuidv4.mockReturnValue('generated-uuid');

    // Mock fs
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

    // Mock node-cron
    cron = require('node-cron');
    cron.schedule = jest.fn();

    // Mock MessageEmitter
    MessageEmitter = require('../messageEmitter.js');
    MessageEmitter.emitMessage = jest.fn();

    // Get logger mock
    logger = require('../../logger');

    // Mock configModule before it's required by jobModule
    jest.doMock('../configModule', () => ({
      getJobsPath: jest.fn().mockReturnValue(mockJobsDir),
      directoryPath: '/test/output'
    }));

    // Mock Sequelize models
    Job = require('../../models/job');
    Video = require('../../models/video');
    JobVideo = require('../../models/jobvideo');
    const JobVideoDownload = require('../../models/jobvideodownload');
    ChannelVideo = require('../../models/channelvideo');

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

  afterEach(() => {
    jest.clearAllMocks();
    if (originalDisableInitialBackfill === undefined) {
      delete process.env.JOBMODULE_DISABLE_INITIAL_BACKFILL;
    } else {
      process.env.JOBMODULE_DISABLE_INITIAL_BACKFILL = originalDisableInitialBackfill;
    }
  });

  describe('constructor', () => {
    test('should create jobs directory if it does not exist', () => {
      fs.existsSync.mockImplementation(path => {
        if (path === mockJobsDir) return false;
        if (path === mockJobsFilePath) return false;
        return true;
      });
      fs.readFileSync.mockReturnValue(JSON.stringify({
        plexApiKey: 'test-key',
        youtubeOutputDirectory: '/test/output'
      }));

      JobModule = require('../jobModule');

      expect(fs.mkdirSync).toHaveBeenCalledWith(mockJobsDir, { recursive: true });
      expect(JobModule.jobsDir).toBe(mockJobsDir);
      expect(JobModule.jobsFilePath).toBe(mockJobsFilePath);
      expect(JobModule.jobs).toEqual({});
    });

    test('should migrate jobs from file if jobs.json exists', async () => {
      const mockJobs = {
        'job-1': {
          ...mockJobData,
          id: 'job-1',
          status: 'Complete'
        }
      };

      fs.existsSync.mockImplementation(path => {
        if (path === mockJobsDir) return true;
        if (path === mockJobsFilePath) return true;
        return false;
      });
      fs.readFileSync.mockImplementation(path => {
        if (path === mockJobsFilePath) {
          return JSON.stringify(mockJobs);
        }
        // Return config for configModule
        return JSON.stringify({
          plexApiKey: 'test-key',
          youtubeOutputDirectory: '/test/output'
        });
      });

      JobModule = require('../jobModule');

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(fs.renameSync).toHaveBeenCalledWith(mockJobsFilePath, mockJobsFilePathOld);
      expect(Job.create).toHaveBeenCalled();
    });

    test('should load jobs from DB when no jobs.json exists', async () => {
      fs.existsSync.mockImplementation(path => {
        if (path === mockJobsDir) return true;
        if (path === mockJobsFilePath) return false;
        return true;
      });
      fs.readFileSync.mockReturnValue(JSON.stringify({
        plexApiKey: 'test-key',
        youtubeOutputDirectory: '/test/output'
      }));

      const mockDbJobs = [
        { id: 'db-job-1', status: 'Complete', dataValues: { id: 'db-job-1', status: 'Complete' } }
      ];
      Job.findAll.mockResolvedValue(mockDbJobs);

      JobModule = require('../jobModule');

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(Job.findAll).toHaveBeenCalled();
      expect(JobModule.jobs['db-job-1']).toBeDefined();
    });

    test('should schedule daily backfill', () => {
      fs.existsSync.mockReturnValue(false);
      fs.readFileSync.mockReturnValue(JSON.stringify({
        plexApiKey: 'test-key',
        youtubeOutputDirectory: '/test/output'
      }));

      JobModule = require('../jobModule');

      expect(cron.schedule).toHaveBeenCalledWith('20 2 * * *', expect.any(Function));
    });

    test('should attempt initial backfill after timeout', async () => {
      fs.existsSync.mockReturnValue(false);
      fs.readFileSync.mockReturnValue(JSON.stringify({
        plexApiKey: 'test-key',
        youtubeOutputDirectory: '/test/output'
      }));
      fsPromises.readFile.mockRejectedValue({ code: 'ENOENT' });

      process.env.JOBMODULE_DISABLE_INITIAL_BACKFILL = 'false';

      JobModule = require('../jobModule');

      // Wait for setTimeout to execute
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(logger.info).toHaveBeenCalledWith('No complete.list found for backfill. Skipping.');
    });
  });

  describe('terminateInProgressJobs', () => {
    let JobVideoDownload;

    beforeEach(() => {
      JobVideoDownload = require('../../models/jobvideodownload');
    });

    test('should change In Progress jobs to Terminated and recover completed videos', async () => {
      fs.existsSync.mockReturnValue(false);
      fs.readFileSync.mockReturnValue(JSON.stringify({
        plexApiKey: 'test-key',
        youtubeOutputDirectory: '/test/output'
      }));

      JobModule = require('../jobModule');

      // Set jobs after requiring the module to avoid async initialization clearing them
      await new Promise(resolve => setTimeout(resolve, 10));

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

      JobModule.jobs = {
        'job-1': { status: 'In Progress', id: 'job-1' },
        'job-2': { status: 'Pending', id: 'job-2', jobType: 'Channel Downloads' },
        'job-3': { status: 'In Progress', id: 'job-3' },
        'job-4': { status: 'Complete', id: 'job-4' }
      };

      await JobModule.terminateInProgressJobs();

      expect(JobModule.jobs['job-1'].status).toBe('Terminated');
      expect(JobModule.jobs['job-1'].output).toContain('1 video completed');
      // Pending jobs are now also terminated on startup
      expect(JobModule.jobs['job-2'].status).toBe('Terminated');
      expect(JobModule.jobs['job-3'].status).toBe('Terminated');
      expect(JobModule.jobs['job-4'].status).toBe('Complete');
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
      fs.existsSync.mockReturnValue(false);
      fs.readFileSync.mockReturnValue(JSON.stringify({
        plexApiKey: 'test-key',
        youtubeOutputDirectory: '/test/output'
      }));

      JobVideoDownload.findAll.mockResolvedValue([]);
      JobVideoDownload.destroy.mockResolvedValue(0);

      // Reset and reconfigure the DownloadExecutor mock for this specific test
      const mockCleanup = jest.fn().mockResolvedValue();
      jest.resetModules();
      jest.doMock('../download/downloadExecutor', () => {
        return jest.fn().mockImplementation(() => ({
          cleanupInProgressVideos: mockCleanup
        }));
      });

      JobModule = require('../jobModule');

      await new Promise(resolve => setTimeout(resolve, 10));

      JobModule.jobs = {
        'job-1': { status: 'In Progress', id: 'job-1' }
      };

      await JobModule.terminateInProgressJobs();

      expect(mockCleanup).toHaveBeenCalledWith('job-1');
    });

    test('should handle jobs with no completed videos', async () => {
      fs.existsSync.mockReturnValue(false);
      fs.readFileSync.mockReturnValue(JSON.stringify({
        plexApiKey: 'test-key',
        youtubeOutputDirectory: '/test/output'
      }));

      JobVideoDownload.findAll.mockResolvedValue([]);
      JobVideoDownload.destroy.mockResolvedValue(0);

      JobModule = require('../jobModule');

      await new Promise(resolve => setTimeout(resolve, 10));

      JobModule.jobs = {
        'job-1': { status: 'In Progress', id: 'job-1' }
      };

      await JobModule.terminateInProgressJobs();

      expect(JobModule.jobs['job-1'].status).toBe('Terminated');
      expect(JobModule.jobs['job-1'].output).toBe('Job terminated due to server restart');
    });

    test('should handle recovery errors gracefully', async () => {
      fs.existsSync.mockReturnValue(false);
      fs.readFileSync.mockReturnValue(JSON.stringify({
        plexApiKey: 'test-key',
        youtubeOutputDirectory: '/test/output'
      }));

      JobVideoDownload.findAll.mockRejectedValue(new Error('DB Error'));


      JobModule = require('../jobModule');

      await new Promise(resolve => setTimeout(resolve, 10));

      JobModule.jobs = {
        'job-1': { status: 'In Progress', id: 'job-1' }
      };

      await JobModule.terminateInProgressJobs();

      expect(JobModule.jobs['job-1'].status).toBe('Terminated');
      expect(logger.error).toHaveBeenCalled();

    });

    test('should terminate all Pending jobs on startup', async () => {
      fs.existsSync.mockReturnValue(false);
      fs.readFileSync.mockReturnValue(JSON.stringify({
        plexApiKey: 'test-key',
        youtubeOutputDirectory: '/test/output'
      }));

      JobVideoDownload.findAll.mockResolvedValue([]);
      JobVideoDownload.destroy.mockResolvedValue(0);

      JobModule = require('../jobModule');

      await new Promise(resolve => setTimeout(resolve, 10));

      JobModule.jobs = {
        'job-1': { status: 'In Progress', id: 'job-1', jobType: 'Channel Downloads' },
        'job-2': { status: 'Pending', id: 'job-2', jobType: 'Manually Added Urls' },
        'job-3': { status: 'Pending', id: 'job-3', jobType: 'Channel Downloads' },
        'job-4': { status: 'Complete', id: 'job-4', jobType: 'Channel Downloads' }
      };

      await JobModule.terminateInProgressJobs();

      // In Progress jobs should be terminated
      expect(JobModule.jobs['job-1'].status).toBe('Terminated');
      // Pending jobs should also be terminated
      expect(JobModule.jobs['job-2'].status).toBe('Terminated');
      expect(JobModule.jobs['job-2'].output).toBe('Job terminated during server restart');
      expect(JobModule.jobs['job-3'].status).toBe('Terminated');
      expect(JobModule.jobs['job-3'].output).toBe('Job terminated during server restart');
      // Complete jobs should remain unchanged
      expect(JobModule.jobs['job-4'].status).toBe('Complete');

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
      fs.existsSync.mockReturnValue(false);
      fs.readFileSync.mockReturnValue(JSON.stringify({
        plexApiKey: 'test-key',
        youtubeOutputDirectory: '/test/output'
      }));

      JobVideoDownload.findAll.mockResolvedValue([]);
      Job.update.mockRejectedValue(new Error('DB Update Error'));

      JobModule = require('../jobModule');

      await new Promise(resolve => setTimeout(resolve, 10));

      JobModule.jobs = {
        'job-1': { status: 'Pending', id: 'job-1', jobType: 'Channel Downloads' }
      };

      await JobModule.terminateInProgressJobs();

      // Job should still be terminated in memory
      expect(JobModule.jobs['job-1'].status).toBe('Terminated');
      // Error should be logged
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('recoverCompletedVideos', () => {
    let JobVideoDownload;

    beforeEach(() => {
      fs.existsSync.mockReturnValue(false);
      fs.readFileSync.mockReturnValue(JSON.stringify({
        plexApiKey: 'test-key',
        youtubeOutputDirectory: '/test/output'
      }));
      JobModule = require('../jobModule');
      JobVideoDownload = require('../../models/jobvideodownload');
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

      const count = await JobModule.recoverCompletedVideos('job-1');

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

      await JobModule.recoverCompletedVideos('job-1');

      expect(Video.create).toHaveBeenCalledWith(expect.objectContaining({
        youtubeId: 'video-1',
        filePath: actualPath,
        fileSize: '98765'
      }));
    });

    test('should return 0 when no completed videos found', async () => {
      JobVideoDownload.findAll.mockResolvedValue([]);

      const count = await JobModule.recoverCompletedVideos('job-1');

      expect(count).toBe(0);
      expect(Video.create).not.toHaveBeenCalled();
    });

    test('should skip videos with missing info.json files', async () => {
      
      JobVideoDownload.findAll.mockResolvedValue([
        { job_id: 'job-1', youtube_id: 'video-1', status: 'completed' }
      ]);

      fsPromises.access.mockRejectedValue(new Error('ENOENT'));

      const count = await JobModule.recoverCompletedVideos('job-1');

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

      const count = await JobModule.recoverCompletedVideos('job-1');

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

      const count = await JobModule.recoverCompletedVideos('job-1');

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

      const count = await JobModule.recoverCompletedVideos('job-1');

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

      const count = await JobModule.recoverCompletedVideos('job-1');

      // Should still recover video-2 even though video-1 failed
      expect(count).toBe(1);
      expect(logger.error).toHaveBeenCalled();

    });
  });

  describe('getInProgressJobId', () => {
    beforeEach(() => {
      fs.existsSync.mockReturnValue(false);
      fs.readFileSync.mockReturnValue(JSON.stringify({
        plexApiKey: 'test-key',
        youtubeOutputDirectory: '/test/output'
      }));
      JobModule = require('../jobModule');
    });

    test('should return ID of In Progress job', () => {
      JobModule.jobs = {
        'job-1': { status: 'Complete' },
        'job-2': { status: 'In Progress' },
        'job-3': { status: 'Pending' }
      };

      const result = JobModule.getInProgressJobId();
      expect(result).toBe('job-2');
    });

    test('should return null if no In Progress job', () => {
      JobModule.jobs = {
        'job-1': { status: 'Complete' },
        'job-2': { status: 'Pending' }
      };

      const result = JobModule.getInProgressJobId();
      expect(result).toBeNull();
    });
  });

  describe('startNextJob', () => {
    beforeEach(() => {
      fs.existsSync.mockReturnValue(false);
      fs.readFileSync.mockReturnValue(JSON.stringify({
        plexApiKey: 'test-key',
        youtubeOutputDirectory: '/test/output'
      }));
      JobModule = require('../jobModule');
    });

    test('should invoke action for first pending job', () => {
      const mockAction = jest.fn();
      JobModule.jobs = {
        'job-1': { status: 'Complete' },
        'job-2': { status: 'Pending', action: mockAction },
        'job-3': { status: 'Pending' }
      };

      JobModule.startNextJob();

      expect(logger.info).toHaveBeenCalledWith('Looking for next job to start');
      expect(mockAction).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'job-2', status: 'Pending' }),
        true
      );

    });

    test('should do nothing if no pending jobs', () => {
      JobModule.jobs = {
        'job-1': { status: 'Complete' },
        'job-2': { status: 'In Progress' }
      };

      JobModule.startNextJob();

      expect(logger.info).toHaveBeenCalledWith('Looking for next job to start');

    });

    test('should terminate job with missing action function and try next job', () => {
      const mockAction = jest.fn();
      const mockUpdateJob = jest.fn();

      // Save original method
      const originalUpdateJob = JobModule.updateJob;
      const originalStartNextJob = JobModule.startNextJob;

      // Mock updateJob to track calls
      JobModule.updateJob = mockUpdateJob;

      // Create a call counter to prevent infinite recursion
      let startNextCallCount = 0;
      JobModule.startNextJob = function() {
        startNextCallCount++;
        if (startNextCallCount > 2) return; // Prevent infinite recursion
        originalStartNextJob.call(this);
      };

      JobModule.jobs = {
        'job-1': { status: 'Complete' },
        'job-2': { status: 'Pending', jobType: 'Manually Added Urls' }, // No action function
        'job-3': { status: 'Pending', action: mockAction, jobType: 'Channel Downloads' }
      };

      JobModule.startNextJob();

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ jobId: 'job-2', jobType: 'Manually Added Urls' }),
        'Cannot start pending job - missing action function, marking as Terminated'
      );
      expect(mockUpdateJob).toHaveBeenCalledWith('job-2', {
        status: 'Terminated',
        output: 'Job could not be started after server restart',
      });
      // Should recursively call startNextJob to try the next pending job
      expect(startNextCallCount).toBeGreaterThan(1);

      // Restore original methods
      JobModule.updateJob = originalUpdateJob;
      JobModule.startNextJob = originalStartNextJob;
    });

    test('should not invoke action if job has no action function', () => {
      JobModule.updateJob = jest.fn();

      JobModule.jobs = {
        'job-1': { status: 'Pending', jobType: 'Channel Downloads' } // No action
      };

      // Need to actually test the real startNextJob implementation
      const RealJobModule = require('../jobModule');
      RealJobModule.jobs = JobModule.jobs;
      RealJobModule.updateJob = JobModule.updateJob;
      // Mock startNextJob to prevent infinite recursion
      const originalStartNext = RealJobModule.startNextJob.bind(RealJobModule);
      let callCount = 0;
      RealJobModule.startNextJob = function() {
        callCount++;
        if (callCount === 1) {
          originalStartNext();
        }
      };

      RealJobModule.startNextJob();

      expect(JobModule.updateJob).toHaveBeenCalledWith('job-1', {
        status: 'Terminated',
        output: 'Job could not be started after server restart',
      });
    });
  });

  describe('addOrUpdateJob', () => {
    beforeEach(() => {
      fs.existsSync.mockReturnValue(false);
      fs.readFileSync.mockReturnValue(JSON.stringify({
        plexApiKey: 'test-key',
        youtubeOutputDirectory: '/test/output'
      }));
      JobModule = require('../jobModule');
      JobModule.addJob = jest.fn().mockResolvedValue('new-job-id');
      JobModule.updateJob = jest.fn();
    });

    test('should add pending job when job in progress exists', async () => {
      JobModule.jobs = {
        'existing-job': { status: 'In Progress' }
      };

      const jobData = { jobType: 'download' };
      const result = await JobModule.addOrUpdateJob(jobData);

      expect(JobModule.addJob).toHaveBeenCalledWith(
        expect.objectContaining({ jobType: 'download', status: 'Pending' })
      );
      expect(result).toBe('new-job-id');
    });

    test('should add in progress job when no job in progress', async () => {
      JobModule.jobs = {};

      const jobData = { jobType: 'download' };
      const result = await JobModule.addOrUpdateJob(jobData);

      expect(JobModule.addJob).toHaveBeenCalledWith(
        expect.objectContaining({ jobType: 'download', status: 'In Progress' })
      );
      expect(result).toBe('new-job-id');
    });

    test('should update next job to in progress when appropriate', async () => {
      JobModule.jobs = {};

      const jobData = { id: 'next-job', jobType: 'download' };
      const result = await JobModule.addOrUpdateJob(jobData, true);

      expect(JobModule.updateJob).toHaveBeenCalledWith('next-job', {
        status: 'In Progress',
        timeInitiated: expect.any(Number)
      });
      expect(result).toBe('next-job');
    });

    test('should not start next job if job already in progress', async () => {
      JobModule.jobs = {
        'existing-job': { status: 'In Progress' }
      };

      const jobData = { id: 'next-job', jobType: 'download' };
      const result = await JobModule.addOrUpdateJob(jobData, true);

      expect(logger.warn).toHaveBeenCalled();
      expect(result).toBeUndefined();

    });
  });

  describe('addJob', () => {
    beforeEach(() => {
      fs.existsSync.mockReturnValue(false);
      fs.readFileSync.mockReturnValue(JSON.stringify({
        plexApiKey: 'test-key',
        youtubeOutputDirectory: '/test/output'
      }));
      JobModule = require('../jobModule');
      JobModule.saveJobs = jest.fn().mockResolvedValue();
    });

    test('should create new job with generated UUID', async () => {
      const jobData = { jobType: 'download' };
      const result = await JobModule.addJob(jobData);

      // The uuidv4 mock returns 'generated-uuid'
      expect(result).toBe('generated-uuid');
      expect(JobModule.jobs['generated-uuid']).toMatchObject({
        id: 'generated-uuid',
        jobType: 'download',
        timeInitiated: expect.any(Number),
        timeCreated: expect.any(Number)
      });
      expect(Job.create).toHaveBeenCalledWith({
        id: 'generated-uuid',
        jobType: 'download',
        status: undefined,
        output: '',
        timeInitiated: expect.any(Number),
        timeCreated: expect.any(Number)
      });
    });

    test('should handle save errors', async () => {
      Job.create.mockRejectedValue(new Error('Save failed'));
      
      const jobData = { jobType: 'download' };
      await expect(JobModule.addJob(jobData)).rejects.toThrow('Save failed');

      expect(logger.error).toHaveBeenCalled();

    });
  });

  describe('updateJob', () => {
    beforeEach(() => {
      fs.existsSync.mockReturnValue(false);
      fs.readFileSync.mockReturnValue(JSON.stringify({
        plexApiKey: 'test-key',
        youtubeOutputDirectory: '/test/output'
      }));
      JobModule = require('../jobModule');
      JobModule.saveJobs = jest.fn().mockResolvedValue();
    });

    test('should update job fields', async () => {
      JobModule.jobs = {
        'job-1': { status: 'In Progress', output: 'old' }
      };

      JobModule.updateJob('job-1', { status: 'Pending', output: 'new' });

      // Wait for async save operation
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(JobModule.jobs['job-1']).toMatchObject({
        status: 'Pending',
        output: 'new'
      });
      expect(JobModule.saveJobs).toHaveBeenCalled();
    });

    test('should emit download complete message for completion statuses', async () => {
      JobModule.jobs = {
        'job-1': { status: 'In Progress' }
      };

      JobModule.saveJobOnly = jest.fn().mockResolvedValue();

      JobModule.updateJob('job-1', {
        status: 'Complete',
        data: { videos: ['video1', 'video2'] }
      });

      // Wait for async save operation
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(MessageEmitter.emitMessage).toHaveBeenCalledWith(
        'broadcast',
        null,
        'download',
        'downloadComplete',
        expect.objectContaining({ videos: ['video1', 'video2'] })
      );
      expect(JobModule.jobs['job-1'].output).toBe('2 videos.');
      expect(JobModule.saveJobOnly).toHaveBeenCalledWith('job-1', expect.any(Object));
    });

    test('should handle job not found', async () => {
      JobModule.jobs = {};

      JobModule.updateJob('nonexistent', { status: 'Pending' });

      // Wait for async operation
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(logger.warn).toHaveBeenCalled();

    });

    test('should handle Terminated status without data.videos gracefully', async () => {
      JobModule.jobs = {
        'job-1': { status: 'Pending', jobType: 'Channel Downloads' }
      };

      JobModule.saveJobOnly = jest.fn().mockResolvedValue();

      // Update without data property (like when terminating a job with missing action)
      JobModule.updateJob('job-1', {
        status: 'Terminated',
        output: 'Job could not be started after server restart'
      });

      // Wait for async save operation
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(MessageEmitter.emitMessage).toHaveBeenCalledWith(
        'broadcast',
        null,
        'download',
        'downloadComplete',
        expect.objectContaining({ videos: [] }) // Should use empty array when data.videos is undefined
      );
      expect(JobModule.jobs['job-1'].status).toBe('Terminated');
      expect(JobModule.jobs['job-1'].output).toBe('Job could not be started after server restart');
      expect(JobModule.saveJobOnly).toHaveBeenCalledWith('job-1', expect.any(Object));
    });

    test('should emit download complete with videos when data.videos is present', async () => {
      JobModule.jobs = {
        'job-1': { status: 'In Progress', data: { videos: [] } }
      };

      JobModule.saveJobOnly = jest.fn().mockResolvedValue();

      JobModule.updateJob('job-1', {
        status: 'Complete',
        data: { videos: ['video1', 'video2', 'video3'] }
      });

      // Wait for async save operation
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(MessageEmitter.emitMessage).toHaveBeenCalledWith(
        'broadcast',
        null,
        'download',
        'downloadComplete',
        expect.objectContaining({ videos: ['video1', 'video2', 'video3'] })
      );
      expect(JobModule.jobs['job-1'].output).toBe('3 videos.');
    });
  });

  describe('deleteJob', () => {
    beforeEach(() => {
      fs.existsSync.mockReturnValue(false);
      fs.readFileSync.mockReturnValue(JSON.stringify({
        plexApiKey: 'test-key',
        youtubeOutputDirectory: '/test/output'
      }));
      JobModule = require('../jobModule');
      JobModule.saveJobs = jest.fn().mockResolvedValue();
    });

    test('should delete job and save', () => {
      JobModule.jobs = {
        'job-1': { status: 'Complete' },
        'job-2': { status: 'Error' }
      };

      JobModule.deleteJob('job-1');

      expect(JobModule.jobs['job-1']).toBeUndefined();
      expect(JobModule.jobs['job-2']).toBeDefined();
      expect(JobModule.saveJobs).toHaveBeenCalled();
    });
  });

  describe('getJob', () => {
    beforeEach(() => {
      fs.existsSync.mockReturnValue(false);
      fs.readFileSync.mockReturnValue(JSON.stringify({
        plexApiKey: 'test-key',
        youtubeOutputDirectory: '/test/output'
      }));
      JobModule = require('../jobModule');
    });

    test('should return job by ID', () => {
      const mockJob = { status: 'Complete', output: 'test' };
      JobModule.jobs = {
        'job-1': mockJob
      };

      const result = JobModule.getJob('job-1');
      expect(result).toBe(mockJob);
    });

    test('should return undefined for non-existent job', () => {
      JobModule.jobs = {};

      const result = JobModule.getJob('nonexistent');
      expect(result).toBeUndefined();
    });
  });

  describe('getRunningJobs', () => {
    beforeEach(() => {
      fs.existsSync.mockReturnValue(false);
      fs.readFileSync.mockReturnValue(JSON.stringify({
        plexApiKey: 'test-key',
        youtubeOutputDirectory: '/test/output'
      }));
      JobModule = require('../jobModule');
    });

    test('should return empty array when no jobs', () => {
      JobModule.jobs = null;
      
      const result = JobModule.getRunningJobs();

      expect(result).toEqual([]);
      expect(logger.debug).toHaveBeenCalled();

    });

    test('should delete old jobs and return recent ones', () => {
      const now = Date.now();
      const oldTime = now - (15 * 24 * 60 * 60 * 1000); // 15 days ago
      const recentTime = now - (5 * 24 * 60 * 60 * 1000); // 5 days ago

      JobModule.jobs = {
        'old-job': { timeCreated: oldTime, status: 'Complete' },
        'recent-job-1': { timeCreated: recentTime, status: 'Complete' },
        'recent-job-2': { timeCreated: now, status: 'In Progress' }
      };

      const result = JobModule.getRunningJobs();

      expect(JobModule.jobs['old-job']).toBeUndefined();
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('recent-job-2'); // Most recent first
      expect(result[1].id).toBe('recent-job-1');
    });

    test('should limit to 240 most recent jobs', () => {
      JobModule.jobs = {};
      const now = Date.now();

      // Create 250 jobs
      for (let i = 0; i < 250; i++) {
        JobModule.jobs[`job-${i}`] = {
          timeCreated: now - i * 1000,
          status: 'Complete'
        };
      }

      const result = JobModule.getRunningJobs();

      expect(result).toHaveLength(240);
      expect(result[0].id).toBe('job-0'); // Most recent
      expect(result[239].id).toBe('job-239');
    });
  });

  describe('getAllJobs', () => {
    beforeEach(() => {
      fs.existsSync.mockReturnValue(false);
      fs.readFileSync.mockReturnValue(JSON.stringify({
        plexApiKey: 'test-key',
        youtubeOutputDirectory: '/test/output'
      }));
      JobModule = require('../jobModule');
    });

    test('should return all jobs', () => {
      const mockJobs = {
        'job-1': { status: 'Complete' },
        'job-2': { status: 'Pending' }
      };
      JobModule.jobs = mockJobs;

      const result = JobModule.getAllJobs();
      expect(result).toBe(mockJobs);
    });
  });

  describe('saveJobOnly', () => {
    beforeEach(() => {
      fs.existsSync.mockReturnValue(false);
      fs.readFileSync.mockReturnValue(JSON.stringify({
        plexApiKey: 'test-key',
        youtubeOutputDirectory: '/test/output'
      }));
      JobModule = require('../jobModule');
    });

    test('should set last_downloaded_at when file is verified', async () => {
      const mockJobInstance = {
        id: 'job-1',
        update: jest.fn().mockResolvedValue()
      };
      const mockVideoInstance = {
        youtubeId: 'video-1',
        update: jest.fn().mockResolvedValue()
      };

      Job.findOne.mockResolvedValue(mockJobInstance);
      Video.findOne.mockResolvedValue(mockVideoInstance);

      const jobData = {
        id: 'job-1',
        status: 'Complete',
        data: {
          videos: [{
            youtubeId: 'video-1',
            youTubeVideoName: 'Test Video',
            channel_id: 'channel-1',
            filePath: '/videos/test.mp4',
            fileSize: '12345'
          }]
        }
      };

      await JobModule.saveJobOnly('job-1', jobData);

      expect(mockVideoInstance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          youtubeId: 'video-1',
          filePath: '/videos/test.mp4',
          fileSize: '12345',
          removed: false,
          last_downloaded_at: expect.any(Date)
        })
      );
    });

    test('should not set last_downloaded_at when file is not verified', async () => {
      const mockJobInstance = {
        id: 'job-1',
        update: jest.fn().mockResolvedValue()
      };
      const mockVideoInstance = {
        youtubeId: 'video-1',
        update: jest.fn().mockResolvedValue()
      };

      Job.findOne.mockResolvedValue(mockJobInstance);
      Video.findOne.mockResolvedValue(mockVideoInstance);

      const jobData = {
        id: 'job-1',
        status: 'Complete',
        data: {
          videos: [{
            youtubeId: 'video-1',
            youTubeVideoName: 'Test Video',
            channel_id: 'channel-1',
            filePath: '/videos/test.mp4',
            fileSize: null
          }]
        }
      };

      await JobModule.saveJobOnly('job-1', jobData);

      const updateArgs = mockVideoInstance.update.mock.calls[0][0];
      expect(updateArgs.last_downloaded_at).toBeUndefined();
      expect(updateArgs.filePath).toBeUndefined();
      expect(updateArgs.fileSize).toBeUndefined();
      expect(updateArgs.removed).toBeUndefined();
    });

    test('should create new video when it does not exist', async () => {
      const mockJobInstance = {
        id: 'job-1',
        update: jest.fn().mockResolvedValue()
      };

      Job.findOne.mockResolvedValue(mockJobInstance);
      Video.findOne.mockResolvedValue(null);

      const jobData = {
        id: 'job-1',
        status: 'Complete',
        data: {
          videos: [{
            youtubeId: 'video-1',
            youTubeVideoName: 'Test Video',
            channel_id: 'channel-1',
            filePath: '/videos/test.mp4',
            fileSize: '12345'
          }]
        }
      };

      await JobModule.saveJobOnly('job-1', jobData);

      expect(Video.create).toHaveBeenCalledWith(
        expect.objectContaining({
          youtubeId: 'video-1',
          youTubeVideoName: 'Test Video',
          channel_id: 'channel-1',
          filePath: '/videos/test.mp4',
          fileSize: '12345'
        })
      );
      expect(JobVideo.create).toHaveBeenCalledWith({
        job_id: 'job-1',
        video_id: 'video-1'
      });
    });
  });

  describe('saveJobs', () => {
    beforeEach(() => {
      fs.existsSync.mockReturnValue(false);
      fs.readFileSync.mockReturnValue(JSON.stringify({
        plexApiKey: 'test-key',
        youtubeOutputDirectory: '/test/output'
      }));
      JobModule = require('../jobModule');
    });

    test('should skip save if already saving', async () => {
      JobModule.isSaving = true;

      await JobModule.saveJobs();

      expect(logger.debug).toHaveBeenCalled();
      expect(Job.findOne).not.toHaveBeenCalled();

    });

    test('should create new job in database', async () => {
      JobModule.jobs = {
        'job-1': {
          id: 'job-1',
          status: 'In Progress',
          data: {
            videos: [{
              youtubeId: 'video-1',
              youTubeVideoName: 'Test Video',
              channel_id: 'channel-1'
            }]
          }
        }
      };

      Job.findOne.mockResolvedValue(null);

      await JobModule.saveJobs();

      expect(Job.create).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'job-1',
          status: 'In Progress'
        })
      );
      expect(Video.create).toHaveBeenCalledWith(
        expect.objectContaining({
          youtubeId: 'video-1'
        })
      );
      expect(JobVideo.create).toHaveBeenCalled();
      expect(JobModule.isSaving).toBe(false);
    });

    test('should update existing job in database', async () => {
      const mockJobInstance = {
        update: jest.fn()
      };
      Job.findOne.mockResolvedValue(mockJobInstance);

      JobModule.jobs = {
        'job-1': {
          id: 'job-1',
          status: 'Complete',
          data: { videos: [] }
        }
      };

      await JobModule.saveJobs();

      expect(mockJobInstance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'job-1',
          status: 'Complete'
        })
      );
    });

    test('should handle errors gracefully', async () => {
      Job.findOne.mockRejectedValue(new Error('DB Error'));

      JobModule.jobs = {
        'job-1': {
          id: 'job-1',
          data: { videos: [] }
        }
      };

      await JobModule.saveJobs();

      expect(logger.error).toHaveBeenCalled();
      expect(JobModule.isSaving).toBe(false);

    });

    test('should upsert channel videos', async () => {
      JobModule.jobs = {
        'job-1': {
          id: 'job-1',
          data: {
            videos: [{
              youtubeId: 'video-1',
              youTubeVideoName: 'Test Video',
              duration: 300,
              originalDate: '20240101',
              channel_id: 'channel-1'
            }]
          }
        }
      };

      Job.findOne.mockResolvedValue(null);
      Video.findOne.mockResolvedValue(null);

      await JobModule.saveJobs();

      expect(ChannelVideo.findOrCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            youtube_id: 'video-1',
            channel_id: 'channel-1'
          }
        })
      );
    });

    test('should clear removed flag when new download provides file metadata', async () => {
      const mockVideoInstance = {
        update: jest.fn().mockResolvedValue(),
        removed: true
      };

      JobModule.jobs = {
        'job-1': {
          id: 'job-1',
          data: {
            videos: [{
              youtubeId: 'video-1',
              youTubeVideoName: 'Test Video',
              youTubeChannelName: 'Test Channel',
              filePath: '/videos/Test Channel/Test Video.mp4',
              fileSize: '12345',
              removed: false
            }]
          }
        }
      };

      Job.findOne.mockResolvedValue(null);
      Video.findOne.mockResolvedValue(mockVideoInstance);

      await JobModule.saveJobs();

      expect(mockVideoInstance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          youtubeId: 'video-1',
          filePath: '/videos/Test Channel/Test Video.mp4',
          fileSize: '12345',
          removed: false,
          last_downloaded_at: expect.any(Date)
        })
      );
    });

    test('should leave removed flag untouched when file metadata is unavailable', async () => {
      const mockVideoInstance = {
        update: jest.fn().mockResolvedValue(),
        removed: true
      };

      JobModule.jobs = {
        'job-1': {
          id: 'job-1',
          data: {
            videos: [{
              youtubeId: 'video-1',
              youTubeVideoName: 'Test Video',
              youTubeChannelName: 'Test Channel',
              filePath: '/videos/Test Channel/Test Video.mp4',
              fileSize: null,
              removed: false
            }]
          }
        }
      };

      Job.findOne.mockResolvedValue(null);
      Video.findOne.mockResolvedValue(mockVideoInstance);

      await JobModule.saveJobs();

      const updateArgs = mockVideoInstance.update.mock.calls[0][0];
      expect(updateArgs.filePath).toBeUndefined();
      expect(updateArgs.fileSize).toBeUndefined();
      expect(updateArgs.removed).toBeUndefined();
      expect(updateArgs.last_downloaded_at).toBeUndefined();
    });

    test('should create new video when it does not exist in database', async () => {
      JobModule.jobs = {
        'job-1': {
          id: 'job-1',
          status: 'In Progress',
          data: {
            videos: [{
              youtubeId: 'video-1',
              youTubeVideoName: 'Test Video',
              channel_id: 'channel-1',
              filePath: '/videos/test.mp4',
              fileSize: '67890'
            }]
          }
        }
      };

      Job.findOne.mockResolvedValue(null);
      Video.findOne.mockResolvedValue(null);

      await JobModule.saveJobs();

      expect(Video.create).toHaveBeenCalledWith(
        expect.objectContaining({
          youtubeId: 'video-1',
          youTubeVideoName: 'Test Video',
          channel_id: 'channel-1',
          filePath: '/videos/test.mp4',
          fileSize: '67890'
        })
      );
      expect(JobVideo.create).toHaveBeenCalled();
    });
  });

  describe('uploadDateToIso', () => {
    beforeEach(() => {
      fs.existsSync.mockReturnValue(false);
      fs.readFileSync.mockReturnValue(JSON.stringify({
        plexApiKey: 'test-key',
        youtubeOutputDirectory: '/test/output'
      }));
      JobModule = require('../jobModule');
    });

    test('should convert YYYYMMDD to ISO string', () => {
      const result = JobModule.uploadDateToIso('20240115');
      expect(result).toBe('2024-01-15T00:00:00.000Z');
    });

    test('should handle invalid date formats', () => {
      expect(JobModule.uploadDateToIso(null)).toBeNull();
      expect(JobModule.uploadDateToIso('')).toBeNull();
      expect(JobModule.uploadDateToIso('invalid')).toBeNull();
      expect(JobModule.uploadDateToIso('2024')).toBeNull();
      expect(JobModule.uploadDateToIso(123)).toBeNull();
    });

    test('should handle invalid date values', () => {
      const result = JobModule.uploadDateToIso('20241345'); // Invalid month
      expect(result).toBeNull();
    });
  });

  describe('upsertChannelVideoFromInfo', () => {
    beforeEach(() => {
      fs.existsSync.mockReturnValue(false);
      fs.readFileSync.mockReturnValue(JSON.stringify({
        plexApiKey: 'test-key',
        youtubeOutputDirectory: '/test/output'
      }));
      JobModule = require('../jobModule');
    });

    test('should create new channel video', async () => {
      const info = {
        id: 'video-1',
        channel_id: 'channel-1',
        title: 'Test Video',
        duration: 300,
        upload_date: '20240115',
        availability: 'public'
      };

      ChannelVideo.findOrCreate.mockResolvedValue([{}, true]);

      await JobModule.upsertChannelVideoFromInfo(info);

      expect(ChannelVideo.findOrCreate).toHaveBeenCalledWith({
        where: { youtube_id: 'video-1', channel_id: 'channel-1' },
        defaults: expect.objectContaining({
          title: 'Test Video',
          duration: 300,
          publishedAt: '2024-01-15T00:00:00.000Z',
          availability: 'public',
          thumbnail: 'https://i.ytimg.com/vi/video-1/mqdefault.jpg'
        })
      });
    });

    test('should update existing channel video', async () => {
      const mockRecord = { update: jest.fn() };
      ChannelVideo.findOrCreate.mockResolvedValue([mockRecord, false]);

      const info = {
        youtubeId: 'video-1',
        channelId: 'channel-1',
        youTubeVideoName: 'Updated Video',
        duration: 120,
        upload_date: '20240115',
        availability: 'public',
        media_type: 'video'
      };

      await JobModule.upsertChannelVideoFromInfo(info);

      // Verify that update is called with correct fields
      expect(mockRecord.update).toHaveBeenCalledWith({
        title: 'Updated Video',
        thumbnail: 'https://i.ytimg.com/vi/video-1/mqdefault.jpg',
        duration: 120,
        availability: 'public',
        media_type: 'video'
      });

      // Explicitly verify that publishedAt is NOT included in the update
      const updateCall = mockRecord.update.mock.calls[0][0];
      expect(updateCall).not.toHaveProperty('publishedAt');
    });

    test('should skip update when skipUpdateIfExists is true', async () => {
      const mockRecord = { update: jest.fn() };
      ChannelVideo.findOrCreate.mockResolvedValue([mockRecord, false]);

      await JobModule.upsertChannelVideoFromInfo(
        { id: 'video-1', channel_id: 'channel-1' },
        { skipUpdateIfExists: true }
      );

      expect(mockRecord.update).not.toHaveBeenCalled();
    });

    test('should return early if missing required fields', async () => {
      await JobModule.upsertChannelVideoFromInfo({ id: 'video-1' });
      expect(ChannelVideo.findOrCreate).not.toHaveBeenCalled();

      await JobModule.upsertChannelVideoFromInfo({ channel_id: 'channel-1' });
      expect(ChannelVideo.findOrCreate).not.toHaveBeenCalled();
    });
  });

  describe('backfillFromCompleteList', () => {
    beforeEach(() => {
      fs.existsSync.mockReturnValue(false);
      fs.readFileSync.mockReturnValue(JSON.stringify({
        plexApiKey: 'test-key',
        youtubeOutputDirectory: '/test/output'
      }));
      JobModule = require('../jobModule');
    });

    test('should skip when complete.list does not exist', async () => {
      fsPromises.readFile.mockRejectedValue({ code: 'ENOENT' });

      await JobModule.backfillFromCompleteList();

      expect(logger.info).toHaveBeenCalledWith('No complete.list found for backfill. Skipping.');

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

      await JobModule.backfillFromCompleteList();

      expect(Video.create).toHaveBeenCalledTimes(2);
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

      await JobModule.backfillFromCompleteList();

      // Should only process 300 items per run
      // Check that ChannelVideo operations are capped at 300
      expect(ChannelVideo.findOrCreate).toHaveBeenCalledTimes(300);
      // Video.create should also be capped at 300 for new videos
      expect(Video.create).toHaveBeenCalledTimes(300);

    });

    test('should handle missing info.json files', async () => {
            
      fsPromises.readFile.mockImplementation(async (path) => {
        if (path.includes('complete.list')) {
          return 'youtube video-1\nyoutube video-2\n';
        }
        throw { code: 'ENOENT' };
      });

      Video.findAll.mockResolvedValue([]);
      ChannelVideo.findAll.mockResolvedValue([]);

      await JobModule.backfillFromCompleteList();

      // The order might be reversed since backfill processes from end of list
      expect(logger.warn).toHaveBeenCalled();

    });

    test('should handle errors gracefully', async () => {
      fsPromises.readFile.mockRejectedValue(new Error('Read error'));

      await JobModule.backfillFromCompleteList();

      expect(logger.error).toHaveBeenCalled();

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

      await JobModule.backfillFromCompleteList();

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

      // Mock stat to simulate file exists with size
      fsPromises.stat.mockResolvedValue({ size: 123456789 });

      Video.findAll.mockResolvedValue([]);
      ChannelVideo.findAll.mockResolvedValue([]);
      Video.findOne.mockResolvedValue(null);

      await JobModule.backfillFromCompleteList();

      expect(Video.create).toHaveBeenCalledTimes(1);
      expect(Video.create).toHaveBeenCalledWith(
        expect.objectContaining({
          youtubeId: 'video-1',
          filePath: '/test/output/Channel 1/Channel 1 - Video 1 - video-1/Channel 1 - Video 1  [video-1].mp4',
          fileSize: '123456789',
          removed: false
        })
      );

    });

    test('should update existing video with file metadata if not already set', async () => {
      
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

      // Mock stat to simulate file exists with size
      fsPromises.stat.mockResolvedValue({ size: 987654321 });

      const mockVideoInstance = {
        youtubeId: 'video-1',
        filePath: null,
        fileSize: null,
        update: jest.fn()
      };

      Video.findAll.mockResolvedValue([{ youtubeId: 'video-1' }]);
      ChannelVideo.findAll.mockResolvedValue([]);
      Video.findOne.mockResolvedValue(mockVideoInstance);

      await JobModule.backfillFromCompleteList();

      // Should not create a new video
      expect(Video.create).not.toHaveBeenCalled();
      // Should update the existing video with file metadata
      expect(mockVideoInstance.update).toHaveBeenCalledWith({
        filePath: '/test/output/Channel 1/Channel 1 - Video 1 - video-1/Channel 1 - Video 1  [video-1].mp4',
        fileSize: '987654321',
        removed: false
      });

    });

    test('should try alternative video extensions when mp4 not found', async () => {
      
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

      // Mock stat to fail for mp4 but succeed for webm
      fsPromises.stat.mockImplementation(async (path) => {
        if (path.includes('.mp4')) {
          throw new Error('ENOENT');
        }
        if (path.includes('.webm')) {
          return { size: 555555555 };
        }
        throw new Error('ENOENT');
      });

      Video.findAll.mockResolvedValue([]);
      ChannelVideo.findAll.mockResolvedValue([]);
      Video.findOne.mockResolvedValue(null);

      await JobModule.backfillFromCompleteList();

      expect(Video.create).toHaveBeenCalledTimes(1);
      expect(Video.create).toHaveBeenCalledWith(
        expect.objectContaining({
          youtubeId: 'video-1',
          filePath: '/test/output/Channel 1/Channel 1 - Video 1 - video-1/Channel 1 - Video 1  [video-1].webm',
          fileSize: '555555555',
          removed: false
        })
      );

    });
  });

  describe('scheduleDailyBackfill', () => {
    beforeEach(() => {
      fs.existsSync.mockReturnValue(false);
      fs.readFileSync.mockReturnValue(JSON.stringify({
        plexApiKey: 'test-key',
        youtubeOutputDirectory: '/test/output'
      }));
      JobModule = require('../jobModule');
    });

    test('should schedule cron job for daily backfill', () => {
      
      JobModule.scheduleDailyBackfill();

      expect(cron.schedule).toHaveBeenCalledWith('20 2 * * *', expect.any(Function));
      expect(logger.info).toHaveBeenCalled();

    });

    test('should handle cron scheduling errors', () => {
      cron.schedule.mockImplementation(() => {
        throw new Error('Cron error');
      });

      JobModule.scheduleDailyBackfill();

      expect(logger.error).toHaveBeenCalled();

    });
  });

  describe('loadJobsFromDB', () => {
    beforeEach(() => {
      fs.existsSync.mockReturnValue(false);
      fs.readFileSync.mockReturnValue(JSON.stringify({
        plexApiKey: 'test-key',
        youtubeOutputDirectory: '/test/output'
      }));
      JobModule = require('../jobModule');
    });

    test('should load jobs and their videos from database', async () => {
      const mockJobs = [
        { id: 'job-1', status: 'Complete', dataValues: { id: 'job-1', status: 'Complete' } }
      ];
      const mockJobVideos = [
        { job_id: 'job-1', video_id: 'video-1' }
      ];
      const mockVideo = {
        id: 'video-1',
        youtubeId: 'video-1',
        dataValues: { id: 'video-1', youtubeId: 'video-1' }
      };

      Job.findAll.mockResolvedValue(mockJobs);
      JobVideo.findAll.mockResolvedValue(mockJobVideos);
      Video.findOne.mockResolvedValue(mockVideo);

      await JobModule.loadJobsFromDB();

      expect(JobModule.jobs['job-1']).toBeDefined();
      expect(JobModule.jobs['job-1'].data.videos).toHaveLength(1);
      expect(JobModule.jobs['job-1'].data.videos[0]).toEqual(mockVideo.dataValues);
    });

    test('should handle database errors', async () => {
      Job.findAll.mockRejectedValue(new Error('DB Error'));

      await JobModule.loadJobsFromDB();

      expect(logger.error).toHaveBeenCalled();

    });

    test('should skip job videos without matching video record', async () => {
      const mockJobs = [
        { id: 'job-1', dataValues: { id: 'job-1' } }
      ];
      const mockJobVideos = [
        { job_id: 'job-1', video_id: 'missing-video' }
      ];

      Job.findAll.mockResolvedValue(mockJobs);
      JobVideo.findAll.mockResolvedValue(mockJobVideos);
      Video.findOne.mockResolvedValue(null);

      await JobModule.loadJobsFromDB();

      expect(JobModule.jobs['job-1'].data.videos).toHaveLength(0);
    });
  });

  describe('migrateJobsFromFile', () => {
    beforeEach(() => {
      fs.existsSync.mockReturnValue(false);
      fs.readFileSync.mockReturnValue(JSON.stringify({
        plexApiKey: 'test-key',
        youtubeOutputDirectory: '/test/output'
      }));
      JobModule = require('../jobModule');
    });

    test('should migrate jobs with videos from file to database', async () => {
      JobModule.jobs = {
        'job-1': {
          id: 'job-1',
          status: 'Complete',
          timeInitiated: '2024-01-01T00:00:00.000Z',
          timeCreated: '2024-01-01T00:00:00.000Z',
          data: {
            videos: [
              { youtubeId: 'video-1', title: 'Video 1' }
            ]
          }
        }
      };

      Job.create.mockResolvedValue({ id: 'job-1' });
      Video.create.mockResolvedValue({ id: 'video-1' });

      await JobModule.migrateJobsFromFile();

      expect(Job.create).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'job-1',
          status: 'Complete',
          timeInitiated: expect.any(Date),
          timeCreated: expect.any(Date)
        })
      );
      expect(Video.create).toHaveBeenCalledWith(
        expect.objectContaining({ youtubeId: 'video-1' })
      );
      expect(JobVideo.create).toHaveBeenCalledWith({
        job_id: 'job-1',
        video_id: 'video-1'
      });
    });

    test('should skip jobs without data', async () => {
      JobModule.jobs = {
        'job-1': {
          id: 'job-1',
          status: 'Complete'
          // No data property
        }
      };

      await JobModule.migrateJobsFromFile();

      expect(Job.create).not.toHaveBeenCalled();
    });

    test('should handle migration errors gracefully', async () => {
      JobModule.jobs = {
        'job-1': {
          id: 'job-1',
          timeInitiated: '2024-01-01',
          timeCreated: '2024-01-01',
          data: { videos: [] }
        }
      };

      Job.create.mockRejectedValue(new Error('Create failed'));

      await JobModule.migrateJobsFromFile();

      expect(logger.error).toHaveBeenCalled();

    });
  });

  describe('saveJobsAndStartNext', () => {
    beforeEach(() => {
      fs.existsSync.mockReturnValue(false);
      fs.readFileSync.mockReturnValue(JSON.stringify({
        plexApiKey: 'test-key',
        youtubeOutputDirectory: '/test/output'
      }));
      JobModule = require('../jobModule');
      JobModule.saveJobs = jest.fn().mockResolvedValue();
      JobModule.startNextJob = jest.fn();
    });

    test('should save jobs then start next job', async () => {
      JobModule.saveJobsAndStartNext();

      // Wait for async operation
      await new Promise(resolve => setTimeout(resolve, 10));

      // saveJobsAndStartNext now just starts the next job without saving
      expect(JobModule.saveJobs).not.toHaveBeenCalled();
      expect(JobModule.startNextJob).toHaveBeenCalled();
    });
  });

  describe('upsertVideoForJob', () => {
    beforeEach(() => {
      fs.existsSync.mockReturnValue(false);
      fs.readFileSync.mockReturnValue(JSON.stringify({
        plexApiKey: 'test-key',
        youtubeOutputDirectory: '/test/output'
      }));
      JobModule = require('../jobModule');
    });

    test('should create new video and JobVideo relationship when video does not exist', async () => {
      const videoData = {
        youtubeId: 'new-video-1',
        youTubeChannelName: 'Test Channel',
        youTubeVideoName: 'New Video',
        filePath: '/path/to/video.mp4',
        fileSize: '12345',
        removed: false
      };
      const jobInstance = { id: 'job-1' };

      Video.findOne.mockResolvedValue(null);
      const mockVideoInstance = { id: 'video-1', youtubeId: 'new-video-1' };
      Video.create.mockResolvedValue(mockVideoInstance);
      JobVideo.findOne.mockResolvedValue(null);

      const result = await JobModule.upsertVideoForJob(videoData, jobInstance);

      expect(Video.create).toHaveBeenCalled();
      expect(JobVideo.create).toHaveBeenCalledWith({
        job_id: 'job-1',
        video_id: 'video-1'
      });
      expect(result).toBe(mockVideoInstance);
    });

    test('should update existing video and not create JobVideo when video exists and alwaysCreateJobVideo=false', async () => {
      const videoData = {
        youtubeId: 'existing-video',
        youTubeChannelName: 'Test Channel',
        youTubeVideoName: 'Existing Video',
        filePath: '/path/to/video.mp4',
        fileSize: '12345'
      };
      const jobInstance = { id: 'job-1' };

      const mockVideoInstance = {
        id: 'video-1',
        youtubeId: 'existing-video',
        update: jest.fn().mockResolvedValue()
      };
      Video.findOne.mockResolvedValue(mockVideoInstance);

      const result = await JobModule.upsertVideoForJob(videoData, jobInstance, false);

      expect(mockVideoInstance.update).toHaveBeenCalled();
      expect(Video.create).not.toHaveBeenCalled();
      expect(JobVideo.create).not.toHaveBeenCalled();
      expect(result).toBe(mockVideoInstance);
    });

    test('should update existing video and create JobVideo when alwaysCreateJobVideo=true', async () => {
      const videoData = {
        youtubeId: 'existing-video',
        youTubeChannelName: 'Test Channel',
        youTubeVideoName: 'Existing Video',
        filePath: '/path/to/video.mp4',
        fileSize: '12345'
      };
      const jobInstance = { id: 'job-1' };

      const mockVideoInstance = {
        id: 'video-1',
        youtubeId: 'existing-video',
        update: jest.fn().mockResolvedValue()
      };
      Video.findOne.mockResolvedValue(mockVideoInstance);
      JobVideo.findOne.mockResolvedValue(null);

      const result = await JobModule.upsertVideoForJob(videoData, jobInstance, true);

      expect(mockVideoInstance.update).toHaveBeenCalled();
      expect(Video.create).not.toHaveBeenCalled();
      expect(JobVideo.create).toHaveBeenCalledWith({
        job_id: 'job-1',
        video_id: 'video-1'
      });
      expect(result).toBe(mockVideoInstance);
    });

    test('should not create duplicate JobVideo when relationship already exists', async () => {
      const videoData = {
        youtubeId: 'existing-video',
        youTubeChannelName: 'Test Channel',
        youTubeVideoName: 'Existing Video',
        filePath: '/path/to/video.mp4',
        fileSize: '12345'
      };
      const jobInstance = { id: 'job-1' };

      const mockVideoInstance = {
        id: 'video-1',
        youtubeId: 'existing-video',
        update: jest.fn().mockResolvedValue()
      };
      const existingJobVideo = { job_id: 'job-1', video_id: 'video-1' };

      Video.findOne.mockResolvedValue(mockVideoInstance);
      JobVideo.findOne.mockResolvedValue(existingJobVideo);

      const result = await JobModule.upsertVideoForJob(videoData, jobInstance, true);

      expect(mockVideoInstance.update).toHaveBeenCalled();
      expect(JobVideo.create).not.toHaveBeenCalled();
      expect(result).toBe(mockVideoInstance);
    });

    test('should handle unique constraint error and fetch existing video', async () => {
      const videoData = {
        youtubeId: 'race-video',
        youTubeChannelName: 'Test Channel',
        youTubeVideoName: 'Race Condition Video',
        filePath: '/path/to/video.mp4',
        fileSize: '12345'
      };
      const jobInstance = { id: 'job-1' };

      // First findOne returns null (video doesn't exist yet)
      // Create fails with unique constraint error
      // Second findOne returns the video (created by another process)
      const mockVideoInstance = { id: 'video-1', youtubeId: 'race-video' };
      Video.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockVideoInstance);

      const uniqueError = new Error('Duplicate entry');
      uniqueError.name = 'SequelizeUniqueConstraintError';
      Video.create.mockRejectedValue(uniqueError);
      JobVideo.findOne.mockResolvedValue(null);

      const result = await JobModule.upsertVideoForJob(videoData, jobInstance, true);

      expect(Video.create).toHaveBeenCalled();
      expect(Video.findOne).toHaveBeenCalledTimes(2);
      expect(JobVideo.create).toHaveBeenCalledWith({
        job_id: 'job-1',
        video_id: 'video-1'
      });
      expect(result).toBe(mockVideoInstance);
    });

    test('should handle ER_DUP_ENTRY error and fetch existing video', async () => {
      const videoData = {
        youtubeId: 'race-video-2',
        youTubeChannelName: 'Test Channel',
        youTubeVideoName: 'Race Condition Video 2',
        filePath: '/path/to/video.mp4',
        fileSize: '12345'
      };
      const jobInstance = { id: 'job-1' };

      const mockVideoInstance = { id: 'video-2', youtubeId: 'race-video-2' };
      Video.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockVideoInstance);

      const dupError = new Error('ER_DUP_ENTRY');
      dupError.original = { code: 'ER_DUP_ENTRY' };
      Video.create.mockRejectedValue(dupError);
      JobVideo.findOne.mockResolvedValue(null);

      const result = await JobModule.upsertVideoForJob(videoData, jobInstance, true);

      expect(Video.create).toHaveBeenCalled();
      expect(Video.findOne).toHaveBeenCalledTimes(2);
      expect(JobVideo.create).toHaveBeenCalledWith({
        job_id: 'job-1',
        video_id: 'video-2'
      });
      expect(result).toBe(mockVideoInstance);
    });

    test('should throw error if video not found after unique constraint error', async () => {
      const videoData = {
        youtubeId: 'missing-video',
        youTubeChannelName: 'Test Channel',
        youTubeVideoName: 'Missing Video'
      };
      const jobInstance = { id: 'job-1' };

      Video.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      const uniqueError = new Error('Duplicate entry');
      uniqueError.name = 'SequelizeUniqueConstraintError';
      Video.create.mockRejectedValue(uniqueError);

      await expect(
        JobModule.upsertVideoForJob(videoData, jobInstance)
      ).rejects.toThrow('Failed to find video missing-video after unique constraint error');
    });

    test('should re-throw non-unique constraint errors', async () => {
      const videoData = {
        youtubeId: 'error-video',
        youTubeChannelName: 'Test Channel',
        youTubeVideoName: 'Error Video'
      };
      const jobInstance = { id: 'job-1' };

      Video.findOne.mockResolvedValue(null);

      const otherError = new Error('Database connection failed');
      Video.create.mockRejectedValue(otherError);

      await expect(
        JobModule.upsertVideoForJob(videoData, jobInstance)
      ).rejects.toThrow('Database connection failed');
    });
  });
});
