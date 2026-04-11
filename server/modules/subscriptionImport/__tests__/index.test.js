'use strict';

jest.mock('../takeoutParser');
jest.mock('../cookiesFetcher');
jest.mock('../thumbnailEnricher');
jest.mock('../importJobRunner');
jest.mock('../../../logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const takeoutParser = require('../takeoutParser');
const cookiesFetcher = require('../cookiesFetcher');
const thumbnailEnricher = require('../thumbnailEnricher');
const importJobRunner = require('../importJobRunner');
const subscriptionImportModule = require('../index');
const { ImportInProgressError } = subscriptionImportModule;

const mockDeps = {
  channelModule: {},
  jobModule: {
    addOrUpdateJob: jest.fn().mockResolvedValue('job-uuid-123'),
    updateJob: jest.fn().mockResolvedValue(),
    getJob: jest.fn(),
    jobs: {},
  },
  messageEmitter: { emitMessage: jest.fn() },
  Channel: {
    findAll: jest.fn().mockResolvedValue([]),
  },
};

beforeEach(() => {
  jest.clearAllMocks();

  // Reset singleton state and re-init with mock deps
  subscriptionImportModule.activeJob = null;
  subscriptionImportModule.init(mockDeps);

  // Reset the jobs object reference for listImports tests
  mockDeps.jobModule.jobs = {};
});

describe('SubscriptionImportModule', () => {
  describe('parseTakeout', () => {
    test('calls parseCsv, cross-references DB, enriches thumbnails, returns combined shape', async () => {
      const csvBuffer = Buffer.from('header\nUC123,http://url,Title');
      const parsedChannels = [
        { channelId: 'UC_channel1', url: 'https://youtube.com/channel/UC_channel1', title: 'Channel 1' },
        { channelId: 'UC_channel2', url: 'https://youtube.com/channel/UC_channel2', title: 'Channel 2' },
      ];
      const enrichedChannels = parsedChannels.map((ch) => ({ ...ch, thumbnailUrl: 'https://thumb.jpg' }));

      takeoutParser.parseCsv.mockReturnValue(parsedChannels);
      mockDeps.Channel.findAll.mockResolvedValue([{ channel_id: 'UC_channel1' }]);
      thumbnailEnricher.enrichWithThumbnails.mockResolvedValue(enrichedChannels);

      const result = await subscriptionImportModule.parseTakeout(csvBuffer);

      expect(takeoutParser.parseCsv).toHaveBeenCalledWith(csvBuffer);
      expect(mockDeps.Channel.findAll).toHaveBeenCalled();
      expect(thumbnailEnricher.enrichWithThumbnails).toHaveBeenCalledWith(parsedChannels);

      expect(result).toEqual({
        source: 'takeout',
        totalFound: 2,
        alreadySubscribedCount: 1,
        channels: enrichedChannels.map((ch) => ({
          ...ch,
          alreadySubscribed: ch.channelId === 'UC_channel1',
        })),
      });
    });
  });

  describe('fetchWithCookiesPreview', () => {
    test('calls fetchWithCookies, cross-references DB, enriches thumbnails, returns combined shape', async () => {
      const cookiesBuffer = Buffer.from('# Netscape HTTP Cookie File\n...');
      const fetchedChannels = [
        { channelId: 'UC_abc', url: 'https://youtube.com/channel/UC_abc', title: 'ABC' },
        { channelId: 'UC_def', url: 'https://youtube.com/channel/UC_def', title: 'DEF' },
      ];
      const enrichedChannels = fetchedChannels.map((ch) => ({ ...ch, thumbnailUrl: null }));

      cookiesFetcher.fetchWithCookies.mockResolvedValue(fetchedChannels);
      mockDeps.Channel.findAll.mockResolvedValue([{ channel_id: 'UC_def' }]);
      thumbnailEnricher.enrichWithThumbnails.mockResolvedValue(enrichedChannels);

      const result = await subscriptionImportModule.fetchWithCookiesPreview(cookiesBuffer);

      expect(cookiesFetcher.fetchWithCookies).toHaveBeenCalledWith(cookiesBuffer);
      expect(mockDeps.Channel.findAll).toHaveBeenCalled();
      expect(thumbnailEnricher.enrichWithThumbnails).toHaveBeenCalledWith(fetchedChannels);

      expect(result).toEqual({
        source: 'cookies',
        totalFound: 2,
        alreadySubscribedCount: 1,
        channels: enrichedChannels.map((ch) => ({
          ...ch,
          alreadySubscribed: ch.channelId === 'UC_def',
        })),
      });
    });
  });

  describe('cross-reference DB failure', () => {
    test('throws when Channel.findAll fails (does NOT silently degrade)', async () => {
      const csvBuffer = Buffer.from('header\nUC123,http://url,Title');
      const parsedChannels = [
        { channelId: 'UC_channel1', url: 'https://youtube.com/channel/UC_channel1', title: 'Ch1' },
      ];

      takeoutParser.parseCsv.mockReturnValue(parsedChannels);
      mockDeps.Channel.findAll.mockRejectedValue(new Error('DB connection lost'));

      await expect(subscriptionImportModule.parseTakeout(csvBuffer)).rejects.toThrow('DB connection lost');
    });
  });

  describe('startImport', () => {
    test('creates a Job row, sets activeJob, kicks off runner, returns { jobId, total }', async () => {
      const channels = [
        { channelId: 'UC_a', title: 'A', url: 'https://youtube.com/channel/UC_a' },
        { channelId: 'UC_b', title: 'B', url: 'https://youtube.com/channel/UC_b' },
      ];

      // Use a never-resolving promise so activeJob stays set during assertions
      importJobRunner.runImport.mockReturnValue(new Promise(() => {}));

      const result = await subscriptionImportModule.startImport(channels, 'test-user');

      expect(result).toEqual({ jobId: 'job-uuid-123', total: 2 });
      expect(mockDeps.jobModule.addOrUpdateJob).toHaveBeenCalledWith(
        expect.objectContaining({
          jobType: 'Import Subscriptions',
        })
      );
      expect(importJobRunner.runImport).toHaveBeenCalledWith(
        mockDeps,
        expect.objectContaining({
          jobId: 'job-uuid-123',
          total: 2,
          results: [],
          cancelRequested: false,
        }),
        channels
      );
      expect(subscriptionImportModule.activeJob).not.toBeNull();
    });

    test('throws ImportInProgressError when activeJob is not null', async () => {
      subscriptionImportModule.activeJob = {
        jobId: 'existing-job',
        total: 5,
        results: [],
        cancelRequested: false,
        startedAt: Date.now(),
      };

      const channels = [{ channelId: 'UC_x', title: 'X', url: 'https://youtube.com/channel/UC_x' }];

      await expect(subscriptionImportModule.startImport(channels, 'test-user')).rejects.toThrow(
        ImportInProgressError
      );
    });

    test('activeJob is cleaned up via .finally() after runner completes', async () => {
      let resolveRunner;
      importJobRunner.runImport.mockImplementation(
        () => new Promise((resolve) => { resolveRunner = resolve; })
      );

      const channels = [{ channelId: 'UC_a', title: 'A', url: 'https://youtube.com/channel/UC_a' }];

      await subscriptionImportModule.startImport(channels, 'user');
      expect(subscriptionImportModule.activeJob).not.toBeNull();

      // Resolve the runner promise
      resolveRunner();

      // Allow microtasks to flush (for .finally())
      await new Promise((r) => setImmediate(r));

      expect(subscriptionImportModule.activeJob).toBeNull();
    });

    test('activeJob is cleaned up via .finally() even when runner rejects', async () => {
      let rejectRunner;
      importJobRunner.runImport.mockImplementation(
        () => new Promise((_, reject) => { rejectRunner = reject; })
      );

      const channels = [{ channelId: 'UC_a', title: 'A', url: 'https://youtube.com/channel/UC_a' }];

      await subscriptionImportModule.startImport(channels, 'user');
      expect(subscriptionImportModule.activeJob).not.toBeNull();

      // Reject the runner promise
      rejectRunner(new Error('runner crash'));

      // Allow microtasks to flush
      await new Promise((r) => setImmediate(r));

      expect(subscriptionImportModule.activeJob).toBeNull();
    });
  });

  describe('getActiveImport', () => {
    test('returns summary for in-progress job', () => {
      subscriptionImportModule.activeJob = {
        jobId: 'active-123',
        total: 10,
        results: [{ state: 'success' }, { state: 'error' }],
        cancelRequested: false,
        startedAt: 1700000000000,
      };

      const summary = subscriptionImportModule.getActiveImport();

      expect(summary).toEqual({
        jobId: 'active-123',
        total: 10,
        done: 2,
        cancelRequested: false,
        startedAt: 1700000000000,
      });
    });

    test('returns null when idle', () => {
      expect(subscriptionImportModule.getActiveImport()).toBeNull();
    });
  });

  describe('getImport', () => {
    test('returns in-memory state for active job', async () => {
      const activeJob = {
        jobId: 'active-456',
        total: 5,
        results: [{ channelId: 'UC_a', state: 'success' }],
        cancelRequested: false,
        startedAt: 1700000000000,
      };
      subscriptionImportModule.activeJob = activeJob;

      const result = await subscriptionImportModule.getImport('active-456');

      expect(result).toEqual({
        jobId: 'active-456',
        status: 'In Progress',
        total: 5,
        done: 1,
        results: activeJob.results,
        cancelRequested: false,
        startedAt: 1700000000000,
      });
    });

    test('returns DB state for historical job', async () => {
      const historicalJob = {
        id: 'hist-789',
        jobType: 'Import Subscriptions',
        status: 'Complete',
        output: JSON.stringify([
          { channelId: 'UC_a', state: 'success' },
          { channelId: 'UC_b', state: 'error', error: 'fail' },
        ]),
        timeInitiated: 1700000000000,
      };
      mockDeps.jobModule.getJob.mockReturnValue(historicalJob);

      const result = await subscriptionImportModule.getImport('hist-789');

      expect(result).toEqual({
        jobId: 'hist-789',
        status: 'Complete',
        total: 2,
        done: 2,
        results: JSON.parse(historicalJob.output),
        startedAt: 1700000000000,
      });
    });

    test('returns DB state with error output for failed job', async () => {
      const failedJob = {
        id: 'fail-001',
        jobType: 'Import Subscriptions',
        status: 'Failed',
        output: JSON.stringify({ error: 'Something broke', partialResults: [{ state: 'success' }] }),
        timeInitiated: 1700000000000,
      };
      mockDeps.jobModule.getJob.mockReturnValue(failedJob);

      const result = await subscriptionImportModule.getImport('fail-001');

      expect(result).toEqual({
        jobId: 'fail-001',
        status: 'Failed',
        total: 1,
        done: 1,
        results: [{ state: 'success' }],
        error: 'Something broke',
        startedAt: 1700000000000,
      });
    });

    test('returns null when job not found', async () => {
      mockDeps.jobModule.getJob.mockReturnValue(undefined);

      const result = await subscriptionImportModule.getImport('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('cancelImport', () => {
    test('sets cancelRequested=true on active job', () => {
      subscriptionImportModule.activeJob = {
        jobId: 'cancel-me',
        total: 10,
        results: [],
        cancelRequested: false,
        startedAt: Date.now(),
      };

      subscriptionImportModule.cancelImport('cancel-me');

      expect(subscriptionImportModule.activeJob.cancelRequested).toBe(true);
    });

    test('throws when no active import with that jobId', () => {
      expect(() => subscriptionImportModule.cancelImport('nonexistent')).toThrow();
    });

    test('throws when active import has different jobId', () => {
      subscriptionImportModule.activeJob = {
        jobId: 'different-job',
        total: 5,
        results: [],
        cancelRequested: false,
        startedAt: Date.now(),
      };

      expect(() => subscriptionImportModule.cancelImport('wrong-id')).toThrow();
    });
  });

  describe('listImports', () => {
    test('returns filtered jobs from jobModule sorted by timeInitiated descending', async () => {
      mockDeps.jobModule.jobs = {
        'job-1': { jobType: 'Import Subscriptions', status: 'Complete', timeInitiated: 1000 },
        'job-2': { jobType: 'Download', status: 'Complete', timeInitiated: 2000 },
        'job-3': { jobType: 'Import Subscriptions', status: 'Failed', timeInitiated: 3000 },
        'job-4': { jobType: 'Import Subscriptions', status: 'Complete', timeInitiated: 500 },
      };

      const result = await subscriptionImportModule.listImports(10);

      expect(result).toHaveLength(3);
      expect(result[0].jobId).toBe('job-3');
      expect(result[1].jobId).toBe('job-1');
      expect(result[2].jobId).toBe('job-4');
    });

    test('respects limit parameter', async () => {
      mockDeps.jobModule.jobs = {
        'job-1': { jobType: 'Import Subscriptions', status: 'Complete', timeInitiated: 1000 },
        'job-2': { jobType: 'Import Subscriptions', status: 'Complete', timeInitiated: 2000 },
        'job-3': { jobType: 'Import Subscriptions', status: 'Complete', timeInitiated: 3000 },
      };

      const result = await subscriptionImportModule.listImports(2);

      expect(result).toHaveLength(2);
      expect(result[0].jobId).toBe('job-3');
      expect(result[1].jobId).toBe('job-2');
    });

    test('returns empty array when no import jobs exist', async () => {
      mockDeps.jobModule.jobs = {
        'job-1': { jobType: 'Download', status: 'Complete', timeInitiated: 1000 },
      };

      const result = await subscriptionImportModule.listImports(10);

      expect(result).toEqual([]);
    });
  });
});
