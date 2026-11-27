/* eslint-env jest */

jest.mock('../../../logger');

describe('jobRegistry', () => {
  let jobRegistry;
  let logger;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    logger = require('../../../logger');
    jobRegistry = require('../jobRegistry');
  });

  describe('getInProgressJobId', () => {
    test('should return ID of In Progress job', () => {
      jobRegistry.replaceAll({
        'job-1': { status: 'Complete' },
        'job-2': { status: 'In Progress' },
        'job-3': { status: 'Pending' }
      });

      const result = jobRegistry.getInProgressJobId();
      expect(result).toBe('job-2');
    });

    test('should return null if no In Progress job', () => {
      jobRegistry.replaceAll({
        'job-1': { status: 'Complete' },
        'job-2': { status: 'Pending' }
      });

      const result = jobRegistry.getInProgressJobId();
      expect(result).toBeNull();
    });
  });

  describe('getJob', () => {
    test('should return job by ID', () => {
      const mockJob = { status: 'Complete', output: 'test' };
      jobRegistry.replaceAll({
        'job-1': mockJob
      });

      const result = jobRegistry.getJob('job-1');
      expect(result).toBe(mockJob);
    });

    test('should return undefined for non-existent job', () => {
      jobRegistry.replaceAll({});

      const result = jobRegistry.getJob('nonexistent');
      expect(result).toBeUndefined();
    });
  });

  describe('getRunningJobs', () => {
    test('should return empty array when no jobs', () => {
      jobRegistry.replaceAll(null);

      const result = jobRegistry.getRunningJobs();

      expect(result).toEqual([]);
      expect(logger.debug).toHaveBeenCalled();
    });

    test('should delete old jobs and return recent ones', () => {
      const now = Date.now();
      const oldTime = now - (50 * 24 * 60 * 60 * 1000); // 50 days ago
      const recentTime = now - (5 * 24 * 60 * 60 * 1000); // 5 days ago

      jobRegistry.replaceAll({
        'old-job': { timeCreated: oldTime, status: 'Complete' },
        'recent-job-1': { timeCreated: recentTime, status: 'Complete' },
        'recent-job-2': { timeCreated: now, status: 'In Progress' }
      });

      const result = jobRegistry.getRunningJobs();

      expect(jobRegistry.jobs['old-job']).toBeUndefined();
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('recent-job-2'); // Most recent first
      expect(result[1].id).toBe('recent-job-1');
    });

    test('should limit to 720 most recent jobs', () => {
      jobRegistry.replaceAll({});
      const now = Date.now();

      // Create 750 jobs
      for (let i = 0; i < 750; i++) {
        jobRegistry.setJob(`job-${i}`, {
          timeCreated: now - i * 1000,
          status: 'Complete'
        });
      }

      const result = jobRegistry.getRunningJobs();

      expect(result).toHaveLength(720);
      expect(result[0].id).toBe('job-0'); // Most recent
      expect(result[719].id).toBe('job-719');
    });
  });

  describe('history retention', () => {
    test('keeps jobs newer than 42 days and purges older ones', () => {
      const now = Date.now();
      jobRegistry.replaceAll({
        'recent-job': { status: 'Complete', timeCreated: now - 30 * 24 * 60 * 60 * 1000 },
        'ancient-job': { status: 'Complete', timeCreated: now - 50 * 24 * 60 * 60 * 1000 }
      });

      const jobs = jobRegistry.getRunningJobs();

      expect(jobs.map((j) => j.id)).toEqual(['recent-job']);
      expect(jobRegistry.jobs['ancient-job']).toBeUndefined();
    });

    test('returns at most 720 jobs, newest first', () => {
      const now = Date.now();
      jobRegistry.replaceAll({});
      for (let i = 0; i < 725; i++) {
        jobRegistry.setJob(`job-${i}`, { status: 'Complete', timeCreated: now - i * 1000 });
      }

      const jobs = jobRegistry.getRunningJobs();

      expect(jobs).toHaveLength(720);
      expect(jobs[0].id).toBe('job-0');
    });
  });

  describe('getAllJobs', () => {
    test('should return all jobs', () => {
      const mockJobs = {
        'job-1': { status: 'Complete' },
        'job-2': { status: 'Pending' }
      };
      jobRegistry.replaceAll(mockJobs);

      const result = jobRegistry.getAllJobs();
      expect(result).toBe(mockJobs);
    });
  });

  describe('owning the map', () => {
    test('replaceAll makes the given object the live map', () => {
      const jobs = { a: { status: 'Pending' } };
      jobRegistry.replaceAll(jobs);
      expect(jobRegistry.getAllJobs()).toBe(jobs);
      expect(jobRegistry.jobs).toBe(jobs);
    });

    test('setJob and removeJob add and drop one entry', () => {
      jobRegistry.setJob('a', { status: 'Pending' });
      expect(jobRegistry.getJob('a')).toEqual({ status: 'Pending' });
      jobRegistry.removeJob('a');
      expect(jobRegistry.getJob('a')).toBeUndefined();
    });
  });
});
