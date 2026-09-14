/* eslint-env jest */

jest.mock('../../../logger');

jest.mock('../../messageEmitter', () => ({
  emitMessage: jest.fn()
}));

jest.mock('../../filesystem', () => {
  const actualPathBuilder = jest.requireActual('../../filesystem/pathBuilder');
  return {
    isMainVideoFile: jest.fn().mockReturnValue(true),
    extractYoutubeIdFromPath: jest.fn(actualPathBuilder.extractYoutubeIdFromPath),
  };
});

jest.mock('../../../models', () => ({
  JobVideoDownload: {
    findOrCreate: jest.fn().mockResolvedValue([{}, true])
  }
}));

const MessageEmitter = require('../../messageEmitter');
const { JobVideoDownload } = require('../../../models');
const YtdlpOutputRouter = require('../YtdlpOutputRouter');
const videoActivity = require('../videoActivity');
const { VIDEO_PERSISTED_MARKER } = require('../../constants/outputMarkers');

const makeMonitor = () => ({
  hasError: false,
  lastParsed: null,
  processProgress: jest.fn().mockReturnValue({ state: 'downloading_video' }),
  snapshot: jest.fn((state) => ({ state }))
});

const makeErrorTracker = () => ({
  currentVideoId: null,
  trackVideoStart: jest.fn(),
  trackVideoFromDestination: jest.fn(),
  handleErrorLine: jest.fn().mockReturnValue(false),
  handleWarningLine: jest.fn().mockReturnValue(false)
});

const makeTimeoutController = () => ({
  noteLine: jest.fn(),
  noteActivity: jest.fn()
});

