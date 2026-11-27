/* eslint-env jest */

jest.mock('../../messageEmitter.js');
// videoPersistence reaches configModule; the real one watches config.json and keeps Jest from exiting.
jest.mock('../../configModule', () => ({
  getJobsPath: jest.fn().mockReturnValue('/test/jobs'),
  getConfig: jest.fn().mockReturnValue({}),
  onConfigChange: jest.fn(),
  directoryPath: '/test/output'
}));
jest.mock('../../../models/job');
jest.mock('../../../models/video');
jest.mock('../../../models/jobvideo');
jest.mock('../../../models/channelvideo');
jest.mock('../../channelVideoReanchor', () => ({
  applyExactDateForGroup: jest.fn().mockResolvedValue(undefined),
  applyExactDateForVideo: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../logger');
jest.mock('../../storageGuard', () => ({
  refresh: jest.fn().mockResolvedValue({ paused: false }),
  on: jest.fn()
}));

describe('jobQueue', () => {
  let jobQueue;
  let jobLifecycle;
  let jobRegistry;
  let MessageEmitter;
  let logger;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    MessageEmitter = require('../../messageEmitter.js');
    MessageEmitter.emitMessage = jest.fn();

    logger = require('../../../logger');
  });

  describe('startNextJob', () => {
    beforeEach(() => {
      jobRegistry = require('../jobRegistry');
      jobLifecycle = require('../jobLifecycle');
      jobQueue = require('../jobQueue');
    });

    test('should invoke action for first pending job', async () => {
      const mockAction = jest.fn();
      jobRegistry.replaceAll({
        'job-1': { status: 'Complete' },
        'job-2': { status: 'Pending', action: mockAction },
        'job-3': { status: 'Pending' }
      });

      await jobQueue.startNextJob();

      expect(logger.info).toHaveBeenCalledWith('Looking for next job to start');
      expect(mockAction).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'job-2', status: 'Pending' }),
        true
      );

    });

    test('starts nothing and changes no job when none is pending', async () => {
      jobLifecycle.updateJob = jest.fn();
      jobRegistry.replaceAll({
        'job-1': { status: 'Complete' },
        'job-2': { status: 'In Progress' }
      });

      await jobQueue.startNextJob();

      expect(jobLifecycle.updateJob).not.toHaveBeenCalled();
      expect(jobRegistry.jobs['job-1'].status).toBe('Complete');
      expect(jobRegistry.jobs['job-2'].status).toBe('In Progress');
    });

    test('should terminate job with missing action function and try next job', async () => {
      const mockAction = jest.fn();
      jobLifecycle.updateJob = jest.fn().mockResolvedValue();
      jobRegistry.replaceAll({
        'job-1': { status: 'Complete' },
        'job-2': { status: 'Pending', jobType: 'Manually Added Urls' }, // No action function
        'job-3': { status: 'Pending', action: mockAction, jobType: 'Channel Downloads' }
      });

      await jobQueue.startNextJob();

      expect(jobLifecycle.updateJob).toHaveBeenCalledWith('job-2', {
        status: 'Terminated',
        output: 'Job could not be started after server restart',
      });
      expect(mockAction).toHaveBeenCalledWith(expect.objectContaining({ id: 'job-3' }), true);
    });

    test('overlapping calls start a pending job only once', async () => {
      const mockAction = jest.fn();
      jobRegistry.replaceAll({ 'job-1': { status: 'Pending', action: mockAction } });

      await Promise.all([jobQueue.startNextJob(), jobQueue.startNextJob()]);

      expect(mockAction).toHaveBeenCalledTimes(1);
    });

    test('logs instead of rejecting when a started job action fails', async () => {
      jobRegistry.replaceAll({
        'job-1': { status: 'Pending', jobType: 'Channel Downloads', action: jest.fn().mockRejectedValue(new Error('boom')) }
      });

      await jobQueue.startNextJob();
      await new Promise(setImmediate);

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ jobId: 'job-1' }),
        'Failed to start queued job'
      );
    });

    test('marks a queued job whose action fails before it starts as an error and starts the next job', async () => {
      const nextAction = jest.fn();
      jobLifecycle.updateJob = jest.fn(async (id, updates) => Object.assign(jobRegistry.jobs[id], updates));
      jobRegistry.replaceAll({
        'job-1': { status: 'Pending', jobType: 'Channel Downloads', action: jest.fn().mockRejectedValue(new Error('boom')) },
        'job-2': { status: 'Pending', jobType: 'Playlist Downloads', action: nextAction },
      });

      await jobQueue.startNextJob();
      // The release and the second scan each await the storage check first.
      for (let tick = 0; tick < 10 && nextAction.mock.calls.length === 0; tick += 1) {
        await new Promise(setImmediate);
      }

      expect(jobLifecycle.updateJob).toHaveBeenCalledWith('job-1', {
        status: 'Error', output: 'Job could not be started: boom',
      });
      expect(nextAction).toHaveBeenCalledTimes(1);
    });

    test('tells listeners about a queued job abandoned before it started, with its run', async () => {
      const listener = jest.fn();
      jobLifecycle.onJobAbandoned(listener);
      jobLifecycle.updateJob = jest.fn(async (id, updates) => Object.assign(jobRegistry.jobs[id], updates));
      jobRegistry.replaceAll({
        'job-1': {
          status: 'Pending', jobType: 'Channel Downloads', data: { runId: 'run-1' },
          action: jest.fn().mockRejectedValue(new Error('boom')),
        },
      });

      await jobQueue.startNextJob();
      for (let tick = 0; tick < 10 && listener.mock.calls.length === 0; tick += 1) {
        await new Promise(setImmediate);
      }

      expect(listener).toHaveBeenCalledWith({ jobId: 'job-1', runId: 'run-1', reason: 'Job could not be started: boom' });
    });

    test('leaves a job the failing action already started to the download path', async () => {
      jobLifecycle.updateJob = jest.fn();
      const action = jest.fn(async () => {
        jobRegistry.jobs['job-1'].status = 'In Progress';
        throw new Error('boom');
      });
      jobRegistry.replaceAll({ 'job-1': { status: 'Pending', jobType: 'Channel Downloads', action } });

      await jobQueue.startNextJob();
      await new Promise(setImmediate);

      expect(jobLifecycle.updateJob).not.toHaveBeenCalled();
    });
  });

  describe('startNextJob while downloads are paused', () => {
    let storageGuard;

    beforeEach(() => {
      jobRegistry = require('../jobRegistry');
      jobLifecycle = require('../jobLifecycle');
      jobQueue = require('../jobQueue');
      storageGuard = require('../../storageGuard');
      jobQueue.listenForDownloadsResumed();
    });

    test('holds pending jobs while storage limits pause downloads', async () => {
      const mockAction = jest.fn();
      storageGuard.refresh.mockResolvedValueOnce({ paused: true });
      jobRegistry.replaceAll({ 'job-1': { status: 'Pending', action: mockAction } });

      await jobQueue.startNextJob();

      expect(mockAction).not.toHaveBeenCalled();
    });

    test('starts pending jobs when the pause check fails', async () => {
      const mockAction = jest.fn();
      storageGuard.refresh.mockRejectedValueOnce(new Error('check failed'));
      jobRegistry.replaceAll({ 'job-1': { status: 'Pending', action: mockAction } });

      await jobQueue.startNextJob();

      expect(mockAction).toHaveBeenCalled();
    });

    test('a resume during a running scan starts the pending job only once', async () => {
      const mockAction = jest.fn();
      jobRegistry.replaceAll({ 'job-1': { status: 'Pending', action: mockAction } });
      const onResumed = storageGuard.on.mock.calls.find(([event]) => event === 'resumed')[1];
      // The guard emits 'resumed' from inside the refresh startNextJob awaits.
      storageGuard.refresh.mockImplementationOnce(async () => {
        onResumed();
        return { paused: false };
      });

      await jobQueue.startNextJob();
      await new Promise(setImmediate);

      expect(mockAction).toHaveBeenCalledTimes(1);
    });

    test('a held job skipped by a resume during an import starts when the queue next advances', async () => {
      const mockAction = jest.fn();
      jobRegistry.replaceAll({
        'import-1': { status: 'In Progress', jobType: 'Import Subscriptions' },
        'job-1': { status: 'Pending', action: mockAction },
      });
      const onResumed = storageGuard.on.mock.calls.find(([event]) => event === 'resumed')[1];
      onResumed();
      await new Promise(setImmediate);
      expect(mockAction).not.toHaveBeenCalled();

      // The import finishes; subscriptionImport then advances the queue.
      jobRegistry.jobs['import-1'].status = 'Complete';
      await jobQueue.startNextJob();

      expect(mockAction).toHaveBeenCalledTimes(1);
    });

    test('starts held jobs when downloads resume', async () => {
      const mockAction = jest.fn();
      jobRegistry.replaceAll({ 'job-1': { status: 'Pending', action: mockAction } });
      const onResumed = storageGuard.on.mock.calls.find(([event]) => event === 'resumed')[1];

      onResumed();
      await new Promise(setImmediate);

      expect(mockAction).toHaveBeenCalled();
    });

    test('does not start another job on resume while one is running', async () => {
      const mockAction = jest.fn();
      jobRegistry.replaceAll({
        'job-1': { status: 'In Progress' },
        'job-2': { status: 'Pending', action: mockAction }
      });
      const onResumed = storageGuard.on.mock.calls.find(([event]) => event === 'resumed')[1];

      onResumed();
      await new Promise(setImmediate);

      expect(mockAction).not.toHaveBeenCalled();
    });
  });

  describe('addOrUpdateJob', () => {
    beforeEach(() => {
      jobRegistry = require('../jobRegistry');
      jobLifecycle = require('../jobLifecycle');
      jobQueue = require('../jobQueue');
      jobLifecycle.addJob = jest.fn().mockResolvedValue('new-job-id');
      jobLifecycle.updateJob = jest.fn();
    });

    test('should add pending job when job in progress exists', async () => {
      jobRegistry.replaceAll({
        'existing-job': { status: 'In Progress' }
      });

      const jobData = { jobType: 'download' };
      const result = await jobQueue.addOrUpdateJob(jobData);

      expect(jobLifecycle.addJob).toHaveBeenCalledWith(
        expect.objectContaining({ jobType: 'download', status: 'Pending' })
      );
      expect(result).toBe('new-job-id');
    });

    test('should add in progress job when no job in progress', async () => {
      jobRegistry.replaceAll({});

      const jobData = { jobType: 'download' };
      const result = await jobQueue.addOrUpdateJob(jobData);

      expect(jobLifecycle.addJob).toHaveBeenCalledWith(
        expect.objectContaining({ jobType: 'download', status: 'In Progress' })
      );
      expect(result).toBe('new-job-id');
    });

    test('should update next job to in progress when appropriate', async () => {
      jobRegistry.replaceAll({});

      const jobData = { id: 'next-job', jobType: 'download' };
      const result = await jobQueue.addOrUpdateJob(jobData, true);

      expect(jobLifecycle.updateJob).toHaveBeenCalledWith('next-job', {
        status: 'In Progress',
        timeInitiated: expect.any(Number)
      });
      expect(result).toBe('next-job');
    });

    test('should not start next job if job already in progress', async () => {
      jobRegistry.replaceAll({
        'existing-job': { status: 'In Progress' }
      });

      const jobData = { id: 'next-job', jobType: 'download' };
      const result = await jobQueue.addOrUpdateJob(jobData, true);

      expect(logger.warn).toHaveBeenCalled();
      expect(result).toBeUndefined();

    });

    test('should emit jobsUpdated when flipping next job to In Progress', async () => {
      jobRegistry.replaceAll({});

      const jobData = { id: 'next-job', jobType: 'download' };
      await jobQueue.addOrUpdateJob(jobData, true);

      expect(MessageEmitter.emitMessage).toHaveBeenCalledWith(
        'broadcast',
        null,
        'download',
        'jobsUpdated',
        { jobId: 'next-job', status: 'In Progress' }
      );
    });

    test('should not emit jobsUpdated when next job cannot start', async () => {
      jobRegistry.replaceAll({
        'existing-job': { status: 'In Progress' }
      });

      const jobData = { id: 'next-job', jobType: 'download' };
      await jobQueue.addOrUpdateJob(jobData, true);

      expect(MessageEmitter.emitMessage).not.toHaveBeenCalledWith(
        'broadcast',
        null,
        'download',
        'jobsUpdated',
        expect.anything()
      );
    });
  });
});
