jest.mock('../../../logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const logger = require('../../../logger');
const DownloadTimeoutController = require('../DownloadTimeoutController');

const ACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;
const POST_PROCESSING_TIMEOUT_MS = 60 * 60 * 1000;
const MAX_ABSOLUTE_TIMEOUT_MS = 6 * 60 * 60 * 1000;
const CHECK_INTERVAL_MS = 60 * 1000;
const SIGKILL_GRACE_MS = 60 * 1000;

function makeController() {
  return new DownloadTimeoutController({
    activityTimeoutMs: ACTIVITY_TIMEOUT_MS,
    postProcessingTimeoutMs: POST_PROCESSING_TIMEOUT_MS,
    maxAbsoluteTimeoutMs: MAX_ABSOLUTE_TIMEOUT_MS,
  });
}

function makeProc() {
  return { kill: jest.fn(), exitCode: null, signalCode: null };
}

describe('DownloadTimeoutController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('checkTimeout', () => {
    it('returns timeout false while within the activity window', () => {
      const controller = makeController();

      jest.advanceTimersByTime(ACTIVITY_TIMEOUT_MS - 60 * 1000);

      expect(controller.checkTimeout()).toEqual({ timeout: false });
    });

    it('returns an inactivity timeout after the activity window elapses', () => {
      const controller = makeController();

      jest.advanceTimersByTime(ACTIVITY_TIMEOUT_MS + 60 * 1000);

      const result = controller.checkTimeout();
      expect(result.timeout).toBe(true);
      expect(result.reason).toMatch(/No download activity for \d+ minutes/);
    });

    it('fires the absolute runtime cap even when activity is recent', () => {
      const controller = makeController();

      jest.advanceTimersByTime(MAX_ABSOLUTE_TIMEOUT_MS + 60 * 1000);
      controller.noteActivity();

      const result = controller.checkTimeout();
      expect(result.timeout).toBe(true);
      expect(result.reason).toMatch(/Maximum runtime limit of 6 hours reached/);
    });
  });

  describe('absolute timeout exemption', () => {
    function makeExemptController() {
      return new DownloadTimeoutController({
        activityTimeoutMs: ACTIVITY_TIMEOUT_MS,
        postProcessingTimeoutMs: POST_PROCESSING_TIMEOUT_MS,
        maxAbsoluteTimeoutMs: null,
      });
    }

    it('never fires the absolute cap when maxAbsoluteTimeoutMs is null', () => {
      const controller = makeExemptController();

      jest.advanceTimersByTime(MAX_ABSOLUTE_TIMEOUT_MS * 4);
      controller.noteActivity();

      expect(controller.checkTimeout()).toEqual({ timeout: false });
    });

    it('still fires the inactivity timeout when maxAbsoluteTimeoutMs is null', () => {
      const controller = makeExemptController();

      jest.advanceTimersByTime(ACTIVITY_TIMEOUT_MS + 60 * 1000);

      const result = controller.checkTimeout();
      expect(result.timeout).toBe(true);
      expect(result.reason).toMatch(/No download activity for \d+ minutes/);
    });
  });

  describe('noteLine', () => {
    it('extends the timeout to the post-processing window on a Merger line and logs info', () => {
      const controller = makeController();

      controller.noteLine('[Merger] Merging formats into "video.mp4"');
      jest.advanceTimersByTime(ACTIVITY_TIMEOUT_MS + 60 * 1000);

      expect(controller.checkTimeout()).toEqual({ timeout: false });
      expect(logger.info).toHaveBeenCalledWith(
        { timeout: '60 minutes' },
        'Post-processing detected, extended inactivity timeout'
      );

      jest.advanceTimersByTime(POST_PROCESSING_TIMEOUT_MS - ACTIVITY_TIMEOUT_MS);
      expect(controller.checkTimeout().timeout).toBe(true);
    });

    it('resets the timeout to normal when download activity resumes after post-processing', () => {
      const controller = makeController();
      controller.noteLine('[Merger] Merging formats into "video.mp4"');

      controller.noteLine('[download]  42.0% of 100MiB');
      jest.advanceTimersByTime(ACTIVITY_TIMEOUT_MS + 60 * 1000);

      expect(controller.checkTimeout().timeout).toBe(true);
    });

    it('resets activity on a SubtitlesConvertor line while keeping the extended timeout', () => {
      const controller = makeController();
      controller.noteLine('[Merger] Merging formats into "video.mp4"');
      jest.advanceTimersByTime(POST_PROCESSING_TIMEOUT_MS - 60 * 1000);

      controller.noteLine('[SubtitlesConvertor] Converting subtitles');
      jest.advanceTimersByTime(ACTIVITY_TIMEOUT_MS + 60 * 1000);

      expect(controller.checkTimeout()).toEqual({ timeout: false });
    });

    it('logs the configured timeout durations, not hardcoded defaults', () => {
      const controller = new DownloadTimeoutController({
        activityTimeoutMs: 5 * 60 * 1000,
        postProcessingTimeoutMs: 90 * 60 * 1000,
        maxAbsoluteTimeoutMs: MAX_ABSOLUTE_TIMEOUT_MS,
      });

      controller.noteLine('[Merger] Merging formats into "video.mp4"');
      expect(logger.info).toHaveBeenCalledWith(
        { timeout: '90 minutes' },
        'Post-processing detected, extended inactivity timeout'
      );

      controller.noteLine('[download]  42.0% of 100MiB');
      expect(logger.debug).toHaveBeenCalledWith(
        { timeout: '5 minutes' },
        'Download activity resumed, reset to normal timeout'
      );
    });

    it('does not reset activity for unrelated output lines', () => {
      const controller = makeController();
      jest.advanceTimersByTime(ACTIVITY_TIMEOUT_MS - 60 * 1000);

      controller.noteLine('some unrelated yt-dlp chatter');
      jest.advanceTimersByTime(2 * 60 * 1000);

      expect(controller.checkTimeout().timeout).toBe(true);
    });
  });

  describe('start and graceful shutdown', () => {
    it('sends SIGTERM exactly once when the activity window expires', () => {
      const controller = makeController();
      const proc = makeProc();
      controller.start(proc);

      jest.advanceTimersByTime(ACTIVITY_TIMEOUT_MS + CHECK_INTERVAL_MS);

      expect(proc.kill).toHaveBeenCalledTimes(1);
      expect(proc.kill).toHaveBeenCalledWith('SIGTERM');
    });

    it('does not initiate shutdown twice after timeout', () => {
      const controller = makeController();
      const proc = makeProc();
      controller.start(proc);

      jest.advanceTimersByTime(ACTIVITY_TIMEOUT_MS + CHECK_INTERVAL_MS);
      const firstReason = controller.shutdownReason;
      controller.initiateGracefulShutdown('another reason');

      expect(controller.shutdownInProgress).toBe(true);
      expect(controller.shutdownReason).toBe(firstReason);
      expect(proc.kill.mock.calls.filter(([sig]) => sig === 'SIGTERM')).toHaveLength(1);
    });

    it('sends SIGKILL after the grace period when the process has not exited', () => {
      const controller = makeController();
      const proc = makeProc();
      controller.start(proc);
      controller.initiateGracefulShutdown('test reason');

      jest.advanceTimersByTime(SIGKILL_GRACE_MS);

      expect(proc.kill).toHaveBeenCalledWith('SIGKILL');
    });

    it('does not send SIGKILL when the process has already exited', () => {
      const controller = makeController();
      const proc = makeProc();
      controller.start(proc);
      controller.initiateGracefulShutdown('test reason');
      proc.exitCode = 0;

      jest.advanceTimersByTime(SIGKILL_GRACE_MS);

      expect(proc.kill).not.toHaveBeenCalledWith('SIGKILL');
    });

    it('exposes the shutdown reason that triggered termination', () => {
      const controller = makeController();
      controller.start(makeProc());

      controller.initiateGracefulShutdown('No download activity for 31 minutes');

      expect(controller.shutdownReason).toBe('No download activity for 31 minutes');
      controller.stop();
    });

    it('still records shutdown state and arms the grace timer when SIGTERM throws', () => {
      const controller = makeController();
      const proc = makeProc();
      proc.kill.mockImplementationOnce(() => {
        throw new Error('ESRCH');
      });
      controller.start(proc);

      controller.initiateGracefulShutdown('test reason');

      expect(logger.error).toHaveBeenCalledWith(
        { err: expect.any(Error) },
        'Error sending SIGTERM'
      );
      expect(controller.shutdownInProgress).toBe(true);
      expect(controller.shutdownReason).toBe('test reason');

      jest.advanceTimersByTime(SIGKILL_GRACE_MS);
      expect(proc.kill).toHaveBeenCalledWith('SIGKILL');
    });
  });

  describe('stop', () => {
    it('clears both timers so no further kill signals fire', () => {
      const controller = makeController();
      const proc = makeProc();
      controller.start(proc);

      jest.advanceTimersByTime(ACTIVITY_TIMEOUT_MS + CHECK_INTERVAL_MS);
      expect(proc.kill).toHaveBeenCalledTimes(1);

      controller.stop();
      jest.advanceTimersByTime(MAX_ABSOLUTE_TIMEOUT_MS);

      expect(proc.kill).toHaveBeenCalledTimes(1);
    });
  });
});