describe('YtdlpOutputRouter', () => {
  let router;
  let monitor;
  let errorTracker;
  let timeoutController;

  beforeEach(() => {
    jest.clearAllMocks();
    videoActivity.entries.clear();
    monitor = makeMonitor();
    errorTracker = makeErrorTracker();
    timeoutController = makeTimeoutController();
    router = new YtdlpOutputRouter({
      jobId: 'job-123',
      config: { enableStallDetection: false },
      monitor,
      errorTracker,
      timeoutController
    });
  });

  it('keeps a video busy through 100 percent and merging until persistence', () => {
    router.handleStdoutChunk(Buffer.from('[youtube] Extracting URL: https://www.youtube.com/watch?v=aaaaaaaaaaa\n'));
    router.handleStdoutChunk(Buffer.from('[download] 100% of 1MiB\n[Merger] Merging formats into video.mp4\n'));
    expect(videoActivity.snapshot().videos.aaaaaaaaaaa.state).toBe('downloading');
    router.handleStdoutChunk(Buffer.from(`${VIDEO_PERSISTED_MARKER}aaaaaaaaaaa\n`));
    expect(videoActivity.snapshot().videos.aaaaaaaaaaa).toBeUndefined();
  });

  it('releases an archive skip even when extraction never began', () => {
    videoActivity.claim('job-123', ['https://youtu.be/aaaaaaaaaaa']);
    router.handleStdoutChunk(Buffer.from('[download] aaaaaaaaaaa: has already been recorded in the archive\n'));
    expect(videoActivity.isActive('aaaaaaaaaaa')).toBe(false);
  });

  it('uses the current video for filter skips, not an ID-shaped title word', () => {
    videoActivity.claim('job-123', ['https://youtu.be/Introducing']);
    router.handleStdoutChunk(Buffer.from('[youtube] Extracting URL: https://youtu.be/aaaaaaaaaaa\n'));
    router.handleStdoutChunk(Buffer.from('[download] Introducing: X does not pass filter (members only)\n'));
    expect(videoActivity.isActive('aaaaaaaaaaa')).toBe(false);
    expect(videoActivity.isActive('Introducing')).toBe(true);
  });

  afterEach(() => {
    if (router.progressFlushTimer) {
      clearTimeout(router.progressFlushTimer);
      router.progressFlushTimer = null;
    }
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('handleStdoutChunk', () => {
    it('tracks video extraction by id from extracting-URL lines', () => {
      router.handleStdoutChunk('[youtube] Extracting URL: https://youtube.com/watch?v=abc123XYZ_d\n');

      expect(errorTracker.trackVideoStart).toHaveBeenCalledWith('abc123XYZ_d');
    });

    it('records partial destinations and creates a JobVideoDownload tracking entry', () => {
      router.handleStdoutChunk('[download] Destination: /output/Channel - Title [abc123XYZ_d].mp4\n');

      expect(router.partialDestinations.has('/output/Channel - Title [abc123XYZ_d].mp4')).toBe(true);
      expect(JobVideoDownload.findOrCreate).toHaveBeenCalledWith({
        where: {
          job_id: 'job-123',
          youtube_id: 'abc123XYZ_d'
        },
        defaults: {
          job_id: 'job-123',
          youtube_id: 'abc123XYZ_d',
          file_path: '/output',
          status: 'in_progress'
        }
      });
    });

    it('broadcasts videosUpdated for a video-persisted control marker line', () => {
      router.handleStdoutChunk('[Youtarr:videoPersisted] abc123XYZ_d\n');

      expect(MessageEmitter.emitMessage).toHaveBeenCalledWith(
        'broadcast',
        null,
        'download',
        'videosUpdated',
        { youtubeId: 'abc123XYZ_d' }
      );
      // Marker lines are control messages, not yt-dlp output
      expect(monitor.processProgress).not.toHaveBeenCalled();
    });

    it('routes ERROR lines to the error tracker and suppresses consumed lines', () => {
      errorTracker.handleErrorLine.mockReturnValue(true);

      router.handleStdoutChunk('ERROR: This video is members-only\n');

      expect(errorTracker.handleErrorLine).toHaveBeenCalledWith('ERROR: This video is members-only', 'stdout');
      // Consumed lines do not reach the progress monitor or emitter
      expect(monitor.processProgress).not.toHaveBeenCalled();
      expect(MessageEmitter.emitMessage).not.toHaveBeenCalled();
    });

    it('routes WARNING lines to the error tracker without suppressing them', () => {
      router.handleStdoutChunk('WARNING: Unable to download video subtitles for \'en\': Read timed out.\n');

      expect(errorTracker.handleWarningLine).toHaveBeenCalledWith(
        'WARNING: Unable to download video subtitles for \'en\': Read timed out.',
        'stdout'
      );
      expect(monitor.processProgress).toHaveBeenCalled();
    });

    it('notes activity on the timeout controller for JSON progress lines', () => {
      router.handleStdoutChunk('{"percent":"50.0%","downloaded":"5242880","total":"10485760"}\n');

      expect(timeoutController.noteLine).toHaveBeenCalled();
      expect(timeoutController.noteActivity).toHaveBeenCalled();
    });

    it('sets httpForbiddenDetected and emits the cookies suggestion once for 403 lines', () => {
      router.handleStdoutChunk('HTTP Error 403: Forbidden\n');
      router.handleStdoutChunk('HTTP Error 403: Forbidden\n');

      expect(router.httpForbiddenDetected).toBe(true);
      const cookieCalls = MessageEmitter.emitMessage.mock.calls.filter(
        (call) => call[4] && call[4].errorCode === 'COOKIES_RECOMMENDED'
      );
      expect(cookieCalls).toHaveLength(1);
    });

    it('ignores the mweb PO-token advisory even though it mentions HTTP Error 403', () => {
      router.handleStdoutChunk(
        'WARNING: [youtube] abc: mweb client https formats require a GVS PO Token which was not provided. ' +
        'They will be skipped as they may yield HTTP Error 403.\n'
      );

      expect(router.httpForbiddenDetected).toBe(false);
      expect(MessageEmitter.emitMessage.mock.calls.some(
        (call) => call[4] && call[4].errorCode === 'COOKIES_RECOMMENDED'
      )).toBe(false);
    });
  });

  describe('handleStderrChunk', () => {
    it('accumulates chunks into stderrBuffer', () => {
      router.handleStderrChunk('WARNING: first\n');
      router.handleStderrChunk('WARNING: second\n');

      expect(router.stderrBuffer).toBe('WARNING: first\nWARNING: second\n');
    });

    it('sets botDetected and broadcasts an error message on bot detection', () => {
      router.handleStderrChunk('Sign in to confirm you\'re not a bot\n');

      expect(router.botDetected).toBe(true);
      expect(MessageEmitter.emitMessage).toHaveBeenCalledWith(
        'broadcast',
        null,
        'download',
        'downloadProgress',
        expect.objectContaining({
          error: true,
          progress: { state: 'bot_detected' }
        })
      );
    });

    it('classifies every ERROR line when a chunk coalesces multiple lines', () => {
      router.handleStderrChunk('ERROR: first failure\nERROR: second failure\n');

      expect(errorTracker.handleErrorLine).toHaveBeenCalledWith('ERROR: first failure', 'stderr');
      expect(errorTracker.handleErrorLine).toHaveBeenCalledWith('ERROR: second failure', 'stderr');
    });

    it('routes WARNING lines to the error tracker after the ERROR lines in the same chunk', () => {
      router.handleStderrChunk(
        'ERROR: [download] Got error: Read timed out. Giving up after 2 retries\n' +
        'WARNING: Unable to download video subtitles for \'en\': Read timed out.\n'
      );

      expect(errorTracker.handleErrorLine).toHaveBeenCalledWith(
        'ERROR: [download] Got error: Read timed out. Giving up after 2 retries',
        'stderr'
      );
      expect(errorTracker.handleWarningLine).toHaveBeenCalledWith(
        'WARNING: Unable to download video subtitles for \'en\': Read timed out.',
        'stderr'
      );
      expect(errorTracker.handleErrorLine.mock.invocationCallOrder[0])
        .toBeLessThan(errorTracker.handleWarningLine.mock.invocationCallOrder[0]);
    });

    it('detects 403s on stderr and emits the cookies suggestion', () => {
      router.handleStderrChunk('HTTP Error 403: Forbidden\n');

      expect(router.httpForbiddenDetected).toBe(true);
      const cookieCalls = MessageEmitter.emitMessage.mock.calls.filter(
        (call) => call[4] && call[4].errorCode === 'COOKIES_RECOMMENDED'
      );
      expect(cookieCalls).toHaveLength(1);
    });

    it('does not treat the mweb PO-token advisory as a 403', () => {
      router.handleStderrChunk(
        'WARNING: [youtube] abc: mweb client https formats require a GVS PO Token which was not provided. ' +
        'They will be skipped as they may yield HTTP Error 403. You can manually pass a GVS PO Token\n'
      );

      expect(router.httpForbiddenDetected).toBe(false);
      expect(MessageEmitter.emitMessage.mock.calls.some(
        (call) => call[4] && call[4].errorCode === 'COOKIES_RECOMMENDED'
      )).toBe(false);
    });

    it('still detects a real 403 in a chunk that also carries the PO-token advisory', () => {
      router.handleStderrChunk(
        'WARNING: [youtube] abc: mweb client https formats require a GVS PO Token which was not provided. ' +
        'They will be skipped as they may yield HTTP Error 403.\n' +
        'ERROR: unable to download video data: HTTP Error 403: Forbidden\n'
      );

      expect(router.httpForbiddenDetected).toBe(true);
    });

    it('broadcasts a one-time SABR restriction warning when YouTube strips formats for the account', () => {
      const sabrLine =
        'WARNING: [youtube] abc: Some web_embedded client https formats have been skipped as they are missing a URL. ' +
        'YouTube may have enabled the SABR-only streaming experiment for your account. See  https://github.com/yt-dlp/yt-dlp/issues/12482  for more details\n';
      router.handleStderrChunk(sabrLine);
      router.handleStderrChunk(sabrLine);

      expect(router.sabrRestrictionDetected).toBe(true);
      const sabrCalls = MessageEmitter.emitMessage.mock.calls.filter(
        (call) => call[4] && call[4].errorCode === 'SABR_RESTRICTED_FORMATS'
      );
      expect(sabrCalls).toHaveLength(1);
      expect(sabrCalls[0][4].warning).toBe(true);
      expect(sabrCalls[0][4].text).toMatch(/1080p/);
      expect(router.httpForbiddenDetected).toBe(false);
    });

    it('holds a partial stderr line until its newline arrives before classifying it', () => {
      router.handleStderrChunk('WARNING: [youtube] abc: mweb client https formats require a GVS PO Token which was not provided. ');
      router.handleStderrChunk('They will be skipped as they may yield HTTP Error 403.\n');

      expect(router.httpForbiddenDetected).toBe(false);
      expect(errorTracker.handleWarningLine).toHaveBeenCalledTimes(1);
      expect(errorTracker.handleWarningLine).toHaveBeenCalledWith(
        'WARNING: [youtube] abc: mweb client https formats require a GVS PO Token which was not provided. ' +
        'They will be skipped as they may yield HTTP Error 403.',
        'stderr'
      );
    });

    it('emits the SABR warning when its phrase is split across chunks', () => {
      router.handleStderrChunk('WARNING: [youtube] abc: YouTube may have enabled the SABR-only streaming ');
      router.handleStderrChunk('experiment for your account.\n');

      expect(router.sabrRestrictionDetected).toBe(true);
      expect(MessageEmitter.emitMessage.mock.calls.filter(
        (call) => call[4] && call[4].errorCode === 'SABR_RESTRICTED_FORMATS'
      )).toHaveLength(1);
    });

    it('flushes a trailing line that never received a newline when the run is disposed', () => {
      router.handleStderrChunk('ERROR: unable to download video data: HTTP Error 403: Forbidden');

      expect(errorTracker.handleErrorLine).not.toHaveBeenCalled();
      expect(router.httpForbiddenDetected).toBe(false);

      router.dispose();

      expect(errorTracker.handleErrorLine).toHaveBeenCalledWith(
        'ERROR: unable to download video data: HTTP Error 403: Forbidden',
        'stderr'
      );
      expect(router.httpForbiddenDetected).toBe(true);
    });

    it('keeps the raw stderr buffer complete regardless of line buffering', () => {
      router.handleStderrChunk('WARNING: partial ');
      router.handleStderrChunk('line\nERROR: whole line\n');

      expect(router.stderrBuffer).toBe('WARNING: partial line\nERROR: whole line\n');
    });

    it('ignores stderr that arrives after dispose without mutating state or broadcasting', () => {
      router.handleStderrChunk('WARNING: first\n');
      router.dispose();
      MessageEmitter.emitMessage.mockClear();
      errorTracker.handleErrorLine.mockClear();

      router.handleStderrChunk('ERROR: unable to download video data: HTTP Error 403: Forbidden\n');

      expect(router.stderrBuffer).toBe('WARNING: first\n');
      expect(router.httpForbiddenDetected).toBe(false);
      expect(errorTracker.handleErrorLine).not.toHaveBeenCalled();
      expect(MessageEmitter.emitMessage).not.toHaveBeenCalled();
    });

    it('ignores stdout that arrives after dispose', () => {
      router.dispose();
      MessageEmitter.emitMessage.mockClear();

      router.handleStdoutChunk('[youtube] Extracting URL: https://www.youtube.com/watch?v=aaaaaaaaaaa\nHTTP Error 403: Forbidden\n');

      expect(router.httpForbiddenDetected).toBe(false);
      expect(errorTracker.trackVideoStart).not.toHaveBeenCalled();
      expect(MessageEmitter.emitMessage).not.toHaveBeenCalled();
    });
  });

  describe('context-aware hints when cookies are enabled', () => {
    let cookiesRouter;

    beforeEach(() => {
      cookiesRouter = new YtdlpOutputRouter({
        jobId: 'job-123',
        config: { enableStallDetection: false },
        monitor: makeMonitor(),
        errorTracker: makeErrorTracker(),
        timeoutController: makeTimeoutController(),
        cookiesEnabled: true
      });
    });

    afterEach(() => {
      if (cookiesRouter.progressFlushTimer) {
        clearTimeout(cookiesRouter.progressFlushTimer);
        cookiesRouter.progressFlushTimer = null;
      }
    });

    it('suggests refreshing or disabling cookies on 403 instead of enabling them', () => {
      cookiesRouter.handleStderrChunk('HTTP Error 403: Forbidden\n');

      const call = MessageEmitter.emitMessage.mock.calls.find(
        (c) => c[4] && c[4].errorCode === 'COOKIES_MAY_BE_STALE'
      );
      expect(call).toBeDefined();
      expect(call[4].text).toMatch(/re-exporting fresh cookies/i);
      expect(call[4].text).toMatch(/disable cookies/i);
      expect(
        MessageEmitter.emitMessage.mock.calls.some(
          (c) => c[4] && c[4].errorCode === 'COOKIES_RECOMMENDED'
        )
      ).toBe(false);
    });

    it('suggests refreshing cookies on bot detection instead of setting them', () => {
      cookiesRouter.handleStderrChunk('Sign in to confirm you\'re not a bot\n');

      const call = MessageEmitter.emitMessage.mock.calls.find(
        (c) => c[4] && c[4].progress && c[4].progress.state === 'bot_detected'
      );
      expect(call).toBeDefined();
      expect(call[4].text).toMatch(/likely expired or rotated/i);
      expect(call[4].text).not.toMatch(/set cookies/i);
    });
  });

  describe('isImportantMessage', () => {
    it('should identify download destination messages as important', () => {
      const line = '[download] Destination: /output/Channel - Title [abc123].mp4';
      expect(router.isImportantMessage(line, null)).toBe(true);
    });

    it('should identify merger messages as important', () => {
      const line = '[Merger] Merging formats into "output.mp4"';
      expect(router.isImportantMessage(line, null)).toBe(true);
    });

    it('should identify move files messages as important', () => {
      const line = '[MoveFiles] Moving file from temp to final location';
      expect(router.isImportantMessage(line, null)).toBe(true);
    });

    it('should identify metadata messages as important', () => {
      const line = '[Metadata] Adding metadata to file';
      expect(router.isImportantMessage(line, null)).toBe(true);
    });

    it('should identify extract audio messages as important', () => {
      const line = '[ExtractAudio] Extracting audio from video';
      expect(router.isImportantMessage(line, null)).toBe(true);
    });

    it('should identify completion messages as important', () => {
      const line = '[download] 100% of 10.00MiB';
      expect(router.isImportantMessage(line, null)).toBe(true);
    });

    it('should identify new item download messages as important', () => {
      const line = '[download] Downloading item 5 of 10';
      expect(router.isImportantMessage(line, null)).toBe(true);
    });

    it('should identify already archived messages as important', () => {
      const line = '[download] Video abc123 has already been recorded in the archive';
      expect(router.isImportantMessage(line, null)).toBe(true);
    });

    it('should identify filter skip messages as important', () => {
      const line = '[download] Video does not pass filter (subscribers only)';
      expect(router.isImportantMessage(line, null)).toBe(true);
    });

    it('should identify error messages as important', () => {
      const line = 'ERROR: Unable to download video';
      expect(router.isImportantMessage(line, null)).toBe(true);
    });

    it('should identify warning messages as important', () => {
      const line = 'WARNING: Video format may not be supported';
      expect(router.isImportantMessage(line, null)).toBe(true);
    });

    it('should identify HTTP 403 errors as important', () => {
      expect(router.isImportantMessage('HTTP Error 403: Forbidden', null)).toBe(true);
      expect(router.isImportantMessage('Server returned 403: Forbidden', null)).toBe(true);
    });

    it('should identify bot detection messages as important', () => {
      const line = 'Sign in to confirm you\'re not a bot';
      expect(router.isImportantMessage(line, null)).toBe(true);
    });

    it('should identify state changes as important', () => {
      router.lastEmittedProgressState = 'downloading_video';
      const progress = { state: 'merging' };
      expect(router.isImportantMessage('[download] Some progress', progress)).toBe(true);
    });

    it('should not mark regular progress messages as important', () => {
      router.lastEmittedProgressState = 'downloading_video';
      const progress = { state: 'downloading_video' };
      const line = '{"percent":"50.0%","downloaded":"5242880","total":"10485760"}';
      expect(router.isImportantMessage(line, progress)).toBe(false);
    });

    it('should not mark empty lines as important', () => {
      expect(router.isImportantMessage('', null)).toBe(false);
    });
  });

  describe('emitProgressMessage', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.clearAllMocks();
    });

    afterEach(() => {
      if (router.progressFlushTimer) {
        clearTimeout(router.progressFlushTimer);
        router.progressFlushTimer = null;
      }
      jest.useRealTimers();
    });

    it('should emit important messages immediately', () => {
      const line = '[download] Destination: /output/video.mp4';
      const progress = { state: 'downloading_video' };

      router.emitProgressMessage(line, progress);

      expect(MessageEmitter.emitMessage).toHaveBeenCalledTimes(1);
      expect(MessageEmitter.emitMessage).toHaveBeenCalledWith(
        'broadcast',
        null,
        'download',
        'downloadProgress',
        { text: line, progress: progress }
      );
    });

    it('should clear pending timer when important message is sent', () => {
      router.pendingProgressMessage = { text: 'pending', progress: null };
      router.progressFlushTimer = setTimeout(() => {}, 1000);

      const line = '[download] Destination: /output/video.mp4';
      router.emitProgressMessage(line, null);

      expect(router.pendingProgressMessage).toBeNull();
      expect(router.progressFlushTimer).toBeNull();
    });

    it('should throttle progress messages to 250ms intervals', () => {
      // First message should go through immediately
      router.emitProgressMessage('Progress 1', { state: 'downloading_video' });
      expect(MessageEmitter.emitMessage).toHaveBeenCalledTimes(1);

      // Second message within 250ms should be pending
      jest.advanceTimersByTime(100);
      router.emitProgressMessage('Progress 2', { state: 'downloading_video' });
      expect(MessageEmitter.emitMessage).toHaveBeenCalledTimes(1); // Still only 1

      // Third message should update pending
      jest.advanceTimersByTime(50);
      router.emitProgressMessage('Progress 3', { state: 'downloading_video' });
      expect(MessageEmitter.emitMessage).toHaveBeenCalledTimes(1); // Still only 1

      // After 250ms total, pending message should flush
      jest.advanceTimersByTime(100); // Total 250ms
      expect(MessageEmitter.emitMessage).toHaveBeenCalledTimes(2);
      expect(MessageEmitter.emitMessage).toHaveBeenLastCalledWith(
        'broadcast',
        null,
        'download',
        'downloadProgress',
        { text: 'Progress 3', progress: { state: 'downloading_video' } }
      );
    });

    it('should send progress message immediately if 250ms has elapsed', () => {
      router.emitProgressMessage('Progress 1', null);
      expect(MessageEmitter.emitMessage).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(250);

      // Next message should go through immediately
      router.emitProgressMessage('Progress 2', null);
      expect(MessageEmitter.emitMessage).toHaveBeenCalledTimes(2);
    });

    it('should update lastEmittedProgressState when state changes', () => {
      const progress = { state: 'downloading_video' };
      router.emitProgressMessage('[download] Destination: /output/video.mp4', progress);

      expect(router.lastEmittedProgressState).toBe('downloading_video');
    });

    it('should only create one flush timer for multiple rapid messages', () => {
      router.emitProgressMessage('Progress 1', null);
      router.emitProgressMessage('Progress 2', null);
      router.emitProgressMessage('Progress 3', null);

      expect(router.progressFlushTimer).not.toBeNull();

      jest.advanceTimersByTime(250);

      expect(router.progressFlushTimer).toBeNull();
    });

    it('should handle null progress gracefully', () => {
      router.emitProgressMessage('Some message', null);

      expect(MessageEmitter.emitMessage).toHaveBeenCalledWith(
        'broadcast',
        null,
        'download',
        'downloadProgress',
        { text: 'Some message', progress: null }
      );
    });
  });

  describe('heartbeat', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.clearAllMocks();
    });

    afterEach(() => {
      router.dispose();
      jest.useRealTimers();
    });

    it('rebroadcasts the current monitor snapshot after a quiet interval', () => {
      monitor.snapshot.mockReturnValue({ state: 'merging' });

      router.startHeartbeat();
      jest.advanceTimersByTime(25000);

      expect(monitor.snapshot).toHaveBeenCalledWith();
      expect(MessageEmitter.emitMessage).toHaveBeenCalledWith(
        'broadcast',
        null,
        'download',
        'downloadProgress',
        { progress: { state: 'merging' } }
      );
    });

    it('does not rebroadcast while output was recently emitted', () => {
      router.startHeartbeat();

      jest.advanceTimersByTime(20000);
      router.emitProgressMessage('[Merger] Merging formats into "out.mp4"', { state: 'merging' });
      MessageEmitter.emitMessage.mockClear();

      jest.advanceTimersByTime(5000);

      expect(MessageEmitter.emitMessage).not.toHaveBeenCalled();
    });

    it('resumes heartbeating once the quiet stretch reaches a full interval', () => {
      router.startHeartbeat();

      jest.advanceTimersByTime(20000);
      router.emitProgressMessage('[Merger] Merging formats into "out.mp4"', { state: 'merging' });
      MessageEmitter.emitMessage.mockClear();

      // Ticks at 25s (5s of silence, skipped) and 50s (30s of silence, emits)
      jest.advanceTimersByTime(30000);

      expect(MessageEmitter.emitMessage).toHaveBeenCalledTimes(1);
    });

    it('dispose stops the heartbeat', () => {
      router.startHeartbeat();
      router.dispose();

      jest.advanceTimersByTime(120000);

      expect(MessageEmitter.emitMessage).not.toHaveBeenCalled();
    });

    it('restarting the heartbeat does not leak the previous interval', () => {
      router.startHeartbeat();
      router.startHeartbeat();
      router.dispose();

      jest.advanceTimersByTime(120000);

      expect(MessageEmitter.emitMessage).not.toHaveBeenCalled();
    });
  });

  describe('dispose', () => {
    it('clears the flush timer and emits the pending message', () => {
      jest.useFakeTimers();
      router.emitProgressMessage('Progress 1', null);
      jest.advanceTimersByTime(100);
      router.emitProgressMessage('Progress 2', null);
      expect(MessageEmitter.emitMessage).toHaveBeenCalledTimes(1);

      router.dispose();

      expect(router.progressFlushTimer).toBeNull();
      expect(router.pendingProgressMessage).toBeNull();
      expect(MessageEmitter.emitMessage).toHaveBeenCalledTimes(2);
      expect(MessageEmitter.emitMessage).toHaveBeenLastCalledWith(
        'broadcast',
        null,
        'download',
        'downloadProgress',
        { text: 'Progress 2', progress: null }
      );
    });

    it('is a no-op when nothing is pending', () => {
      router.dispose();

      expect(MessageEmitter.emitMessage).not.toHaveBeenCalled();
    });
  });
});
