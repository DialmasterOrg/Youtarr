/* eslint-env jest */

// Mock dependencies
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'generated-uuid'),
  validate: jest.requireActual('uuid').validate
}));
jest.mock('node-cron');
jest.mock('../messageEmitter.js');
jest.mock('../configModule');
jest.mock('../../models/job');
jest.mock('../../models/video');
jest.mock('../../models/jobvideo');
jest.mock('../../models/jobvideodownload');
jest.mock('../../models/channelvideo');
jest.mock('../download/downloadCleanup', () => ({
  cleanupInProgressVideos: jest.fn().mockResolvedValue()
}));
jest.mock('../channelVideoReanchor', () => ({
  applyExactDateForGroup: jest.fn().mockResolvedValue(undefined),
  applyExactDateForVideo: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../logger');
jest.mock('../storageGuard', () => ({
  refresh: jest.fn().mockResolvedValue({ paused: false }),
  on: jest.fn()
}));

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
  let scheduledTaskRuns;
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
    cron.validate.mockReturnValue(true);
    cron.getTasks.mockReturnValue(new Map());
    cron.schedule = jest.fn(() => ({ start: jest.fn(), stop: jest.fn() }));

    // Mock MessageEmitter
    MessageEmitter = require('../messageEmitter.js');
    MessageEmitter.emitMessage = jest.fn();

    // Get logger mock
    logger = require('../../logger');

    // Mock configModule before it's required by jobModule
    jest.doMock('../configModule', () => ({
      getJobsPath: jest.fn().mockReturnValue(mockJobsDir),
      getConfig: jest.fn().mockReturnValue({}),
      onConfigChange: jest.fn(),
      directoryPath: '/test/output'
    }));

    jest.doMock('../scheduledTaskRuns', () => ({
      record: jest.fn().mockResolvedValue(undefined)
    }));
    scheduledTaskRuns = require('../scheduledTaskRuns');

    // Library repair walks the downloads folder through videosModule.
    jest.doMock('../videosModule', () => ({
      scanForVideoFiles: jest.fn().mockResolvedValue({ fileMap: new Map(), duplicates: new Map(), unreadable: 0 })
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

  describe('startup', () => {
    test('creates the jobs directory if it does not exist', () => {
      fs.existsSync.mockReturnValue(false);

      JobModule = require('../jobModule');

      expect(fs.mkdirSync).toHaveBeenCalledWith(mockJobsDir, { recursive: true });
      expect(JobModule.jobs).toEqual({});
    });

    test('migrates jobs.json to the database, renames it, then loads from the database', async () => {
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
        return JSON.stringify({ plexApiKey: 'test-key' });
      });

      JobModule = require('../jobModule');

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(fs.renameSync).toHaveBeenCalledWith(mockJobsFilePath, mockJobsFilePathOld);
      expect(Job.create).toHaveBeenCalled();
      expect(Job.findAll).toHaveBeenCalled();
    });

    test('loads jobs from the database when no jobs.json exists', async () => {
      fs.existsSync.mockImplementation(path => path === mockJobsDir);

      const mockDbJobs = [
        { id: 'db-job-1', status: 'Complete', dataValues: { id: 'db-job-1', status: 'Complete' } }
      ];
      Job.findAll.mockResolvedValue(mockDbJobs);

      JobModule = require('../jobModule');

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(fs.renameSync).not.toHaveBeenCalled();
      expect(JobModule.getJob('db-job-1')).toBeDefined();
    });

    test('logs, without an unhandled rejection, when the legacy migration cannot finish', async () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify({}));
      fs.renameSync.mockImplementation(() => { throw new Error('EACCES'); });

      JobModule = require('../jobModule');
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ err: expect.any(Error) }),
        'Failed to load jobs at startup'
      );
    });

    test('still loads jobs from the database when jobs.json cannot be parsed', async () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('{ not json');
      Job.findAll.mockResolvedValue([
        { id: 'db-job-1', dataValues: { id: 'db-job-1', status: 'Complete' } }
      ]);

      JobModule = require('../jobModule');
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(fs.renameSync).not.toHaveBeenCalled();
      expect(JobModule.getJob('db-job-1')).toBeDefined();
    });

    test('after loading, recovers interrupted jobs and scans the queue', async () => {
      fs.existsSync.mockImplementation(path => path === mockJobsDir);
      Job.findAll.mockResolvedValue([
        { id: 'running', dataValues: { id: 'running', status: 'In Progress', jobType: 'Channel Downloads' } },
        { id: 'queued', dataValues: { id: 'queued', status: 'Pending', jobType: 'Channel Downloads' } }
      ]);

      JobModule = require('../jobModule');

      await new Promise(resolve => setTimeout(resolve, 20));

      expect(JobModule.getJob('running').status).toBe('Terminated');
      expect(JobModule.getJob('queued').status).toBe('Terminated');
      expect(require('../storageGuard').refresh).toHaveBeenCalled();
    });

    test('registers the downloads-resumed listener', () => {
      fs.existsSync.mockReturnValue(false);

      JobModule = require('../jobModule');

      expect(require('../storageGuard').on).toHaveBeenCalledWith('resumed', expect.any(Function));
    });

    test('schedules the daily backfill', () => {
      fs.existsSync.mockReturnValue(false);

      JobModule = require('../jobModule');

      expect(cron.schedule).toHaveBeenCalledWith('20 2 * * *', expect.any(Function), expect.objectContaining({ scheduled: false }));
    });

    test('records the startup archive repair in the run history', async () => {
      fs.existsSync.mockReturnValue(false);
      fsPromises.readFile.mockRejectedValue({ code: 'ENOENT' });
      process.env.JOBMODULE_DISABLE_INITIAL_BACKFILL = 'false';

      JobModule = require('../jobModule');
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(scheduledTaskRuns.record).toHaveBeenCalledWith({
        taskKey: 'archiveBackfillFrequency',
        trigger: 'startup',
        startedAt: expect.any(Date),
        finishedAt: expect.any(Date),
        status: 'skipped',
        outcome: 'skipped',
        message: 'No download archive (complete.list) found.',
      });
    });

    test('does not record a startup run when the initial backfill is disabled', async () => {
      fs.existsSync.mockReturnValue(false);
      process.env.JOBMODULE_DISABLE_INITIAL_BACKFILL = 'true';

      JobModule = require('../jobModule');
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(scheduledTaskRuns.record).not.toHaveBeenCalled();
    });
  });

  describe('jobs map', () => {
    beforeEach(() => {
      fs.existsSync.mockReturnValue(false);
      JobModule = require('../jobModule');
    });

    test('jobs and getAllJobs return the registry map after it is replaced', async () => {
      // Let the startup load finish first: it replaces the map too.
      await new Promise(resolve => setTimeout(resolve, 10));
      const next = { 'job-9': { status: 'Complete' } };

      require('../job/jobRegistry').replaceAll(next);

      expect(JobModule.jobs).toBe(next);
      expect(JobModule.getAllJobs()).toBe(next);
    });

    test('the facade exposes jobs read-only', () => {
      const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(JobModule), 'jobs');

      expect(descriptor.get).toEqual(expect.any(Function));
      expect(descriptor.set).toBeUndefined();
    });
  });

  describe('delegation', () => {
    beforeEach(() => {
      fs.existsSync.mockReturnValue(false);
      JobModule = require('../jobModule');
    });

    test.each([
      ['getJob', 'jobRegistry', 1],
      ['getAllJobs', 'jobRegistry', 0],
      ['getInProgressJobId', 'jobRegistry', 0],
      ['getRunningJobsWithFreshVideos', 'jobPersistence', 0],
      ['saveJobOnly', 'jobPersistence', 2],
      ['reloadJobVideos', 'jobPersistence', 1],
      ['addJob', 'jobLifecycle', 2],
      ['updateJob', 'jobLifecycle', 2],
      ['onJobEnded', 'jobLifecycle', 1],
      ['onJobAbandoned', 'jobLifecycle', 1],
      ['addOrUpdateJob', 'jobQueue', 3],
      ['startNextJob', 'jobQueue', 0],
      ['failUnstartedJob', 'jobQueue', 2],
    ])('%s is answered by %s', async (method, ownerName, argCount) => {
      // Let the startup load and queue scan finish before swapping methods.
      await new Promise(resolve => setTimeout(resolve, 10));
      const owner = require(`../job/${ownerName}`);
      owner[method] = jest.fn().mockReturnValue('sentinel');

      const args = ['first', 'second', 'third'].slice(0, argCount);

      const result = await JobModule[method](...args);

      expect(result).toBe('sentinel');
      expect(owner[method]).toHaveBeenCalledWith(...args);
    });
  });
});
