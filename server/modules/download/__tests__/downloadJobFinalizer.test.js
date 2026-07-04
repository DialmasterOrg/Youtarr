/* eslint-env jest */

jest.mock('../../../logger');

jest.mock('../../jobModule', () => ({
  updateJob: jest.fn().mockResolvedValue(),
  startNextJob: jest.fn(() => Promise.resolve()),
  getJob: jest.fn(),
  saveJobOnly: jest.fn().mockResolvedValue()
}));

jest.mock('../../configModule', () => ({
  getConfig: jest.fn().mockReturnValue({}),
  getCookiesPath: jest.fn().mockReturnValue(null)
}));

jest.mock('../failureAdvisor', () => {
  const actual = jest.requireActual('../failureAdvisor');
  return { ...actual, adviseFailures: jest.fn(actual.adviseFailures) };
});

jest.mock('../../messageEmitter', () => ({
  emitMessage: jest.fn()
}));

jest.mock('../../notificationModule', () => ({
  sendDownloadNotification: jest.fn().mockResolvedValue()
}));

jest.mock('../videoMetadataProcessor', () => ({
  processVideoMetadata: jest.fn().mockResolvedValue([])
}));

jest.mock('../downloadRunTracker', () => ({
  isActive: jest.fn().mockReturnValue(false),
  recordJobResult: jest.fn()
}));

jest.mock('../downloadResultProcessor', () => ({
  resolveUrlsToProcess: jest.fn().mockReturnValue([]),
  partitionDownloadResults: jest.fn().mockReturnValue({ successfulVideos: [], failedVideosList: [] }),
  reconcileArchive: jest.fn().mockResolvedValue()
}));

jest.mock('../downloadCleanup', () => ({
  cleanupInProgressVideos: jest.fn().mockResolvedValue(),
  cleanupPartialFiles: jest.fn().mockResolvedValue()
}));

jest.mock('../downloadCompletionEffects', () => ({
  runCompletionSideEffects: jest.fn().mockResolvedValue()
}));

const jobModule = require('../../jobModule');
const configModule = require('../../configModule');
const failureAdvisor = require('../failureAdvisor');
const MessageEmitter = require('../../messageEmitter');
const notificationModule = require('../../notificationModule');
const downloadRunTracker = require('../downloadRunTracker');
const downloadResultProcessor = require('../downloadResultProcessor');
const downloadCleanup = require('../downloadCleanup');
const { runCompletionSideEffects } = require('../downloadCompletionEffects');
const logger = require('../../../logger');
const {
  finalizeDownloadJob,
  saveIntermediateGroupResults,
  stderrHasOnlyBenignWarnings,
} = require('../downloadJobFinalizer');

const mockJobId = 'job-123';

// Minimal stand-ins for the run-state objects the finalizer reads
const makeMonitor = (overrides = {}) => ({
  videoCount: { current: 1, total: 0, completed: 0, skipped: 0 },
  hasError: false,
  lastParsed: null,
  currentChannelName: '',
  snapshot: jest.fn((state) => ({ state })),
  ...overrides
});

const makeErrorTracker = (overrides = {}) => ({
  failedVideos: new Map(),
  expectedSkipCount: 0,
  unexpectedErrorCount: 0,
  terminatedChannelIds: new Set(),
  terminatedChannels: [],
  terminationFailures: [],
  membersOnlyVideoIds: new Set(),
  settlePersistence: jest.fn().mockResolvedValue(),
  ...overrides
});

const makeRouter = (overrides = {}) => ({
  stderrBuffer: '',
  botDetected: false,
  httpForbiddenDetected: false,
  partialDestinations: new Set(),
  emitCookiesSuggestion: jest.fn(),
  ...overrides
});

const makeContext = (overrides = {}) => ({
  jobId: mockJobId,
  jobType: 'Manually Added Urls',
  code: 0,
  signal: null,
  monitor: makeMonitor(),
  errorTracker: makeErrorTracker(),
  timeoutController: { shutdownInProgress: false, shutdownReason: null },
  router: makeRouter(),
  wasManuallyTerminated: false,
  manualReason: null,
  initialCount: 0,
  originalUrls: null,
  allowRedownload: false,
  skipJobTransition: false,
  runId: null,
  tempChannelsFile: null,
  onTempChannelsFileCleaned: jest.fn(),
  ...overrides
});

