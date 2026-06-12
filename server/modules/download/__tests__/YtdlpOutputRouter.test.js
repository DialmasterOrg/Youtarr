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
  handleErrorLine: jest.fn().mockReturnValue(false)
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

    it('routes ERROR lines to the error tracker and suppresses consumed lines', () => {
      errorTracker.handleErrorLine.mockReturnValue(true);

      router.handleStdoutChunk('ERROR: This video is members-only\n');

      expect(errorTracker.handleErrorLine).toHaveBeenCalledWith('ERROR: This video is members-only', 'stdout');
      // Consumed lines do not reach the progress monitor or emitter
      expect(monitor.processProgress).not.toHaveBeenCalled();
      expect(MessageEmitter.emitMessage).not.toHaveBeenCalled();
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
  });

  describe('handleStderrChunk', () => {
    it('accumulates chunks into stderrBuffer', () => {
      router.handleStderrChunk('WARNING: first\n');
      router.handleStderrChunk('WARNING: second\n');

      expect(router.stderrBuffer).toBe('WARNING: first\nWARNING: second\n');
    });

    it('sets botDetected and broadcasts an error message on bot detection', () => {
      router.handleStderrChunk('Sign in to confirm you\'re not a bot');

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

    it('detects 403s on stderr and emits the cookies suggestion', () => {
      router.handleStderrChunk('HTTP Error 403: Forbidden');

      expect(router.httpForbiddenDetected).toBe(true);
      const cookieCalls = MessageEmitter.emitMessage.mock.calls.filter(
        (call) => call[4] && call[4].errorCode === 'COOKIES_RECOMMENDED'
      );
      expect(cookieCalls).toHaveLength(1);
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
