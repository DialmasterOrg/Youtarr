/* eslint-env jest */

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

describe('jobPersistence', () => {
  let jobPersistence;
  let jobRegistry;
  let Job;
  let Video;
  let JobVideo;
  let ChannelVideo;
  let logger;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

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

  describe('getRunningJobsWithFreshVideos', () => {
    beforeEach(() => {
      jobRegistry = require('../jobRegistry');
      jobPersistence = require('../jobPersistence');
    });

    test('replaces snapshot videos with fresh rows from the Videos table', async () => {
      const now = Date.now();
      jobRegistry.replaceAll({
        'job-1': {
          timeCreated: now,
          status: 'Complete',
          data: {
            videos: [
              { id: 1, youtubeId: 'a', removed: false, protected: false, normalized_rating: null },
              { id: 2, youtubeId: 'b', removed: false, protected: false, normalized_rating: null }
            ]
          }
        }
      });

      Video.findAll.mockResolvedValueOnce([
        { id: 1, dataValues: { id: 1, youtubeId: 'a', removed: true, protected: false, normalized_rating: null } },
        { id: 2, dataValues: { id: 2, youtubeId: 'b', removed: false, protected: true, normalized_rating: 'PG-13' } }
      ]);

      const result = await jobPersistence.getRunningJobsWithFreshVideos();

      expect(Video.findAll).toHaveBeenCalledWith({ where: { id: [1, 2] } });
      expect(result[0].data.videos[0]).toMatchObject({ id: 1, removed: true });
      expect(result[0].data.videos[1]).toMatchObject({ id: 2, protected: true, normalized_rating: 'PG-13' });
    });

    test('falls back to snapshot when a video row is missing from the DB', async () => {
      const now = Date.now();
      jobRegistry.replaceAll({
        'job-1': {
          timeCreated: now,
          status: 'Complete',
          data: {
            videos: [
              { id: 1, youtubeId: 'a', removed: false },
              { id: 99, youtubeId: 'gone', removed: false }
            ]
          }
        }
      });

      Video.findAll.mockResolvedValueOnce([
        { id: 1, dataValues: { id: 1, youtubeId: 'a', removed: true } }
      ]);

      const result = await jobPersistence.getRunningJobsWithFreshVideos();

      expect(result[0].data.videos[0]).toMatchObject({ id: 1, removed: true });
      expect(result[0].data.videos[1]).toMatchObject({ id: 99, youtubeId: 'gone', removed: false });
    });

    test('skips DB query when no videos have ids', async () => {
      const now = Date.now();
      jobRegistry.replaceAll({
        'job-1': { timeCreated: now, status: 'Complete', data: { videos: [] } },
        'job-2': { timeCreated: now, status: 'Complete' }
      });

      const result = await jobPersistence.getRunningJobsWithFreshVideos();

      expect(Video.findAll).not.toHaveBeenCalled();
      expect(result).toHaveLength(2);
    });

    test('does not mutate the in-memory jobs structure', async () => {
      const now = Date.now();
      const originalVideo = { id: 1, youtubeId: 'a', removed: false };
      jobRegistry.replaceAll({
        'job-1': {
          timeCreated: now,
          status: 'Complete',
          data: { videos: [originalVideo] }
        }
      });

      Video.findAll.mockResolvedValueOnce([
        { id: 1, dataValues: { id: 1, youtubeId: 'a', removed: true } }
      ]);

      await jobPersistence.getRunningJobsWithFreshVideos();

      expect(jobRegistry.jobs['job-1'].data.videos[0]).toBe(originalVideo);
      expect(jobRegistry.jobs['job-1'].data.videos[0].removed).toBe(false);
    });
  });

  describe('saveJobOnly', () => {
    beforeEach(() => {
      jobRegistry = require('../jobRegistry');
      jobPersistence = require('../jobPersistence');
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

      await jobPersistence.saveJobOnly('job-1', jobData);

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

      await jobPersistence.saveJobOnly('job-1', jobData);

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

      await jobPersistence.saveJobOnly('job-1', jobData);

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
      jobRegistry = require('../jobRegistry');
      jobPersistence = require('../jobPersistence');
    });

    test('should create new job in database', async () => {
      jobRegistry.replaceAll({
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
      });

      Job.findOne.mockResolvedValue(null);

      await jobPersistence.saveJobs();

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
      expect(jobPersistence.isSaving).toBe(false);
    });

    test('should update existing job in database', async () => {
      const mockJobInstance = {
        update: jest.fn()
      };
      Job.findOne.mockResolvedValue(mockJobInstance);

      jobRegistry.replaceAll({
        'job-1': {
          id: 'job-1',
          status: 'Complete',
          data: { videos: [] }
        }
      });

      await jobPersistence.saveJobs();

      expect(mockJobInstance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'job-1',
          status: 'Complete'
        })
      );
    });

    test('should upsert channel videos', async () => {
      jobRegistry.replaceAll({
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
      });

      Job.findOne.mockResolvedValue(null);
      Video.findOne.mockResolvedValue(null);

      await jobPersistence.saveJobs();

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

      jobRegistry.replaceAll({
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
      });

      Job.findOne.mockResolvedValue(null);
      Video.findOne.mockResolvedValue(mockVideoInstance);

      await jobPersistence.saveJobs();

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

      jobRegistry.replaceAll({
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
      });

      Job.findOne.mockResolvedValue(null);
      Video.findOne.mockResolvedValue(mockVideoInstance);

      await jobPersistence.saveJobs();

      const updateArgs = mockVideoInstance.update.mock.calls[0][0];
      expect(updateArgs.filePath).toBeUndefined();
      expect(updateArgs.fileSize).toBeUndefined();
      expect(updateArgs.removed).toBeUndefined();
      expect(updateArgs.last_downloaded_at).toBeUndefined();
    });

    test('should create new video when it does not exist in database', async () => {
      jobRegistry.replaceAll({
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
      });

      Job.findOne.mockResolvedValue(null);
      Video.findOne.mockResolvedValue(null);

      await jobPersistence.saveJobs();

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

  describe('loadJobsFromDB', () => {
    beforeEach(() => {
      jobRegistry = require('../jobRegistry');
      jobPersistence = require('../jobPersistence');
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
      Video.findAll.mockResolvedValue([mockVideo]);

      await jobPersistence.loadJobsFromDB();

      expect(jobRegistry.jobs['job-1']).toBeDefined();
      expect(jobRegistry.jobs['job-1'].data.videos).toHaveLength(1);
      expect(jobRegistry.jobs['job-1'].data.videos[0]).toEqual(mockVideo.dataValues);
    });

    test('keeps the current jobs when the database read fails', async () => {
      const current = { 'job-1': { status: 'Complete' } };
      jobRegistry.replaceAll(current);
      Job.findAll.mockRejectedValue(new Error('DB Error'));

      await jobPersistence.loadJobsFromDB();

      expect(jobRegistry.jobs).toBe(current);
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
      Video.findAll.mockResolvedValue([]);

      await jobPersistence.loadJobsFromDB();

      expect(jobRegistry.jobs['job-1'].data.videos).toHaveLength(0);
    });
  });

  describe('aux data persistence', () => {
    beforeEach(() => {
      jobRegistry = require('../jobRegistry');
      jobPersistence = require('../jobPersistence');
    });

    test('saveJobOnly writes failedVideos into aux_data and strips them from the row payload', async () => {
      const jobInstance = { update: jest.fn().mockResolvedValue() };
      Job.findOne.mockResolvedValue(jobInstance);

      await jobPersistence.saveJobOnly('job-1', {
        id: 'job-1',
        status: 'Complete',
        jobType: 'Channel Downloads',
        data: {
          videos: [],
          failedVideos: [{ youtubeId: 'abc123def45', error: 'HTTP Error 403: Forbidden' }],
          diagnoses: [{ key: 'http-403-no-cookies' }]
        }
      });

      const written = jobInstance.update.mock.calls[0][0];
      expect(written.data).toBeUndefined();
      expect(JSON.parse(written.aux_data).failedVideos).toHaveLength(1);
      expect(JSON.parse(written.aux_data).diagnoses).toHaveLength(1);
    });

    test('saveJobOnly writes null aux_data when data holds only videos', async () => {
      const jobInstance = { update: jest.fn().mockResolvedValue() };
      Job.findOne.mockResolvedValue(jobInstance);

      await jobPersistence.saveJobOnly('job-2', {
        id: 'job-2',
        status: 'Complete',
        jobType: 'Channel Downloads',
        data: { videos: [] }
      });

      expect(jobInstance.update.mock.calls[0][0].aux_data).toBeNull();
    });

    test('loadJobsFromDB restores failedVideos from aux_data and drops the raw column', async () => {
      Job.findAll.mockResolvedValue([{
        id: 'job-3',
        dataValues: {
          id: 'job-3',
          status: 'Complete',
          jobType: 'Channel Downloads',
          aux_data: JSON.stringify({ failedVideos: [{ youtubeId: 'abc123def45', error: 'err' }] })
        }
      }]);
      JobVideo.findAll.mockResolvedValue([]);

      await jobPersistence.loadJobsFromDB();

      const job = jobRegistry.jobs['job-3'];
      expect(job.data.failedVideos).toEqual([{ youtubeId: 'abc123def45', error: 'err' }]);
      expect(job.data.videos).toEqual([]);
      expect(job.aux_data).toBeUndefined();
    });

    test('loadJobsFromDB tolerates malformed aux_data', async () => {
      Job.findAll.mockResolvedValue([{
        id: 'job-4',
        dataValues: { id: 'job-4', status: 'Complete', jobType: 'Channel Downloads', aux_data: '{broken' }
      }]);
      JobVideo.findAll.mockResolvedValue([]);

      await jobPersistence.loadJobsFromDB();

      expect(jobRegistry.jobs['job-4'].data).toEqual({ videos: [] });
    });
  });

  describe('reloadJobVideos', () => {
    beforeEach(() => {
      jobRegistry = require('../jobRegistry');
      jobPersistence = require('../jobPersistence');
    });

    test('replaces each named job\'s videos with the rows still linked to it', async () => {
      jobRegistry.replaceAll({
        'job-1': { timeCreated: Date.now(), status: 'Complete', data: { videos: [{ id: 1 }, { id: 2 }] } },
        'job-2': { timeCreated: Date.now(), status: 'Complete', data: { videos: [{ id: 3 }] } },
      });
      JobVideo.findAll.mockImplementation(async ({ where }) => (where.job_id === 'job-1' ? [{ video_id: 2 }] : []));
      Video.findAll.mockResolvedValue([{ id: 2, dataValues: { id: 2, youtubeId: 'b' } }]);

      await jobPersistence.reloadJobVideos(['job-1', 'job-2']);

      expect(jobRegistry.jobs['job-1'].data.videos).toEqual([{ id: 2, youtubeId: 'b' }]);
      expect(jobRegistry.jobs['job-2'].data.videos).toEqual([]);
    });

    test('skips jobs it does not hold and never throws', async () => {
      jobRegistry.replaceAll({ 'job-1': { timeCreated: Date.now(), status: 'Complete', data: { videos: [{ id: 1 }] } } });
      JobVideo.findAll.mockRejectedValue(new Error('db down'));

      await expect(jobPersistence.reloadJobVideos(['job-1', 'unknown'])).resolves.toBeUndefined();

      expect(jobRegistry.jobs['job-1'].data.videos).toEqual([{ id: 1 }]);
      expect(JobVideo.findAll).toHaveBeenCalledWith({ where: { job_id: 'job-1' } });
      expect(JobVideo.findAll).not.toHaveBeenCalledWith({ where: { job_id: 'unknown' } });
    });
  });

  describe('save lock', () => {
    beforeEach(() => {
      jobRegistry = require('../jobRegistry');
      jobPersistence = require('../jobPersistence');
    });

    test('a second saveJobs call during a save does not touch the database', async () => {
      jobRegistry.replaceAll({ 'job-1': { status: 'In Progress', jobType: 'x' } });
      let releaseFind;
      Job.findOne.mockReturnValueOnce(new Promise((resolve) => { releaseFind = () => resolve(null); }));

      const first = jobPersistence.saveJobs();
      await jobPersistence.saveJobs();
      expect(Job.findOne).toHaveBeenCalledTimes(1);

      releaseFind();
      await first;
    });

    test('the lock is free again after a job row write fails', async () => {
      jobRegistry.replaceAll({ 'job-1': { status: 'In Progress', jobType: 'x' } });
      Job.findOne.mockRejectedValueOnce(new Error('db down'));
      await jobPersistence.saveJobs();

      Job.findOne.mockResolvedValue(null);
      await jobPersistence.saveJobs();
      expect(Job.create).toHaveBeenCalledTimes(1);
    });

    test('keeps saving the remaining jobs after one job fails', async () => {
      jobRegistry.replaceAll({
        'job-1': { id: 'job-1', status: 'In Progress', jobType: 'x' },
        'job-2': { id: 'job-2', status: 'In Progress', jobType: 'x' },
      });
      Job.findOne.mockRejectedValueOnce(new Error('db down')).mockResolvedValue(null);

      await jobPersistence.saveJobs();

      expect(Job.create).toHaveBeenCalledTimes(1);
      expect(Job.create).toHaveBeenCalledWith(expect.objectContaining({ id: 'job-2' }));
    });

    test('finishes without an error when the jobs map is replaced during the pass', async () => {
      jobRegistry.replaceAll({
        'job-1': { id: 'job-1', status: 'In Progress', jobType: 'x' },
        'job-2': { id: 'job-2', status: 'In Progress', jobType: 'x' },
      });
      Job.findOne.mockImplementationOnce(async () => {
        jobRegistry.replaceAll({});
        return null;
      });

      await expect(jobPersistence.saveJobs()).resolves.toBeUndefined();

      expect(Job.create).toHaveBeenCalledTimes(1);
      expect(jobPersistence.isSaving).toBe(false);
    });
  });

  describe('saveJobs and completed jobs', () => {
    const video = { youtubeId: 'v1', youTubeVideoName: 'T', channel_id: 'c1' };

    beforeEach(() => {
      jobRegistry = require('../jobRegistry');
      jobPersistence = require('../jobPersistence');
    });

    test('does not rewrite the videos of a completed job', async () => {
      jobRegistry.replaceAll({ 'job-1': { status: 'Complete', jobType: 'x', data: { videos: [video] } } });
      await jobPersistence.saveJobs();
      expect(Video.findOne).not.toHaveBeenCalled();
    });

    test('does not rewrite the videos of a Failed job', async () => {
      jobRegistry.replaceAll({ 'job-1': { status: 'Failed', jobType: 'x', data: { videos: [video] } } });
      await jobPersistence.saveJobs();
      expect(Video.findOne).not.toHaveBeenCalled();
    });
  });

  describe('loading videos in batches', () => {
    beforeEach(() => {
      jobRegistry = require('../jobRegistry');
      jobPersistence = require('../jobPersistence');
    });

    test('loadJobVideos keeps jobvideos order, skips missing rows, and reads them in one query', async () => {
      JobVideo.findAll.mockResolvedValue([{ video_id: 3 }, { video_id: 9 }, { video_id: 1 }]);
      Video.findAll.mockResolvedValue([
        { id: 1, dataValues: { id: 1, youtubeId: 'a' } },
        { id: 3, dataValues: { id: 3, youtubeId: 'c' } },
      ]);

      const videos = await jobPersistence.loadJobVideos('job-1');

      expect(videos.map((v) => v.id)).toEqual([3, 1]);
      expect(Video.findAll).toHaveBeenCalledTimes(1);
      expect(Video.findAll).toHaveBeenCalledWith({ where: { id: [3, 9, 1] } });
      expect(Video.findOne).not.toHaveBeenCalled();
    });

    test('loadJobVideos makes no video query for a job with no links', async () => {
      JobVideo.findAll.mockResolvedValue([]);

      expect(await jobPersistence.loadJobVideos('job-1')).toEqual([]);
      expect(Video.findAll).not.toHaveBeenCalled();
    });

    test('loadJobsFromDB reads more than 500 linked videos in two queries', async () => {
      Job.findAll.mockResolvedValue([{ id: 'job-1', dataValues: { id: 'job-1', status: 'Complete' } }]);
      JobVideo.findAll.mockResolvedValue(Array.from({ length: 501 }, (_, i) => ({ job_id: 'job-1', video_id: i + 1 })));
      Video.findAll.mockImplementation(async ({ where }) => where.id.map((id) => ({ id, dataValues: { id } })));

      await jobPersistence.loadJobsFromDB();

      expect(Video.findAll).toHaveBeenCalledTimes(2);
      expect(jobRegistry.jobs['job-1'].data.videos).toHaveLength(501);
    });

    test('keeps the videos from every batch that loaded when one batch fails', async () => {
      Job.findAll.mockResolvedValue([{ id: 'job-1', dataValues: { id: 'job-1', status: 'Complete' } }]);
      JobVideo.findAll.mockResolvedValue(Array.from({ length: 1001 }, (_, i) => ({ job_id: 'job-1', video_id: i + 1 })));
      const rowsFor = async ({ where }) => where.id.map((id) => ({ id, dataValues: { id } }));
      Video.findAll
        .mockImplementationOnce(rowsFor)
        .mockRejectedValueOnce(new Error('db down'))
        .mockImplementationOnce(rowsFor);

      await jobPersistence.loadJobsFromDB();

      const ids = jobRegistry.jobs['job-1'].data.videos.map((v) => v.id);
      expect(ids).toHaveLength(501);
      expect(ids[0]).toBe(1);
      expect(ids[499]).toBe(500);
      expect(ids[500]).toBe(1001);
      expect(logger.error).toHaveBeenCalled();
    });

    test('two jobs linked to the same video get separate objects', async () => {
      Job.findAll.mockResolvedValue([
        { id: 'job-1', dataValues: { id: 'job-1', status: 'Complete' } },
        { id: 'job-2', dataValues: { id: 'job-2', status: 'Complete' } },
      ]);
      JobVideo.findAll.mockResolvedValue([{ job_id: 'job-1', video_id: 5 }, { job_id: 'job-2', video_id: 5 }]);
      Video.findAll.mockResolvedValue([{ id: 5, dataValues: { id: 5, youtubeId: 'e' } }]);

      await jobPersistence.loadJobsFromDB();

      const [first] = jobRegistry.jobs['job-1'].data.videos;
      const [second] = jobRegistry.jobs['job-2'].data.videos;
      expect(first).toEqual(second);
      expect(first).not.toBe(second);
    });
  });

  describe('write order for one job', () => {
    beforeEach(() => {
      jobRegistry = require('../jobRegistry');
      jobPersistence = require('../jobPersistence');
    });

    test('a bulk save stalled on a job cannot overwrite the final status written after it', async () => {
      const persisted = [];
      const row = { id: 'job-a', update: jest.fn(async (data) => { persisted.push(data.status); }) };
      const jobA = { id: 'job-a', status: 'In Progress', jobType: 'Manually Added Urls', data: { videos: [] } };
      jobRegistry.replaceAll({ 'job-a': jobA });
      let releaseBulk;
      Job.findOne
        .mockReturnValueOnce(new Promise((resolve) => { releaseBulk = () => resolve(row); }))
        .mockResolvedValue(row);

      const bulk = jobPersistence.saveJobs();
      jobA.status = 'Complete';
      const final = jobPersistence.saveCompletedJob('job-a', jobA);
      await new Promise(setImmediate);

      releaseBulk();
      await Promise.all([bulk, final]);

      expect(persisted[persisted.length - 1]).toBe('Complete');
    });

    test('an older In Progress update that lands after the final save does not replace the final status', async () => {
      const { Op } = require('sequelize');
      // A stand-in for the jobs row: the first write to reach it is held open, like an
      // UPDATE waiting on another connection, and a conditional update checks the row
      // only when it finally applies.
      const stored = { status: 'Pending' };
      let writes = 0;
      let releaseFirstWrite;
      const reachDatabase = () => {
        writes += 1;
        return writes === 1 ? new Promise((resolve) => { releaseFirstWrite = resolve; }) : Promise.resolve();
      };
      const row = {
        id: 'job-a',
        update: jest.fn(async (data) => {
          await reachDatabase();
          stored.status = data.status;
        }),
      };
      Job.findOne.mockResolvedValue(row);
      Job.update = jest.fn(async (data, { where }) => {
        await reachDatabase();
        const excluded = where.status ? where.status[Op.notIn] : [];
        if (excluded.includes(stored.status)) return [0];
        stored.status = data.status;
        return [1];
      });
      const jobA = { id: 'job-a', status: 'In Progress', jobType: 'Manually Added Urls', data: { videos: [] } };
      jobRegistry.replaceAll({ 'job-a': jobA });

      const bulk = jobPersistence.saveJobs();
      await new Promise(setImmediate);
      jobA.status = 'Complete';
      await jobPersistence.saveCompletedJob('job-a', jobA);
      expect(stored.status).toBe('Complete');

      releaseFirstWrite();
      await bulk;

      expect(stored.status).toBe('Complete');
    });

    test('a non-final save still updates a row that is not final', async () => {
      const { Op } = require('sequelize');
      Job.findOne.mockResolvedValue({ id: 'job-1', update: jest.fn() });
      const job = { id: 'job-1', status: 'In Progress', jobType: 'Manually Added Urls', output: 'working' };
      jobRegistry.replaceAll({ 'job-1': job });

      await jobPersistence.saveJobs();

      expect(Job.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'In Progress', output: 'working' }),
        { where: { id: 'job-1', status: { [Op.notIn]: ['Complete', 'Complete with Warnings', 'Error', 'Failed', 'Terminated', 'Killed'] } } }
      );
    });

    test('a write for a job does not wait behind an earlier write for it that never returns', async () => {
      const job = { id: 'job-1', status: 'Complete', jobType: 'Manually Added Urls', data: { videos: [] } };
      jobRegistry.replaceAll({ 'job-1': job });
      Job.findOne.mockReturnValueOnce(new Promise(() => {})).mockResolvedValue(null);

      jobPersistence.saveJobOnly('job-1', job);
      const outcome = await Promise.race([
        jobPersistence.saveJobOnly('job-1', job).then(() => 'saved'),
        new Promise((resolve) => setTimeout(() => resolve('still waiting'), 200)),
      ]);

      expect(outcome).toBe('saved');
      expect(Job.create).toHaveBeenCalledTimes(1);
    });

    test('a failed write for a job does not stop a later write for it', async () => {
      const job = { id: 'job-1', status: 'Complete', jobType: 'Manually Added Urls', data: { videos: [] } };
      jobRegistry.replaceAll({ 'job-1': job });
      let failFirst;
      Job.findOne
        .mockReturnValueOnce(new Promise((resolve, reject) => { failFirst = () => reject(new Error('db down')); }))
        .mockResolvedValue(null);

      const first = jobPersistence.saveJobOnly('job-1', job);
      const second = jobPersistence.saveJobOnly('job-1', job);
      failFirst();
      await Promise.all([first, second]);

      expect(Job.create).toHaveBeenCalledTimes(1);
    });

    test('writes for different jobs do not wait for each other', async () => {
      jobRegistry.replaceAll({});
      Job.findOne
        .mockReturnValueOnce(new Promise(() => {}))
        .mockResolvedValue(null);

      jobPersistence.saveJobOnly('job-1', { id: 'job-1', status: 'Complete' });
      await jobPersistence.saveJobOnly('job-2', { id: 'job-2', status: 'Complete' });

      expect(Job.create).toHaveBeenCalledWith(expect.objectContaining({ id: 'job-2' }));
    });
  });

  describe('final save retry', () => {
    const makeJob = (overrides = {}) => ({
      id: 'job-1', status: 'Complete', jobType: 'Manually Added Urls', data: { videos: [] }, ...overrides,
    });

    beforeEach(() => {
      jest.useFakeTimers();
      jobRegistry = require('../jobRegistry');
      jobPersistence = require('../jobPersistence');
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('writes the job row again 1 s after a failed final save', async () => {
      const job = makeJob();
      jobRegistry.replaceAll({ 'job-1': job });
      Job.findOne.mockRejectedValueOnce(new Error('db down')).mockResolvedValue(null);

      await jobPersistence.saveCompletedJob('job-1', job);
      expect(Job.create).not.toHaveBeenCalled();

      await jest.advanceTimersByTimeAsync(999);
      expect(Job.create).not.toHaveBeenCalled();
      await jest.advanceTimersByTimeAsync(1);

      expect(Job.create).toHaveBeenCalledWith(expect.objectContaining({ id: 'job-1', status: 'Complete' }));
      expect(jest.getTimerCount()).toBe(0);
    });

    test('gives up after three retries, at 1, 2 and 3 s', async () => {
      const job = makeJob();
      jobRegistry.replaceAll({ 'job-1': job });
      Job.findOne.mockRejectedValue(new Error('db down'));

      await jobPersistence.saveCompletedJob('job-1', job);
      await jest.advanceTimersByTimeAsync(1000);
      expect(Job.findOne).toHaveBeenCalledTimes(2);
      await jest.advanceTimersByTimeAsync(2000);
      expect(Job.findOne).toHaveBeenCalledTimes(3);
      await jest.advanceTimersByTimeAsync(3000);

      expect(Job.findOne).toHaveBeenCalledTimes(4);
      expect(jest.getTimerCount()).toBe(0);
    });

    test('retries the job while a bulk save is still running', async () => {
      const jobA = makeJob({ id: 'job-a', status: 'In Progress' });
      const jobB = makeJob({ id: 'job-b', status: 'In Progress' });
      jobRegistry.replaceAll({ 'job-a': jobA, 'job-b': jobB });
      let releaseBulk;
      Job.findOne
        .mockResolvedValueOnce(null) // bulk save writes job-a with its old status
        .mockReturnValueOnce(new Promise((resolve) => { releaseBulk = () => resolve(null); })) // and hangs on job-b
        .mockRejectedValueOnce(new Error('db down')) // job-a's final write fails
        .mockResolvedValue(null);

      const bulk = jobPersistence.saveJobs();
      await jest.advanceTimersByTimeAsync(0);
      jobA.status = 'Complete';
      await jobPersistence.saveCompletedJob('job-a', jobA);

      await jest.advanceTimersByTimeAsync(1000);

      expect(jobPersistence.isSaving).toBe(true);
      expect(Job.create).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'job-a', status: 'Complete' }));

      releaseBulk();
      await bulk;
    });

    test('a retry leaves video rows alone, so a change made during the backoff survives', async () => {
      const videoRow = { id: 7, youtubeId: 'v1', protected: true, update: jest.fn() };
      const job = makeJob({
        data: { videos: [{ id: 7, youtubeId: 'v1', protected: false, filePath: '/videos/a.mp4', fileSize: '10' }] },
      });
      jobRegistry.replaceAll({ 'job-1': job });
      Job.findOne.mockRejectedValueOnce(new Error('db down')).mockResolvedValue(null);
      Video.findOne.mockResolvedValue(videoRow);

      await jobPersistence.saveCompletedJob('job-1', job);
      await jest.advanceTimersByTimeAsync(1000);

      expect(Job.create).toHaveBeenCalledWith(expect.objectContaining({ id: 'job-1', status: 'Complete' }));
      expect(Video.findOne).not.toHaveBeenCalled();
      expect(videoRow.update).not.toHaveBeenCalled();
    });

    test('does not retry when the job row was written and only a video write failed', async () => {
      const job = makeJob({ data: { videos: [{ youtubeId: 'v1', youTubeVideoName: 'T', channel_id: 'c1' }] } });
      jobRegistry.replaceAll({ 'job-1': job });
      Video.findOne.mockRejectedValue(new Error('db down'));

      await jobPersistence.saveCompletedJob('job-1', job);

      expect(Job.create).toHaveBeenCalledTimes(1);
      expect(jest.getTimerCount()).toBe(0);
    });

    test('does not write a job that left memory before the retry', async () => {
      const job = makeJob();
      jobRegistry.replaceAll({ 'job-1': job });
      Job.findOne.mockRejectedValueOnce(new Error('db down')).mockResolvedValue(null);

      await jobPersistence.saveCompletedJob('job-1', job);
      jobRegistry.removeJob('job-1');
      await jest.advanceTimersByTimeAsync(1000);

      expect(Job.findOne).toHaveBeenCalledTimes(1);
      expect(jest.getTimerCount()).toBe(0);
    });

    test('saveJobOnly still resolves, without scheduling a retry, when the write fails', async () => {
      const job = makeJob();
      jobRegistry.replaceAll({ 'job-1': job });
      Job.findOne.mockRejectedValue(new Error('db down'));

      await expect(jobPersistence.saveJobOnly('job-1', job)).resolves.toBeUndefined();

      expect(jest.getTimerCount()).toBe(0);
    });
  });
});