describe('downloadJobFinalizer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // clearAllMocks does not reset implementations; one test replaces
    // emitMessage with a throwing implementation, so restore it here.
    MessageEmitter.emitMessage.mockImplementation(() => {});
    jobModule.updateJob.mockResolvedValue();
    jobModule.saveJobOnly.mockResolvedValue();
    jobModule.getJob.mockReturnValue(undefined);
    configModule.getConfig.mockReturnValue({});
    configModule.getCookiesPath.mockReturnValue(null);
    failureAdvisor.adviseFailures.mockImplementation(jest.requireActual('../failureAdvisor').adviseFailures);
    downloadRunTracker.isActive.mockReturnValue(false);
    downloadResultProcessor.resolveUrlsToProcess.mockReturnValue([]);
    downloadResultProcessor.partitionDownloadResults.mockReturnValue({ successfulVideos: [], failedVideosList: [] });
  });

  describe('finalizeDownloadJob', () => {
    it('marks a clean exit Complete without an endDate (legacy behavior)', async () => {
      await finalizeDownloadJob(makeContext());

      expect(jobModule.updateJob).toHaveBeenCalledTimes(1);
      const [jobId, fields] = jobModule.updateJob.mock.calls[0];
      expect(jobId).toBe(mockJobId);
      expect(fields.status).toBe('Complete');
      expect(fields.output).toBe('0 videos.');
      expect('endDate' in fields).toBe(false);
    });

    it('marks the job Error with COOKIES_REQUIRED when bot detection was seen', async () => {
      await finalizeDownloadJob(makeContext({ code: 1, router: makeRouter({ botDetected: true }) }));

      expect(jobModule.updateJob).toHaveBeenCalledWith(mockJobId, expect.objectContaining({
        status: 'Error',
        error: 'COOKIES_REQUIRED',
        endDate: expect.any(Number)
      }));
    });

    it('uses stale-cookie messaging for bot detection when cookies are enabled', async () => {
      configModule.getCookiesPath.mockReturnValue('/app/config/cookies.user.txt');

      await finalizeDownloadJob(makeContext({ code: 1, router: makeRouter({ botDetected: true }) }));

      expect(jobModule.updateJob).toHaveBeenCalledWith(mockJobId, expect.objectContaining({
        status: 'Error',
        error: 'COOKIES_REQUIRED',
        output: expect.stringMatching(/expired or rotated/i),
        notes: expect.stringMatching(/re-export fresh cookies/i)
      }));

      // The broadcast final presentation must match the persisted advice.
      const finalCall = MessageEmitter.emitMessage.mock.calls.find(
        (call) => call[4] && call[4].text && call[4].text.startsWith('Download failed')
      );
      expect(finalCall).toBeDefined();
      expect(finalCall[4].text).toMatch(/expired or rotated/i);
      expect(finalCall[4].text).not.toMatch(/set cookies/i);
    });

    it('detects bot detection from the stderr buffer rescan', async () => {
      await finalizeDownloadJob(makeContext({
        code: 1,
        router: makeRouter({ stderrBuffer: 'Sign in to confirm you are not a bot' })
      }));

      expect(jobModule.updateJob).toHaveBeenCalledWith(mockJobId, expect.objectContaining({
        status: 'Error',
        error: 'COOKIES_REQUIRED'
      }));
    });

    it('emits the cookies suggestion when 403 only appears in the stderr buffer', async () => {
      const ctx = makeContext({ router: makeRouter({ stderrBuffer: 'HTTP Error 403: Forbidden' }) });

      await finalizeDownloadJob(ctx);

      expect(ctx.router.emitCookiesSuggestion).toHaveBeenCalled();
    });

    it('cleans up in-progress videos and marks Terminated with the manual reason', async () => {
      await finalizeDownloadJob(makeContext({
        code: null,
        signal: 'SIGTERM',
        wasManuallyTerminated: true,
        manualReason: 'User requested termination'
      }));

      expect(downloadCleanup.cleanupInProgressVideos).toHaveBeenCalledWith(mockJobId);
      expect(jobModule.updateJob).toHaveBeenCalledWith(mockJobId, expect.objectContaining({
        status: 'Terminated',
        notes: 'User requested termination',
        endDate: expect.any(Number)
      }));
    });

    it('cleans partial files and saves intermediate results for grouped non-zero exits', async () => {
      const job = { data: { videos: [], failedVideos: [] } };
      jobModule.getJob.mockReturnValue(job);

      await finalizeDownloadJob(makeContext({
        code: 2,
        skipJobTransition: true,
        router: makeRouter({ partialDestinations: new Set(['/output/partial.mp4']) })
      }));

      expect(downloadCleanup.cleanupPartialFiles).toHaveBeenCalledWith(['/output/partial.mp4']);
      // Intermediate path persists via saveIntermediateGroupResults (output merge), not a terminal status
      const [, fields] = jobModule.updateJob.mock.calls[0];
      expect(fields.status).toBeUndefined();
      expect(fields.data).toEqual(expect.objectContaining({ cumulativeSkipped: 0 }));
    });

    it('broadcasts a final payload with finalSummary for standalone completions', async () => {
      await finalizeDownloadJob(makeContext());

      const finalCall = MessageEmitter.emitMessage.mock.calls.find(
        (call) => call[4] && call[4].finalSummary
      );
      expect(finalCall).toBeDefined();
      expect(finalCall[4].finalSummary).toEqual(expect.objectContaining({
        totalDownloaded: 0,
        totalFailed: 0,
        jobType: 'Manually Added Urls'
      }));
      expect(notificationModule.sendDownloadNotification).toHaveBeenCalled();
    });

    it('reports to the run tracker instead of summary/notification when the run is active', async () => {
      downloadRunTracker.isActive.mockReturnValue(true);

      await finalizeDownloadJob(makeContext({ runId: 'run-1' }));

      expect(downloadRunTracker.recordJobResult).toHaveBeenCalledWith('run-1', mockJobId, expect.any(Object));
      expect(notificationModule.sendDownloadNotification).not.toHaveBeenCalled();
      const finalCall = MessageEmitter.emitMessage.mock.calls.find(
        (call) => call[4] && call[4].finalSummary
      );
      expect(finalCall).toBeUndefined();
    });

    it('runs completion side effects with the temp channels file passthrough', async () => {
      const onCleaned = jest.fn();

      await finalizeDownloadJob(makeContext({
        tempChannelsFile: '/tmp/channels.txt',
        onTempChannelsFileCleaned: onCleaned
      }));

      expect(runCompletionSideEffects).toHaveBeenCalledWith({
        jobId: mockJobId,
        videoData: [],
        skipJobTransition: false,
        tempChannelsFile: '/tmp/channels.txt',
        onTempChannelsFileCleaned: onCleaned,
      });
    });

    it('never throws: marks the job Error best-effort and starts the next job when persistence fails', async () => {
      jobModule.updateJob
        .mockRejectedValueOnce(new Error('DB outage'))
        .mockResolvedValue();

      await expect(finalizeDownloadJob(makeContext())).resolves.toBeUndefined();

      expect(logger.error).toHaveBeenCalledWith(
        { err: expect.any(Error), jobId: mockJobId },
        'Unexpected error finalizing download job'
      );
      expect(jobModule.updateJob).toHaveBeenCalledWith(mockJobId, expect.objectContaining({
        status: 'Error',
        output: expect.stringContaining('Job finalization error')
      }));
      expect(jobModule.startNextJob).toHaveBeenCalled();
    });

    it('does not overwrite a persisted terminal status when a post-persist step throws', async () => {
      MessageEmitter.emitMessage.mockImplementation(() => {
        throw new Error('broadcast boom');
      });

      await finalizeDownloadJob(makeContext());

      // First call persisted Complete; the catch must not issue an Error update
      expect(jobModule.updateJob).toHaveBeenCalledTimes(1);
      expect(jobModule.updateJob.mock.calls[0][1].status).toBe('Complete');
      expect(jobModule.startNextJob).toHaveBeenCalled();
    });

    describe('auto-retry of transient 403 failures', () => {
      const make403Failure = (overrides = {}) => ({
        youtubeId: 'vid403aaaa1',
        title: 'Failing Video',
        channel: 'Some Channel',
        error: 'unable to download video data: HTTP Error 403: Forbidden',
        url: null,
        ...overrides
      });

      const primeFailure = (failure) => {
        downloadResultProcessor.partitionDownloadResults.mockReturnValue({
          successfulVideos: [],
          failedVideosList: [failure]
        });
      };

      it('enqueues an auto-retry job before the terminal persist', async () => {
        const failure = make403Failure();
        primeFailure(failure);
        jobModule.getJob.mockReturnValue({ data: { overrideSettings: { resolution: '720' } } });
        const enqueueAutoRetry = jest.fn().mockResolvedValue();

        await finalizeDownloadJob(makeContext({ code: 1, enqueueAutoRetry, runId: 'run-9' }));

        expect(enqueueAutoRetry).toHaveBeenCalledWith({
          retryVideos: [{
            youtubeId: 'vid403aaaa1',
            url: 'https://www.youtube.com/watch?v=vid403aaaa1'
          }],
          autoRetryAttempt: 1,
          runId: 'run-9',
          sourceJobData: { overrideSettings: { resolution: '720' } }
        });
        // Enqueued while the source job is still In Progress, so the retry
        // queues as Pending instead of starting concurrently.
        expect(enqueueAutoRetry.mock.invocationCallOrder[0])
          .toBeLessThan(jobModule.updateJob.mock.invocationCallOrder[0]);
      });

      it('tags handed-off failures and excludes them from the final summary', async () => {
        const failure = make403Failure();
        primeFailure(failure);
        jobModule.getJob.mockReturnValue({ data: {} });
        const enqueueAutoRetry = jest.fn().mockResolvedValue();

        await finalizeDownloadJob(makeContext({ enqueueAutoRetry }));

        expect(failure.autoRetryQueued).toBe(true);
        const [, fields] = jobModule.updateJob.mock.calls[0];
        expect(fields.data.failedVideos[0].autoRetryQueued).toBe(true);

        const finalCall = MessageEmitter.emitMessage.mock.calls.find(
          (call) => call[4] && call[4].finalSummary
        );
        expect(finalCall[4].finalSummary).toEqual(expect.objectContaining({
          totalFailed: 0,
          totalAutoRetried: 1,
          failedVideos: []
        }));
      });

      it('excludes handed-off failures from the run tracker totals', async () => {
        const failure = make403Failure();
        primeFailure(failure);
        jobModule.getJob.mockReturnValue({ data: {} });
        downloadRunTracker.isActive.mockReturnValue(true);
        const enqueueAutoRetry = jest.fn().mockResolvedValue();

        await finalizeDownloadJob(makeContext({ enqueueAutoRetry, runId: 'run-1' }));

        expect(downloadRunTracker.recordJobResult).toHaveBeenCalledWith('run-1', mockJobId, expect.objectContaining({
          totalFailed: 0,
          failedVideos: []
        }));
      });

      it('does not enqueue when bot detection fired', async () => {
        primeFailure(make403Failure());
        const enqueueAutoRetry = jest.fn();

        await finalizeDownloadJob(makeContext({
          code: 1,
          enqueueAutoRetry,
          router: makeRouter({ botDetected: true })
        }));

        expect(enqueueAutoRetry).not.toHaveBeenCalled();
      });

      it('does not enqueue when the job was manually terminated', async () => {
        primeFailure(make403Failure());
        const enqueueAutoRetry = jest.fn();

        await finalizeDownloadJob(makeContext({
          code: null,
          signal: 'SIGTERM',
          wasManuallyTerminated: true,
          manualReason: 'User requested termination',
          enqueueAutoRetry
        }));

        expect(enqueueAutoRetry).not.toHaveBeenCalled();
      });

      it('does not enqueue once the attempt budget is spent', async () => {
        primeFailure(make403Failure());
        jobModule.getJob.mockReturnValue({ data: { autoRetryAttempt: 1 } });
        const enqueueAutoRetry = jest.fn();

        await finalizeDownloadJob(makeContext({ code: 1, enqueueAutoRetry }));

        expect(enqueueAutoRetry).not.toHaveBeenCalled();
      });

      it('does not enqueue when downloadAutoRetryCount is 0', async () => {
        primeFailure(make403Failure());
        configModule.getConfig.mockReturnValue({ downloadAutoRetryCount: 0 });
        const enqueueAutoRetry = jest.fn();

        await finalizeDownloadJob(makeContext({ code: 1, enqueueAutoRetry }));

        expect(enqueueAutoRetry).not.toHaveBeenCalled();
      });

      it('does not enqueue for failures without the 403 signature', async () => {
        primeFailure(make403Failure({ error: 'Postprocessing failed' }));
        const enqueueAutoRetry = jest.fn();

        await finalizeDownloadJob(makeContext({ code: 1, enqueueAutoRetry }));

        expect(enqueueAutoRetry).not.toHaveBeenCalled();
      });

      it('keeps the failure reported when enqueueing the retry fails', async () => {
        const failure = make403Failure();
        primeFailure(failure);
        jobModule.getJob.mockReturnValue({ data: {} });
        const enqueueAutoRetry = jest.fn().mockRejectedValue(new Error('queue boom'));

        await finalizeDownloadJob(makeContext({ enqueueAutoRetry }));

        expect(logger.error).toHaveBeenCalledWith(
          { err: expect.any(Error), jobId: mockJobId },
          'Failed to enqueue auto-retry for transient 403 failures'
        );
        expect(failure.autoRetryQueued).toBeUndefined();
        const finalCall = MessageEmitter.emitMessage.mock.calls.find(
          (call) => call[4] && call[4].finalSummary
        );
        expect(finalCall[4].finalSummary).toEqual(expect.objectContaining({
          totalFailed: 1,
          totalAutoRetried: 0
        }));
      });
    });

    describe('failure diagnoses', () => {
      const make403Failure = (overrides = {}) => ({
        youtubeId: 'vid403aaaa1',
        title: 'Failing Video',
        channel: 'Some Channel',
        error: 'unable to download video data: HTTP Error 403: Forbidden',
        url: null,
        ...overrides
      });

      const primeFailure = (failure) => {
        downloadResultProcessor.partitionDownloadResults.mockReturnValue({
          successfulVideos: [],
          failedVideosList: [failure]
        });
      };

      const emittedFinalSummary = () => {
        const finalCall = MessageEmitter.emitMessage.mock.calls.find(
          (call) => call[4] && call[4].finalSummary
        );
        return finalCall ? finalCall[4].finalSummary : null;
      };

      it('stamps a cookie-403 diagnosis and includes advice in payload and summary', async () => {
        const failure = make403Failure();
        primeFailure(failure);
        configModule.getCookiesPath.mockReturnValue('/app/config/cookies.user.txt');

        await finalizeDownloadJob(makeContext({ code: 1 }));

        expect(failure.diagnosisKey).toBe('http-403-cookies-enabled');
        const [, fields] = jobModule.updateJob.mock.calls[0];
        expect(fields.data.diagnoses).toHaveLength(1);
        expect(fields.data.diagnoses[0]).toEqual(expect.objectContaining({
          key: 'http-403-cookies-enabled',
          count: 1
        }));
        expect(emittedFinalSummary().diagnoses).toHaveLength(1);
      });

      it('uses the cookies-disabled advice when no cookie file is configured', async () => {
        const failure = make403Failure();
        primeFailure(failure);

        await finalizeDownloadJob(makeContext({ code: 1 }));

        expect(failure.diagnosisKey).toBe('http-403-cookies-disabled');
      });

      it('passes diagnoses to the run tracker when the job belongs to a run', async () => {
        primeFailure(make403Failure());
        configModule.getCookiesPath.mockReturnValue('/app/config/cookies.user.txt');
        downloadRunTracker.isActive.mockReturnValue(true);

        await finalizeDownloadJob(makeContext({ code: 1, runId: 'run-1' }));

        expect(downloadRunTracker.recordJobResult).toHaveBeenCalledWith('run-1', mockJobId, expect.objectContaining({
          diagnoses: [expect.objectContaining({ key: 'http-403-cookies-enabled', count: 1 })]
        }));
      });

      it('does not diagnose failures handed off to auto-retry', async () => {
        const failure = make403Failure();
        primeFailure(failure);
        jobModule.getJob.mockReturnValue({ data: {} });
        const enqueueAutoRetry = jest.fn().mockResolvedValue();

        await finalizeDownloadJob(makeContext({ enqueueAutoRetry }));

        expect(failure.diagnosisKey).toBeUndefined();
        expect(emittedFinalSummary().diagnoses).toEqual([]);
      });

      it('sends a notification for a diagnosed failure-only job', async () => {
        primeFailure(make403Failure());
        configModule.getCookiesPath.mockReturnValue('/app/config/cookies.user.txt');

        await finalizeDownloadJob(makeContext({ code: 1 }));

        expect(notificationModule.sendDownloadNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            finalSummary: expect.objectContaining({
              totalFailed: 1,
              diagnoses: [expect.objectContaining({ key: 'http-403-cookies-enabled' })]
            })
          })
        );
      });

      it('does not notify for an undiagnosed failure-only job', async () => {
        primeFailure(make403Failure({ error: 'Postprocessing failed with exit code 1' }));

        await finalizeDownloadJob(makeContext({ code: 1 }));

        expect(notificationModule.sendDownloadNotification).not.toHaveBeenCalled();
      });

      it('does not notify for a manually terminated job even with diagnosed failures', async () => {
        primeFailure(make403Failure());
        configModule.getCookiesPath.mockReturnValue('/app/config/cookies.user.txt');

        await finalizeDownloadJob(makeContext({
          code: null,
          signal: 'SIGTERM',
          wasManuallyTerminated: true,
          manualReason: 'User requested termination'
        }));

        expect(notificationModule.sendDownloadNotification).not.toHaveBeenCalled();
      });

      it('finalizes normally when the advisor throws', async () => {
        const failure = make403Failure();
        primeFailure(failure);
        failureAdvisor.adviseFailures.mockImplementation(() => {
          throw new Error('advisor boom');
        });

        await finalizeDownloadJob(makeContext({ code: 1 }));

        expect(jobModule.updateJob).toHaveBeenCalled();
        expect(emittedFinalSummary()).toEqual(expect.objectContaining({
          totalFailed: 1,
          diagnoses: []
        }));
        expect(logger.error).toHaveBeenCalledWith(
          { err: expect.any(Error), jobId: mockJobId },
          'Failure advisor threw; continuing without diagnoses'
        );
      });
    });
  });

  describe('saveIntermediateGroupResults', () => {
    it('should warn when intermediate group results cannot find the job', async () => {
      jobModule.getJob.mockReturnValue(undefined);

      await saveIntermediateGroupResults(
        mockJobId,
        '1 videos.',
        [{ youtubeId: 'success1234', filePath: '/output/new.mp4', fileSize: '1024' }],
        [],
        0
      );

      expect(logger.warn).toHaveBeenCalledWith(
        { jobId: mockJobId },
        'Unable to merge intermediate group results; job not found'
      );
      expect(jobModule.updateJob).not.toHaveBeenCalled();
      expect(jobModule.saveJobOnly).not.toHaveBeenCalled();
    });

    it('merges terminatedChannels across intermediate groups and dedupes by channelId', async () => {
      const job = {
        data: {
          videos: [],
          failedVideos: [],
          cumulativeSkipped: 0,
          terminatedChannels: [
            { channelId: 'UCdupe000000000000000000', uploader: 'First Wins', url: 'first', terminatedAt: '2026-01-01' }
          ]
        }
      };
      jobModule.getJob.mockReturnValue(job);

      await saveIntermediateGroupResults(
        mockJobId,
        'output',
        [],
        [],
        0,
        {},
        [
          { channelId: 'UCdupe000000000000000000', uploader: 'Should Not Replace', url: 'second', terminatedAt: '2026-02-02' },
          { channelId: 'UCnew0000000000000000000', uploader: 'New Channel', url: 'newurl', terminatedAt: '2026-02-02' }
        ]
      );

      const updateCall = jobModule.updateJob.mock.calls.find(call => call[0] === mockJobId);
      expect(updateCall).toBeDefined();
      const merged = updateCall[1].data.terminatedChannels;
      expect(merged).toHaveLength(2);
      // First write wins on duplicate
      expect(merged.find(c => c.channelId === 'UCdupe000000000000000000')).toEqual(
        expect.objectContaining({ uploader: 'First Wins' })
      );
      expect(merged.find(c => c.channelId === 'UCnew0000000000000000000')).toEqual(
        expect.objectContaining({ uploader: 'New Channel' })
      );
    });

    it('merges terminationFailures across intermediate groups and dedupes by channel id', async () => {
      const job = {
        data: {
          videos: [],
          failedVideos: [],
          cumulativeSkipped: 0,
          terminationFailures: ['UCdupe000000000000000000']
        }
      };
      jobModule.getJob.mockReturnValue(job);

      await saveIntermediateGroupResults(
        mockJobId,
        'output',
        [],
        [],
        0,
        {},
        [],
        ['UCdupe000000000000000000', 'UCnew0000000000000000000']
      );

      const updateCall = jobModule.updateJob.mock.calls.find(call => call[0] === mockJobId);
      const merged = updateCall[1].data.terminationFailures;
      expect(merged).toEqual(['UCdupe000000000000000000', 'UCnew0000000000000000000']);
    });

    it('merges diagnoses across intermediate groups, deduping by key and summing counts', async () => {
      const job = {
        data: {
          videos: [],
          failedVideos: [],
          cumulativeSkipped: 0,
          diagnoses: [{ key: 'http-403-cookies-enabled', title: 't', message: 'm', count: 2 }]
        }
      };
      jobModule.getJob.mockReturnValue(job);

      await saveIntermediateGroupResults(
        mockJobId,
        'output',
        [],
        [],
        0,
        {},
        [],
        [],
        [
          { key: 'http-403-cookies-enabled', title: 't', message: 'm', count: 1 },
          { key: 'bot-check-cookies-disabled', title: 'bt', message: 'bm', count: 1 }
        ]
      );

      const updateCall = jobModule.updateJob.mock.calls.find(call => call[0] === mockJobId);
      const merged = updateCall[1].data.diagnoses;
      expect(merged).toHaveLength(2);
      expect(merged.find(d => d.key === 'http-403-cookies-enabled').count).toBe(3);
      expect(merged.find(d => d.key === 'bot-check-cookies-disabled').count).toBe(1);
    });
  });

  describe('stderrHasOnlyBenignWarnings', () => {
    it('returns true when every line matches a benign warning pattern', () => {
      const stderr = [
        'WARNING: [youtube] abc: The extractor specified to use impersonation for this download',
        'WARNING: --paths is ignored since an absolute path is given in output template'
      ].join('\n');

      expect(stderrHasOnlyBenignWarnings(stderr)).toBe(true);
    });

    it('returns false when any line is not a known benign warning', () => {
      const stderr = [
        'WARNING: [youtube] abc: The extractor specified to use impersonation for this download',
        'WARNING: Some unexpected non-whitelisted warning'
      ].join('\n');

      expect(stderrHasOnlyBenignWarnings(stderr)).toBe(false);
    });

    it('returns false for empty stderr so callers keep their own guard', () => {
      expect(stderrHasOnlyBenignWarnings('')).toBe(false);
      expect(stderrHasOnlyBenignWarnings('   \n  ')).toBe(false);
    });
  });
});
