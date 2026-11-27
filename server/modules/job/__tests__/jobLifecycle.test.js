/* eslint-env jest */

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'generated-uuid'),
  validate: jest.requireActual('uuid').validate
}));
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

const { v4: uuidv4 } = require('uuid');

describe('jobLifecycle', () => {
  let jobLifecycle;
  let jobPersistence;
  let jobRegistry;
  let MessageEmitter;
  let Job;
  let Video;
  let JobVideo;
  let ChannelVideo;
  let logger;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    uuidv4.mockClear();
    uuidv4.mockReturnValue('generated-uuid');

    MessageEmitter = require('../../messageEmitter.js');
    MessageEmitter.emitMessage = jest.fn();

    logger = require('../../../logger');

    Job = require('../../../models/job');
    Video = require('../../../models/video');
    JobVideo = require('../../../models/jobvideo');
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

    ChannelVideo.findOrCreate = jest.fn().mockResolvedValue([{}, true]);
  });

  describe('addJob', () => {
    beforeEach(() => {
      jobRegistry = require('../jobRegistry');
      jobPersistence = require('../jobPersistence');
      jobLifecycle = require('../jobLifecycle');
      jobPersistence.saveJobs = jest.fn().mockResolvedValue();
    });

    test('claims video IDs before database creation yields to another submission', async () => {
      let finishCreate;
      Job.create.mockImplementationOnce(() => new Promise(resolve => { finishCreate = resolve; }));
      uuidv4.mockReturnValueOnce('first').mockReturnValueOnce('second');
      const first = jobLifecycle.addJob({ jobType: 'Manually Added Urls', data: { urls: ['https://youtu.be/aaaaaaaaaaa'] } });
      const second = await jobLifecycle.addJob({ jobType: 'Manually Added Urls', data: { urls: ['https://youtube.com/shorts/aaaaaaaaaaa'] } });
      expect(second).toBeNull();
      expect(Job.create).toHaveBeenCalledTimes(1);
      finishCreate({});
      await first;
    });

    test('uses a supplied UUID as the job id', async () => {
      const jobId = '9b89e5bc-8c90-4e72-b245-270fed2eacc2';
      await expect(jobLifecycle.addJob({
        jobType: 'Manually Added Urls', data: { urls: ['https://youtu.be/aaaaaaaaaaa'] },
      }, jobId)).resolves.toBe(jobId);
    });

    test('rejects a supplied job id that is not a UUID', async () => {
      await expect(jobLifecycle.addJob({
        jobType: 'Manually Added Urls', data: { urls: ['https://youtu.be/aaaaaaaaaaa'] },
      }, '../jobs')).rejects.toThrow('Preferred job id must be a UUID');
      expect(Job.create).not.toHaveBeenCalled();
    });

    test('rolls back queue ownership if creating the job fails', async () => {
      const activity = require('../../download/videoActivity');
      Job.create.mockRejectedValueOnce(new Error('offline'));
      await expect(jobLifecycle.addJob({
        jobType: 'Manually Added Urls', data: { urls: ['https://youtu.be/aaaaaaaaaaa'] },
      })).rejects.toThrow('offline');
      expect(activity.isActive('aaaaaaaaaaa')).toBe(false);
      expect(jobRegistry.jobs['generated-uuid']).toBeUndefined();
    });

    test('should create new job with generated UUID', async () => {
      const jobData = { jobType: 'download' };
      const result = await jobLifecycle.addJob(jobData);

      // The uuidv4 mock returns 'generated-uuid'
      expect(result).toBe('generated-uuid');
      expect(jobRegistry.jobs['generated-uuid']).toMatchObject({
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
      await expect(jobLifecycle.addJob(jobData)).rejects.toThrow('Save failed');

      expect(logger.error).toHaveBeenCalled();

    });

    test('should emit jobsUpdated broadcast after creating the job', async () => {
      const jobData = { jobType: 'Channel Downloads', status: 'Pending' };
      await jobLifecycle.addJob(jobData);

      expect(MessageEmitter.emitMessage).toHaveBeenCalledWith(
        'broadcast',
        null,
        'download',
        'jobsUpdated',
        { jobId: 'generated-uuid', status: 'Pending' }
      );
    });

    test('should not emit jobsUpdated when saving the job fails', async () => {
      Job.create.mockRejectedValue(new Error('Save failed'));

      await expect(jobLifecycle.addJob({ jobType: 'download' })).rejects.toThrow('Save failed');

      expect(MessageEmitter.emitMessage).not.toHaveBeenCalledWith(
        'broadcast',
        null,
        'download',
        'jobsUpdated',
        expect.anything()
      );
    });
  });

  describe('updateJob', () => {
    beforeEach(() => {
      jobRegistry = require('../jobRegistry');
      jobPersistence = require('../jobPersistence');
      jobLifecycle = require('../jobLifecycle');
      jobPersistence.saveJobs = jest.fn().mockResolvedValue();
    });

    test('should update job fields', async () => {
      jobRegistry.replaceAll({
        'job-1': { status: 'In Progress', output: 'old' }
      });

      jobLifecycle.updateJob('job-1', { status: 'Pending', output: 'new' });

      // Wait for async save operation
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(jobRegistry.jobs['job-1']).toMatchObject({
        status: 'Pending',
        output: 'new'
      });
      expect(jobPersistence.saveJobs).toHaveBeenCalled();
    });

    test('should emit download complete message for completion statuses', async () => {
      jobRegistry.replaceAll({
        'job-1': { status: 'In Progress', jobType: 'Channel Downloads' }
      });

      jobPersistence.saveCompletedJob = jest.fn().mockResolvedValue();

      // Mock database calls for video reload logic
      const mockVideo1 = { id: 1, youtubeId: 'video1', dataValues: { id: 1, youtubeId: 'video1' } };
      const mockVideo2 = { id: 2, youtubeId: 'video2', dataValues: { id: 2, youtubeId: 'video2' } };
      JobVideo.findAll.mockResolvedValue([
        { job_id: 'job-1', video_id: 1 },
        { job_id: 'job-1', video_id: 2 }
      ]);
      Video.findAll.mockResolvedValue([mockVideo1, mockVideo2]);

      await jobLifecycle.updateJob('job-1', {
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
      expect(jobRegistry.jobs['job-1'].output).toBe('2 videos.');
      expect(jobPersistence.saveCompletedJob).toHaveBeenCalledWith('job-1', expect.any(Object));
    });

    test('ignores an update for a job it does not hold', async () => {
      jobRegistry.replaceAll({});
      jobPersistence.saveCompletedJob = jest.fn().mockResolvedValue();
      jobPersistence.saveJobs = jest.fn().mockResolvedValue();
      const listener = jest.fn();
      jobLifecycle.onJobEnded(listener);

      await jobLifecycle.updateJob('nonexistent', { status: 'Complete' });

      expect(logger.warn).toHaveBeenCalledWith('Job to update did not exist!');
      expect(jobPersistence.saveCompletedJob).not.toHaveBeenCalled();
      expect(jobPersistence.saveJobs).not.toHaveBeenCalled();
      expect(MessageEmitter.emitMessage).not.toHaveBeenCalled();
      expect(listener).not.toHaveBeenCalled();
    });

    test('should handle Terminated status without data.videos gracefully', async () => {
      jobRegistry.replaceAll({
        'job-1': { status: 'Pending', jobType: 'Channel Downloads' }
      });

      jobPersistence.saveCompletedJob = jest.fn().mockResolvedValue();

      // Update without data property (like when terminating a job with missing action)
      jobLifecycle.updateJob('job-1', {
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
      expect(jobRegistry.jobs['job-1'].status).toBe('Terminated');
      expect(jobRegistry.jobs['job-1'].output).toBe('Job could not be started after server restart');
      expect(jobPersistence.saveCompletedJob).toHaveBeenCalledWith('job-1', expect.any(Object));
    });

    test('should emit download complete with videos when data.videos is present', async () => {
      jobRegistry.replaceAll({
        'job-1': { status: 'In Progress', jobType: 'Channel Downloads', data: { videos: [] } }
      });

      jobPersistence.saveCompletedJob = jest.fn().mockResolvedValue();

      // Mock database calls for video reload logic
      const mockVideo1 = { id: 1, youtubeId: 'video1', dataValues: { id: 1, youtubeId: 'video1' } };
      const mockVideo2 = { id: 2, youtubeId: 'video2', dataValues: { id: 2, youtubeId: 'video2' } };
      const mockVideo3 = { id: 3, youtubeId: 'video3', dataValues: { id: 3, youtubeId: 'video3' } };
      JobVideo.findAll.mockResolvedValue([
        { job_id: 'job-1', video_id: 1 },
        { job_id: 'job-1', video_id: 2 },
        { job_id: 'job-1', video_id: 3 }
      ]);
      Video.findAll.mockResolvedValue([mockVideo1, mockVideo2, mockVideo3]);

      await jobLifecycle.updateJob('job-1', {
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
      expect(jobRegistry.jobs['job-1'].output).toBe('3 videos.');
    });

    test('keeps Error status for a failed download job', async () => {
      jobRegistry.replaceAll({
        'job-1': { status: 'In Progress', jobType: 'Channel Downloads', data: { videos: [] } }
      });
      jobPersistence.saveCompletedJob = jest.fn().mockResolvedValue();
      JobVideo.findAll.mockResolvedValue([]);

      await jobLifecycle.updateJob('job-1', {
        status: 'Error',
        output: 'Bot detection encountered. Please set cookies in your Configuration.',
        data: { videos: [] }
      });

      expect(jobRegistry.jobs['job-1'].status).toBe('Error');
    });

    test('keeps the failure output for a failed download job', async () => {
      jobRegistry.replaceAll({
        'job-1': { status: 'In Progress', jobType: 'Channel Downloads', data: { videos: [] } }
      });
      jobPersistence.saveCompletedJob = jest.fn().mockResolvedValue();
      JobVideo.findAll.mockResolvedValue([]);

      await jobLifecycle.updateJob('job-1', {
        status: 'Error',
        output: 'Output directory is not accessible: EACCES',
        data: { videos: [] }
      });

      expect(jobRegistry.jobs['job-1'].output).toBe('Output directory is not accessible: EACCES');
    });

    test('should preserve Complete with Warnings status for download jobs', async () => {
      jobRegistry.replaceAll({
        'job-1': { status: 'In Progress', jobType: 'Channel Downloads', data: { videos: [] } }
      });

      jobPersistence.saveCompletedJob = jest.fn().mockResolvedValue();
      const mockVideo = { id: 1, youtubeId: 'video1', dataValues: { id: 1, youtubeId: 'video1' } };
      JobVideo.findAll.mockResolvedValue([{ job_id: 'job-1', video_id: 1 }]);
      Video.findAll.mockResolvedValue([mockVideo]);

      await jobLifecycle.updateJob('job-1', {
        status: 'Complete with Warnings',
        data: { videos: ['video1'] },
        notes: 'Some videos failed (exit 1)'
      });

      // Wait for async save operation
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(jobRegistry.jobs['job-1'].status).toBe('Complete with Warnings');
      expect(jobRegistry.jobs['job-1'].output).toBe('1 videos.');
      expect(jobRegistry.jobs['job-1'].notes).toBe('Some videos failed (exit 1)');
      expect(jobPersistence.saveCompletedJob).toHaveBeenCalledWith(
        'job-1',
        expect.objectContaining({ status: 'Complete with Warnings' })
      );
    });

    test('should reload videos from database when job completes', async () => {
      jobRegistry.replaceAll({
        'job-1': {
          status: 'In Progress',
          jobType: 'Channel Downloads',
          data: { videos: ['incomplete-video'] } // This should be replaced by DB data
        }
      });

      jobPersistence.saveCompletedJob = jest.fn().mockResolvedValue();

      // Mock database calls for video reload logic
      const mockVideo1 = {
        id: 1,
        youtubeId: 'db-video-1',
        youTubeVideoName: 'Database Video 1',
        dataValues: { id: 1, youtubeId: 'db-video-1', youTubeVideoName: 'Database Video 1' }
      };
      const mockVideo2 = {
        id: 2,
        youtubeId: 'db-video-2',
        youTubeVideoName: 'Database Video 2',
        dataValues: { id: 2, youtubeId: 'db-video-2', youTubeVideoName: 'Database Video 2' }
      };

      JobVideo.findAll.mockResolvedValue([
        { job_id: 'job-1', video_id: 1 },
        { job_id: 'job-1', video_id: 2 }
      ]);
      Video.findAll.mockResolvedValue([mockVideo1, mockVideo2]);

      await jobLifecycle.updateJob('job-1', {
        status: 'Complete',
        data: { videos: ['old-video'] }
      });

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 10));

      // Verify videos were reloaded from database
      expect(JobVideo.findAll).toHaveBeenCalledWith({
        where: { job_id: 'job-1' }
      });
      expect(Video.findAll).toHaveBeenCalledWith({ where: { id: [1, 2] } });
      expect(jobRegistry.jobs['job-1'].data.videos).toHaveLength(2);
      expect(jobRegistry.jobs['job-1'].data.videos[0]).toEqual(mockVideo1.dataValues);
      expect(jobRegistry.jobs['job-1'].data.videos[1]).toEqual(mockVideo2.dataValues);
      expect(jobRegistry.jobs['job-1'].output).toBe('2 videos.');
      expect(logger.info).toHaveBeenCalledWith(
        { jobId: 'job-1', videoCount: 2 },
        'Reloaded videos from database for completed job'
      );
    });

    test('should handle video reload errors gracefully', async () => {
      jobRegistry.replaceAll({
        'job-1': { status: 'In Progress', jobType: 'Channel Downloads', data: { videos: [] } }
      });

      jobPersistence.saveCompletedJob = jest.fn().mockResolvedValue();

      // Mock database error
      JobVideo.findAll.mockRejectedValue(new Error('Database connection failed'));

      await jobLifecycle.updateJob('job-1', {
        status: 'Complete',
        data: { videos: [] }
      });

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 10));

      // Should log error but continue with save
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          err: expect.any(Error),
          jobId: 'job-1'
        }),
        'Error loading videos from database for completed job'
      );
      expect(jobPersistence.saveCompletedJob).toHaveBeenCalled();
    });

    test('reloads the videos of a Terminated job but keeps its output', async () => {
      jobRegistry.replaceAll({
        'job-1': { status: 'In Progress', jobType: 'Channel Downloads', data: { videos: [] } }
      });

      jobPersistence.saveCompletedJob = jest.fn().mockResolvedValue();

      // Mock database calls
      JobVideo.findAll.mockResolvedValue([
        { job_id: 'job-1', video_id: 1 }
      ]);
      const mockVideo = { id: 1, youtubeId: 'video1', dataValues: { id: 1, youtubeId: 'video1' } };
      Video.findAll.mockResolvedValue([mockVideo]);

      await jobLifecycle.updateJob('job-1', {
        status: 'Terminated',
        output: 'Job terminated by user'
      });

      // Videos should be reloaded (for accurate count)
      expect(jobRegistry.jobs['job-1'].data.videos).toEqual([mockVideo.dataValues]);
      // But output should not be modified for Terminated status
      expect(jobRegistry.jobs['job-1'].output).toBe('Job terminated by user');
    });

    test('should preserve output for completed non-download jobs (Import Subscriptions)', async () => {
      const importResults = JSON.stringify([
        { channelId: 'UC1', title: 'Channel One', state: 'success' },
        { channelId: 'UC2', title: 'Channel Two', state: 'success' }
      ]);
      jobRegistry.replaceAll({
        'job-1': { status: 'In Progress', jobType: 'Import Subscriptions' }
      });

      jobPersistence.saveCompletedJob = jest.fn().mockResolvedValue();

      await jobLifecycle.updateJob('job-1', {
        status: 'Complete',
        output: importResults
      });

      // Wait for async save operation
      await new Promise(resolve => setTimeout(resolve, 10));

      // The import job's JSON results must survive: the download-only video
      // reload block must not run and overwrite output with "N videos."
      expect(jobRegistry.jobs['job-1'].output).toBe(importResults);
      expect(jobRegistry.jobs['job-1'].output).not.toMatch(/^\d+ videos\.$/);
      expect(jobPersistence.saveCompletedJob).toHaveBeenCalledWith('job-1', expect.any(Object));
    });

    test('gives a Failed job the same final handling as any other final status', async () => {
      const videoActivity = require('../../download/videoActivity');
      jest.spyOn(videoActivity, 'finishJob');
      jobPersistence.saveCompletedJob = jest.fn().mockResolvedValue();
      jobPersistence.saveJobs = jest.fn().mockResolvedValue();
      jobRegistry.replaceAll({ 'job-1': { status: 'In Progress', jobType: 'Channel Downloads', data: {} } });

      await jobLifecycle.updateJob('job-1', { status: 'Failed', output: 'Error: no channels' });

      expect(videoActivity.finishJob).toHaveBeenCalledWith('job-1');
      expect(JobVideo.findAll).toHaveBeenCalledWith({ where: { job_id: 'job-1' } });
      expect(jobPersistence.saveCompletedJob).toHaveBeenCalledWith('job-1', expect.objectContaining({ status: 'Failed' }));
      expect(jobPersistence.saveJobs).not.toHaveBeenCalled();
      expect(jobRegistry.jobs['job-1'].output).toBe('Error: no channels');
    });
  });

  describe('job ended listeners', () => {
    beforeEach(() => {
      jobRegistry = require('../jobRegistry');
      jobPersistence = require('../jobPersistence');
      jobLifecycle = require('../jobLifecycle');
    });

    test('tells listeners when a job gets a final status, before its videos are reloaded', async () => {
      const listener = jest.fn();
      jobLifecycle.onJobEnded(listener);
      jobRegistry.replaceAll({ 'job-1': { status: 'In Progress', jobType: 'Manually Added Urls', data: {} } });

      const update = jobLifecycle.updateJob('job-1', { status: 'Error', output: 'boom' });

      expect(listener).toHaveBeenCalledWith({ jobId: 'job-1' });
      await update;
    });

    test('does not tell listeners about a status that is not final', async () => {
      const listener = jest.fn();
      jobLifecycle.onJobEnded(listener);
      jobRegistry.replaceAll({ 'job-1': { status: 'Pending', jobType: 'Manually Added Urls', data: {} } });

      await jobLifecycle.updateJob('job-1', { status: 'In Progress' });

      expect(listener).not.toHaveBeenCalled();
    });

    test('a listener that throws does not stop the others', async () => {
      jobRegistry.replaceAll({ 'job-1': { status: 'In Progress', jobType: 'Import Subscriptions' } });
      jobPersistence.saveCompletedJob = jest.fn().mockResolvedValue();
      const second = jest.fn();
      jobLifecycle.onJobEnded(() => { throw new Error('boom'); });
      jobLifecycle.onJobEnded(second);

      await jobLifecycle.updateJob('job-1', { status: 'Complete' });

      expect(second).toHaveBeenCalledWith({ jobId: 'job-1' });
    });

    test('an unsubscribed listener is not told', async () => {
      jobRegistry.replaceAll({ 'job-1': { status: 'In Progress', jobType: 'Import Subscriptions' } });
      jobPersistence.saveCompletedJob = jest.fn().mockResolvedValue();
      const listener = jest.fn();
      jobLifecycle.onJobEnded(listener)();

      await jobLifecycle.updateJob('job-1', { status: 'Complete' });

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('final save, end to end', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jobRegistry = require('../jobRegistry');
      jobPersistence = require('../jobPersistence');
      jobLifecycle = require('../jobLifecycle');
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('a final status whose save fails reaches the database on the retry', async () => {
      jobRegistry.replaceAll({ 'job-1': { id: 'job-1', status: 'In Progress', jobType: 'Import Subscriptions' } });
      Job.findOne.mockRejectedValueOnce(new Error('db down')).mockResolvedValue(null);

      await jobLifecycle.updateJob('job-1', { status: 'Complete', output: 'done' });
      await jest.advanceTimersByTimeAsync(1000);

      expect(Job.create).toHaveBeenCalledWith(expect.objectContaining({ id: 'job-1', status: 'Complete', output: 'done' }));
    });
  });
});
