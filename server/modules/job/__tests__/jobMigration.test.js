/* eslint-env jest */

jest.mock('../../configModule');
jest.mock('../../../models/job');
jest.mock('../../../models/video');
jest.mock('../../../models/jobvideo');
jest.mock('../../../logger');

describe('jobMigration', () => {
  let jobMigration;
  let jobRegistry;
  let fs;
  let Job;
  let Video;
  let JobVideo;
  let logger;

  const jobsFilePath = '/test/jobs/jobs.json';
  const jobsFilePathOld = '/test/jobs/jobs.json.old';

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    jest.doMock('fs', () => ({
      existsSync: jest.fn().mockReturnValue(false),
      readFileSync: jest.fn(),
      renameSync: jest.fn()
    }));
    fs = require('fs');

    logger = require('../../../logger');

    jest.doMock('../../configModule', () => ({
      getJobsPath: jest.fn().mockReturnValue('/test/jobs')
    }));

    Job = require('../../../models/job');
    Video = require('../../../models/video');
    JobVideo = require('../../../models/jobvideo');

    Job.create = jest.fn().mockImplementation(data => Promise.resolve({ id: data.id, ...data }));
    Video.create = jest.fn().mockImplementation(data => Promise.resolve({ id: data.youtubeId, ...data }));
    JobVideo.create = jest.fn().mockResolvedValue({});
  });

  describe('migrateJobsFromFile', () => {
    beforeEach(() => {
      jobRegistry = require('../jobRegistry');
      jobMigration = require('../jobMigration');
    });

    test('should migrate jobs with videos from file to database', async () => {
      jobRegistry.replaceAll({
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
      });

      Job.create.mockResolvedValue({ id: 'job-1' });
      Video.create.mockResolvedValue({ id: 'video-1' });

      await jobMigration.migrateJobsFromFile();

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
      jobRegistry.replaceAll({
        'job-1': {
          id: 'job-1',
          status: 'Complete'
          // No data property
        }
      });

      await jobMigration.migrateJobsFromFile();

      expect(Job.create).not.toHaveBeenCalled();
    });

    test('keeps migrating the remaining jobs when one fails', async () => {
      jobRegistry.replaceAll({
        'job-1': {
          id: 'job-1',
          timeInitiated: '2024-01-01',
          timeCreated: '2024-01-01',
          data: { videos: [] }
        },
        'job-2': {
          id: 'job-2',
          timeInitiated: '2024-01-02',
          timeCreated: '2024-01-02',
          data: { videos: [{ youtubeId: 'video-2' }] }
        }
      });

      Job.create.mockRejectedValueOnce(new Error('Create failed'));

      await jobMigration.migrateJobsFromFile();

      expect(logger.error).toHaveBeenCalled();
      expect(Job.create).toHaveBeenCalledTimes(2);
      expect(JobVideo.create).toHaveBeenCalledWith({ job_id: 'job-2', video_id: 'video-2' });
    });
  });

  describe('migrateLegacyJobsFile', () => {
    const legacyJobs = {
      'job-1': {
        id: 'job-1',
        status: 'Complete',
        jobType: 'download',
        timeInitiated: 1704067200000,
        timeCreated: 1704067200000,
        data: { videos: [{ youtubeId: 'video-1' }] }
      }
    };

    beforeEach(() => {
      jobRegistry = require('../jobRegistry');
      jobMigration = require('../jobMigration');
    });

    test('returns null and reads nothing when there is no jobs.json', () => {
      const result = jobMigration.migrateLegacyJobsFile();

      expect(result).toBeNull();
      expect(fs.existsSync).toHaveBeenCalledWith(jobsFilePath);
      expect(fs.readFileSync).not.toHaveBeenCalled();
      expect(jobRegistry.jobs).toEqual({});
    });

    test('skips the migration and leaves the file in place when jobs.json cannot be parsed', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('{ not json');

      expect(jobMigration.migrateLegacyJobsFile()).toBeNull();

      expect(jobRegistry.jobs).toEqual({});
      expect(Job.create).not.toHaveBeenCalled();
      expect(fs.renameSync).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ err: expect.any(Error) }),
        'Could not read the legacy jobs.json; skipping its migration'
      );
    });

    test('loads jobs.json into the registry before the rename', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify(legacyJobs));

      jobMigration.migrateLegacyJobsFile();

      expect(fs.readFileSync).toHaveBeenCalledWith(jobsFilePath);
      expect(Object.keys(jobRegistry.jobs)).toEqual(['job-1']);
      expect(fs.renameSync).not.toHaveBeenCalled();
    });

    test('renames the file only after the last row is written', async () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify(legacyJobs));
      let finishLink;
      JobVideo.create.mockReturnValue(new Promise((resolve) => { finishLink = () => resolve({}); }));

      const migration = jobMigration.migrateLegacyJobsFile();
      await new Promise(setImmediate);

      expect(Job.create).toHaveBeenCalledWith(expect.objectContaining({ id: 'job-1', status: 'Complete' }));
      expect(JobVideo.create).toHaveBeenCalledWith({ job_id: 'job-1', video_id: 'video-1' });
      expect(fs.renameSync).not.toHaveBeenCalled();

      finishLink();
      await migration;

      expect(fs.renameSync).toHaveBeenCalledWith(jobsFilePath, jobsFilePathOld);
    });
  });
});
