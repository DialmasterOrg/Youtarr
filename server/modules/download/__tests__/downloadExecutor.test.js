/* eslint-env jest */

// Mock fs first to prevent configModule from reading files
jest.mock('fs');

// Mock all modules before requiring them
jest.mock('child_process');
jest.mock('../DownloadProgressMonitor');
jest.mock('../videoMetadataProcessor');
jest.mock('../../configModule', () => ({
  getConfig: jest.fn(),
  getJobsPath: jest.fn(() => '/mock/jobs/path')
}));
jest.mock('../../plexModule', () => ({
  refreshLibrary: jest.fn()
}));
jest.mock('../../jobModule', () => ({
  updateJob: jest.fn(),
  startNextJob: jest.fn()
}));
jest.mock('../../messageEmitter', () => ({
  emitMessage: jest.fn()
}));
jest.mock('../../archiveModule', () => ({
  readCompleteListLines: jest.fn(),
  getNewVideoUrlsSince: jest.fn()
}));
jest.mock('../../notificationModule', () => ({
  sendDownloadNotification: jest.fn().mockResolvedValue()
}));

const { spawn } = require('child_process');
const { EventEmitter } = require('events');
const DownloadExecutor = require('../downloadExecutor');
const DownloadProgressMonitor = require('../DownloadProgressMonitor');
const VideoMetadataProcessor = require('../videoMetadataProcessor');
const configModule = require('../../configModule');
const plexModule = require('../../plexModule');
const jobModule = require('../../jobModule');
const MessageEmitter = require('../../messageEmitter');
const notificationModule = require('../../notificationModule');

describe('DownloadExecutor', () => {
  let executor;
  let mockProcess;
  let mockMonitor;
  let mockConfig;
  let archiveModule;
  let fs;
  let fsPromises;
  let consoleLogSpy;
  let consoleErrorSpy;

  beforeAll(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Don't reset modules - it breaks the jest.mock() setup
    jest.useFakeTimers();

    // Setup fs mocks
    fs = require('fs');
    fsPromises = {
      access: jest.fn(),
      unlink: jest.fn(),
      readdir: jest.fn()
    };
    fs.promises = fsPromises;

    // Setup archive module mock
    archiveModule = require('../../archiveModule');
    archiveModule.readCompleteListLines = jest.fn().mockReturnValue(['video1', 'video2', 'video3']);
    archiveModule.getNewVideoUrlsSince = jest.fn().mockReturnValue([
      'https://youtube.com/watch?v=abc123',
      'https://youtube.com/watch?v=def456'
    ]);

    // Setup mock process
    mockProcess = new EventEmitter();
    mockProcess.stdout = new EventEmitter();
    mockProcess.stderr = new EventEmitter();
    mockProcess.kill = jest.fn();
    spawn.mockReturnValue(mockProcess);

    // Setup mock monitor
    mockMonitor = {
      videoCount: {
        total: 0,
        current: 1,
        completed: 0,
        skipped: 0
      },
      snapshot: jest.fn().mockReturnValue({
        state: 'initiating',
        progress: { percent: 0 }
      }),
      processProgress: jest.fn().mockReturnValue({
        state: 'downloading',
        progress: { percent: 50 }
      }),
      lastParsed: null,
      hasError: false,
      currentChannelName: null
    };
    DownloadProgressMonitor.mockImplementation(() => mockMonitor);

    // Setup mock config
    mockConfig = {
      downloadSocketTimeoutSeconds: 300,
      downloadRetryCount: 3,
      youtubeOutputDirectory: '/path/to/videos'
    };
    configModule.getConfig.mockReturnValue(mockConfig);

    // Setup other mocks
    VideoMetadataProcessor.processVideoMetadata = jest.fn().mockReturnValue([
      { title: 'Video 1', url: 'https://youtube.com/watch?v=abc123' },
      { title: 'Video 2', url: 'https://youtube.com/watch?v=def456' }
    ]);

    plexModule.refreshLibrary = jest.fn().mockResolvedValue();
    jobModule.updateJob = jest.fn().mockResolvedValue();
    jobModule.startNextJob = jest.fn();
    MessageEmitter.emitMessage = jest.fn();
    notificationModule.sendDownloadNotification = jest.fn().mockResolvedValue();

    executor = new DownloadExecutor();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('constructor', () => {
    it('should initialize with null tempChannelsFile', () => {
      expect(executor.tempChannelsFile).toBeNull();
    });

    it('should initialize timeout configuration', () => {
      expect(executor.activityTimeoutMs).toBe(30 * 60 * 1000);
      expect(executor.maxAbsoluteTimeoutMs).toBe(4 * 60 * 60 * 1000);
    });

    it('should initialize process tracking properties', () => {
      expect(executor.currentProcess).toBeNull();
      expect(executor.currentJobId).toBeNull();
      expect(executor.manualTerminationReason).toBeNull();
    });
  });

  describe('getCountOfDownloadedVideos', () => {
    it('should return the count of lines in archive', () => {
      const count = executor.getCountOfDownloadedVideos();
      expect(count).toBe(3);
      expect(archiveModule.readCompleteListLines).toHaveBeenCalled();
    });
  });

  describe('getNewVideoUrls', () => {
    it('should return new video URLs since initial count', () => {
      const urls = executor.getNewVideoUrls(3);
      expect(urls).toHaveLength(2);
      expect(archiveModule.getNewVideoUrlsSince).toHaveBeenCalledWith(3);
    });
  });

  describe('cleanupPartialFiles', () => {
    beforeEach(() => {
      fsPromises.access.mockImplementation((path) => {
        if (path.endsWith('.part')) {
          return Promise.resolve();
        }
        return Promise.reject(new Error('File not found'));
      });
      fsPromises.readdir.mockResolvedValue([
        'video.f137.mp4',
        'video.f140.m4a',
        'video.f999.mp4',
        'other.mp4'
      ]);
      fsPromises.unlink.mockResolvedValue();
    });

    it('should remove .part files', async () => {
      await executor.cleanupPartialFiles(['/path/to/video.mp4']);

      expect(fsPromises.unlink).toHaveBeenCalledWith('/path/to/video.mp4.part');
    });

    it('should remove fragment files', async () => {
      await executor.cleanupPartialFiles(['/path/to/video.mp4']);

      expect(fsPromises.unlink).toHaveBeenCalledWith('/path/to/video.f137.mp4');
      expect(fsPromises.unlink).toHaveBeenCalledWith('/path/to/video.f140.m4a');
      expect(fsPromises.unlink).toHaveBeenCalledWith('/path/to/video.f999.mp4');
    });

    it('should handle errors gracefully', async () => {
      fsPromises.unlink.mockRejectedValue(new Error('Permission denied'));

      await executor.cleanupPartialFiles(['/path/to/video.mp4']);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error cleaning up'),
        expect.any(Error)
      );
    });

    it('should handle non-existent files', async () => {
      fsPromises.access.mockRejectedValue(new Error('File not found'));

      await executor.cleanupPartialFiles(['/path/to/nonexistent.mp4']);

      expect(fsPromises.unlink).not.toHaveBeenCalled();
    });
  });

  describe('doDownload', () => {
    const mockArgs = ['--output', '/path/to/video.mp4', 'https://youtube.com/watch?v=123'];
    const mockJobId = 'job-123';
    const mockJobType = 'Channel Downloads';

    it('should spawn yt-dlp process with correct arguments', async () => {
      const downloadPromise = executor.doDownload(mockArgs, mockJobId, mockJobType);

      expect(spawn).toHaveBeenCalledWith('yt-dlp', mockArgs);

      mockProcess.emit('exit', 0);
      await downloadPromise;
    });

    it('should emit initial download progress message', async () => {
      const downloadPromise = executor.doDownload(mockArgs, mockJobId, mockJobType);

      expect(MessageEmitter.emitMessage).toHaveBeenCalledWith(
        'broadcast',
        null,
        'download',
        'downloadProgress',
        expect.objectContaining({
          text: 'Initiating download...',
          clearPreviousSummary: true
        })
      );

      mockProcess.emit('exit', 0);
      await downloadPromise;
    });

    it('should set manual URL count for manually added URLs', async () => {
      const downloadPromise = executor.doDownload(mockArgs, mockJobId, 'Manually Added Urls', 5);

      expect(mockMonitor.videoCount.total).toBe(5);

      mockProcess.emit('exit', 0);
      await downloadPromise;
    });

    it('should store process references for manual termination', () => {
      executor.doDownload(mockArgs, mockJobId, mockJobType);

      expect(executor.currentProcess).toBe(mockProcess);
      expect(executor.currentJobId).toBe(mockJobId);
    });

    it('should clear process references after successful completion', async () => {
      const downloadPromise = executor.doDownload(mockArgs, mockJobId, mockJobType);

      // Verify references are set
      expect(executor.currentProcess).toBe(mockProcess);
      expect(executor.currentJobId).toBe(mockJobId);

      mockProcess.emit('exit', 0);
      await downloadPromise;

      // Verify references are cleared
      expect(executor.currentProcess).toBeNull();
      expect(executor.currentJobId).toBeNull();
    });

    it('should set timeout based on activity tracking', () => {
      executor.doDownload(mockArgs, mockJobId, mockJobType);

      // Check that an interval timer was set (timeout checker runs every minute)
      expect(jest.getTimerCount()).toBeGreaterThan(0);

      // Advance to activity timeout (30 minutes of no activity)
      // The timeout checker runs every minute, so we need to advance in minute increments
      for (let i = 0; i < 31; i++) {
        jest.advanceTimersByTime(60 * 1000); // Advance 1 minute at a time
      }

      // After 30+ minutes of no activity, graceful shutdown should be initiated with SIGTERM
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
    });

    describe('stdout handling', () => {
      it('should process stdout data and emit progress messages', async () => {
        const downloadPromise = executor.doDownload(mockArgs, mockJobId, mockJobType);

        const testLine = '[download] Downloading video 1 of 10';
        mockProcess.stdout.emit('data', Buffer.from(testLine));

        expect(mockMonitor.processProgress).toHaveBeenCalledWith(
          '{}',
          testLine,
          mockConfig
        );
        expect(MessageEmitter.emitMessage).toHaveBeenCalledWith(
          'broadcast',
          null,
          'download',
          'downloadProgress',
          expect.objectContaining({
            text: testLine
          })
        );

        mockProcess.emit('exit', 0);
        await downloadPromise;
      });

      it('should track destination files for cleanup', async () => {
        // Setup fs mocks for cleanup
        fsPromises.access.mockResolvedValue();
        fsPromises.unlink.mockResolvedValue();
        fsPromises.readdir.mockResolvedValue([]);

        const downloadPromise = executor.doDownload(mockArgs, mockJobId, mockJobType);

        const destLine = '[download] Destination: /path/to/video.mp4';
        mockProcess.stdout.emit('data', Buffer.from(destLine));

        mockProcess.emit('exit', 1);
        await downloadPromise;

        expect(fsPromises.unlink).toHaveBeenCalledWith('/path/to/video.mp4.part');
      });

      it('should parse JSON progress when available', async () => {
        const downloadPromise = executor.doDownload(mockArgs, mockJobId, mockJobType);

        const jsonProgress = { percent: 50, downloaded: 1000000 };
        mockMonitor.processProgress.mockReturnValueOnce(jsonProgress);

        const jsonLine = `Some text ${JSON.stringify(jsonProgress)}`;
        mockProcess.stdout.emit('data', Buffer.from(jsonLine));

        expect(mockMonitor.processProgress).toHaveBeenCalledWith(
          JSON.stringify(jsonProgress),
          jsonLine,
          mockConfig
        );

        mockProcess.emit('exit', 0);
        await downloadPromise;
      });

      it('should handle multiline stdout data', async () => {
        const downloadPromise = executor.doDownload(mockArgs, mockJobId, mockJobType);

        const multilineData = 'Line 1\nLine 2\n\nLine 3\n';
        mockProcess.stdout.emit('data', Buffer.from(multilineData));

        // Should process non-empty lines
        expect(mockMonitor.processProgress).toHaveBeenCalledTimes(3);
        expect(MessageEmitter.emitMessage).toHaveBeenCalledTimes(4); // 1 initial + 3 lines

        mockProcess.emit('exit', 0);
        await downloadPromise;
      });
    });

    describe('stderr handling', () => {
      it('should detect bot detection message', async () => {
        const downloadPromise = executor.doDownload(mockArgs, mockJobId, mockJobType);

        const botMessage = 'Sign in to confirm you are not a bot';
        mockProcess.stderr.emit('data', Buffer.from(botMessage));

        expect(MessageEmitter.emitMessage).toHaveBeenCalledWith(
          'broadcast',
          null,
          'download',
          'downloadProgress',
          expect.objectContaining({
            text: expect.stringContaining('Bot detection encountered'),
            error: true
          })
        );

        mockProcess.emit('exit', 1);
        await downloadPromise;

        expect(jobModule.updateJob).toHaveBeenCalledWith(
          mockJobId,
          expect.objectContaining({
            status: 'Error',
            output: expect.stringContaining('Bot detection'),
            error: 'COOKIES_REQUIRED'
          })
        );
      });

      it('should accumulate stderr buffer', async () => {
        const downloadPromise = executor.doDownload(mockArgs, mockJobId, mockJobType);

        mockProcess.stderr.emit('data', Buffer.from('Error part 1 '));
        mockProcess.stderr.emit('data', Buffer.from('Error part 2'));

        mockProcess.emit('exit', 1);
        await downloadPromise;

        expect(jobModule.updateJob).toHaveBeenCalledWith(
          mockJobId,
          expect.objectContaining({
            status: 'Error'
          })
        );
      });
    });

    describe('exit handling', () => {
      it('should handle successful exit (code 0)', async () => {
        const downloadPromise = executor.doDownload(mockArgs, mockJobId, mockJobType);

        mockProcess.emit('exit', 0);
        await downloadPromise;

        expect(jobModule.updateJob).toHaveBeenCalledWith(
          mockJobId,
          expect.objectContaining({
            status: 'Complete',
            output: '2 videos.'
          })
        );
        expect(plexModule.refreshLibrary).toHaveBeenCalled();
        expect(jobModule.startNextJob).toHaveBeenCalled();
      });

      it('should cleanup partial files on successful exit when destinations tracked', async () => {
        fsPromises.access.mockResolvedValue();
        fsPromises.readdir.mockResolvedValue(['video.f401.mp4', 'other.mp4']);
        fsPromises.unlink.mockResolvedValue();

        const downloadPromise = executor.doDownload(mockArgs, mockJobId, mockJobType);

        mockProcess.stdout.emit('data', Buffer.from('[download] Destination: /path/to/video.mp4'));

        mockProcess.emit('exit', 0);
        await downloadPromise;

        expect(fsPromises.unlink).toHaveBeenCalledWith('/path/to/video.mp4.part');
        expect(fsPromises.unlink).toHaveBeenCalledWith('/path/to/video.f401.mp4');
      });

      it('should ignore cleanup when no destinations tracked', async () => {
        fsPromises.unlink.mockResolvedValue();

        const downloadPromise = executor.doDownload(mockArgs, mockJobId, mockJobType);

        mockProcess.emit('exit', 0);
        await downloadPromise;

        expect(fsPromises.unlink).not.toHaveBeenCalledWith(expect.stringContaining('.part'));
      });

      it('should log errors when cleanup fails', async () => {
        fsPromises.access.mockResolvedValue();
        const cleanupError = new Error('permission denied');
        fsPromises.unlink.mockRejectedValue(cleanupError);

        const downloadPromise = executor.doDownload(mockArgs, mockJobId, mockJobType);

        mockProcess.stdout.emit('data', Buffer.from('[download] Destination: /path/to/video.mp4'));
        mockProcess.emit('exit', 0);
        await downloadPromise;

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('Error cleaning up'),
          cleanupError
        );
      });

      it('should handle exit with warnings (code 0 with stderr)', async () => {
        const downloadPromise = executor.doDownload(mockArgs, mockJobId, mockJobType);

        mockProcess.stderr.emit('data', Buffer.from('WARNING: Some warning'));
        mockProcess.emit('exit', 0);
        await downloadPromise;

        expect(jobModule.updateJob).toHaveBeenCalledWith(
          mockJobId,
          expect.objectContaining({
            status: 'Complete with Warnings',
            output: '2 videos.'
          })
        );
      });

      it('should handle failed exit (non-zero code)', async () => {
        const downloadPromise = executor.doDownload(mockArgs, mockJobId, mockJobType);

        mockProcess.emit('exit', 1);
        await downloadPromise;

        expect(jobModule.updateJob).toHaveBeenCalledWith(
          mockJobId,
          expect.objectContaining({
            status: 'Error',
            output: expect.stringContaining('Error: Command exited with code 1')
          })
        );
      });

      it('should handle killed process (SIGKILL)', async () => {
        const downloadPromise = executor.doDownload(mockArgs, mockJobId, mockJobType);

        mockProcess.emit('exit', null, 'SIGKILL');
        await downloadPromise;

        expect(jobModule.updateJob).toHaveBeenCalledWith(
          mockJobId,
          expect.objectContaining({
            status: 'Killed'
          })
        );
      });

      it('should cleanup partial files on failure', async () => {
        fsPromises.access.mockResolvedValue();
        fsPromises.unlink.mockResolvedValue();

        const downloadPromise = executor.doDownload(mockArgs, mockJobId, mockJobType);

        mockProcess.stdout.emit('data', Buffer.from('[download] Destination: /path/to/video.mp4'));
        mockProcess.emit('exit', 1);
        await downloadPromise;

        expect(fsPromises.unlink).toHaveBeenCalledWith('/path/to/video.mp4.part');
      });

      it('should emit final summary message', async () => {
        mockMonitor.videoCount.completed = 2;
        mockMonitor.videoCount.skipped = 3;

        const downloadPromise = executor.doDownload(mockArgs, mockJobId, mockJobType);

        mockProcess.emit('exit', 0);
        await downloadPromise;

        expect(MessageEmitter.emitMessage).toHaveBeenLastCalledWith(
          'broadcast',
          null,
          'download',
          'downloadProgress',
          expect.objectContaining({
            text: expect.stringContaining('Download completed'),
            finalSummary: expect.objectContaining({
              totalDownloaded: 2,
              totalSkipped: 3,
              jobType: mockJobType
            })
          })
        );
      });

      it('should cleanup temp channels file if exists', async () => {
        executor.tempChannelsFile = '/tmp/channels.txt';
        fsPromises.unlink.mockResolvedValue();

        const downloadPromise = executor.doDownload(mockArgs, mockJobId, mockJobType);

        mockProcess.emit('exit', 0);
        await downloadPromise;

        expect(fsPromises.unlink).toHaveBeenCalledWith('/tmp/channels.txt');
        expect(executor.tempChannelsFile).toBeNull();
      });

      it('should handle warnings as successful when videos are processed', async () => {
        mockMonitor.videoCount.completed = 5;
        mockMonitor.snapshot.mockReturnValue({
          state: 'complete',
          progress: { percent: 100 }
        });

        const downloadPromise = executor.doDownload(mockArgs, mockJobId, mockJobType);

        mockProcess.emit('exit', 1); // Exit code 1 usually means warnings
        await downloadPromise;

        // The final message should show completion
        const calls = MessageEmitter.emitMessage.mock.calls;
        const lastCall = calls[calls.length - 1];
        expect(lastCall[3]).toBe('downloadProgress');
        expect(lastCall[4].text).toContain('Download completed');
        expect(lastCall[4].progress.state).toBe('complete');
      });

      it('should add stall detection note when applicable', async () => {
        mockMonitor.lastParsed = {
          stalled: true,
          progress: {
            percent: 45.5,
            speedBytesPerSecond: 10240
          }
        };

        const downloadPromise = executor.doDownload(mockArgs, mockJobId, mockJobType);

        mockProcess.emit('exit', 1);
        await downloadPromise;

        expect(jobModule.updateJob).toHaveBeenCalledWith(
          mockJobId,
          expect.objectContaining({
            notes: expect.stringContaining('Stall detected at 45.5%')
          })
        );
      });
    });

    describe('error handling', () => {
      it('should handle process spawn error', async () => {
        // Setup fs mocks for cleanup
        fsPromises.access.mockRejectedValue(new Error('Not found'));
        fsPromises.unlink.mockResolvedValue();
        fsPromises.readdir.mockResolvedValue([]);

        const downloadPromise = executor.doDownload(mockArgs, mockJobId, mockJobType);

        // Need to clear the timer first to prevent it from interfering
        jest.clearAllTimers();

        const spawnError = new Error('Spawn failed');
        mockProcess.emit('error', spawnError);

        // The error is caught but not rethrown in the implementation
        await downloadPromise;

        // The process cleanup should happen with the new error message format
        expect(consoleLogSpy).toHaveBeenCalledWith('Download process error:', 'Spawn failed');
      });

      it('should clear process references on error', async () => {
        fsPromises.access.mockRejectedValue(new Error('Not found'));
        fsPromises.unlink.mockResolvedValue();
        fsPromises.readdir.mockResolvedValue([]);

        const downloadPromise = executor.doDownload(mockArgs, mockJobId, mockJobType);

        // Verify references are set
        expect(executor.currentProcess).toBe(mockProcess);
        expect(executor.currentJobId).toBe(mockJobId);

        jest.clearAllTimers();

        const spawnError = new Error('Spawn failed');
        mockProcess.emit('error', spawnError);

        await downloadPromise;

        // Verify references are cleared after error
        expect(executor.currentProcess).toBeNull();
        expect(executor.currentJobId).toBeNull();
      });

      it('should kill process on timeout', async () => {
        const downloadPromise = executor.doDownload(mockArgs, mockJobId, mockJobType);

        // Advance in minute increments to trigger the activity timeout (30 minutes)
        for (let i = 0; i < 31; i++) {
          jest.advanceTimersByTime(60 * 1000);
        }

        // Emit exit event to complete the promise
        mockProcess.emit('exit', 1, 'SIGTERM');

        await downloadPromise;

        // Should call SIGTERM for graceful shutdown, not SIGKILL
        expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
        expect(jobModule.updateJob).toHaveBeenCalledWith(
          mockJobId,
          expect.objectContaining({
            status: 'Terminated',
            notes: expect.stringContaining('No download activity')
          })
        );
      });

      it('should cleanup temp channels file on timeout', async () => {
        executor.tempChannelsFile = '/tmp/channels.txt';
        fsPromises.unlink.mockResolvedValue();

        const downloadPromise = executor.doDownload(mockArgs, mockJobId, mockJobType);

        // Trigger activity timeout by advancing 31 minutes
        for (let i = 0; i < 31; i++) {
          jest.advanceTimersByTime(60 * 1000);
        }

        // Emit exit to complete the promise
        mockProcess.emit('exit', 1, 'SIGTERM');

        await downloadPromise;

        // Should still cleanup temp file
        expect(fsPromises.unlink).toHaveBeenCalledWith('/tmp/channels.txt');
      });
    });

    describe('video counting', () => {
      it('should handle no new videos downloaded', async () => {
        archiveModule.getNewVideoUrlsSince.mockReturnValue([]);
        VideoMetadataProcessor.processVideoMetadata.mockReturnValue([]);

        const downloadPromise = executor.doDownload(mockArgs, mockJobId, mockJobType);

        mockProcess.emit('exit', 0);
        await downloadPromise;

        expect(MessageEmitter.emitMessage).toHaveBeenLastCalledWith(
          'broadcast',
          null,
          'download',
          'downloadProgress',
          expect.objectContaining({
            text: 'Download completed: No new videos to download'
          })
        );
      });

      it('should report correct counts for mixed downloads and skips', async () => {
        mockMonitor.videoCount.completed = 3;
        mockMonitor.videoCount.skipped = 2;

        const downloadPromise = executor.doDownload(mockArgs, mockJobId, mockJobType);

        mockProcess.emit('exit', 0);
        await downloadPromise;

        expect(MessageEmitter.emitMessage).toHaveBeenLastCalledWith(
          'broadcast',
          null,
          'download',
          'downloadProgress',
          expect.objectContaining({
            text: 'Download completed: 3 new videos downloaded, 2 already existed'
          })
        );
      });

      it('should report only skipped videos when all exist', async () => {
        archiveModule.getNewVideoUrlsSince.mockReturnValue([]);
        mockMonitor.videoCount.completed = 0;
        mockMonitor.videoCount.skipped = 5;

        const downloadPromise = executor.doDownload(mockArgs, mockJobId, mockJobType);

        mockProcess.emit('exit', 0);
        await downloadPromise;

        expect(MessageEmitter.emitMessage).toHaveBeenLastCalledWith(
          'broadcast',
          null,
          'download',
          'downloadProgress',
          expect.objectContaining({
            text: 'Download completed: All 5 videos already existed'
          })
        );
      });

      it('should use video count as fallback for completed count', async () => {
        mockMonitor.videoCount.completed = 0;
        archiveModule.getNewVideoUrlsSince.mockReturnValue([
          'url1', 'url2', 'url3'
        ]);

        const downloadPromise = executor.doDownload(mockArgs, mockJobId, mockJobType);

        mockProcess.emit('exit', 0);
        await downloadPromise;

        expect(mockMonitor.videoCount.completed).toBe(3);
      });
    });

    describe('bot detection variations', () => {
      const botDetectionVariants = [
        'Sign in to confirm you are not a bot',
        'Sign in to confirm you\'re not a bot',
        'Sign in to confirm that you are not a bot',
        'Please Sign in to confirm you are not a bot'
      ];

      botDetectionVariants.forEach(variant => {
        it(`should detect bot message: "${variant}"`, async () => {
          const downloadPromise = executor.doDownload(mockArgs, mockJobId, mockJobType);

          mockProcess.stderr.emit('data', Buffer.from(variant));
          mockProcess.emit('exit', 1);
          await downloadPromise;

          expect(jobModule.updateJob).toHaveBeenCalledWith(
            mockJobId,
            expect.objectContaining({
              status: 'Error',
              error: 'COOKIES_REQUIRED'
            })
          );
        });
      });

      it('should detect bot message in complete stderr buffer on exit', async () => {
        const downloadPromise = executor.doDownload(mockArgs, mockJobId, mockJobType);

        // Send message in parts that don't individually trigger detection
        mockProcess.stderr.emit('data', Buffer.from('Sign in to confirm '));
        mockProcess.stderr.emit('data', Buffer.from('you are not a bot'));

        mockProcess.emit('exit', 1);
        await downloadPromise;

        expect(jobModule.updateJob).toHaveBeenCalledWith(
          mockJobId,
          expect.objectContaining({
            status: 'Error',
            error: 'COOKIES_REQUIRED'
          })
        );
      });
    });

    describe('notification handling', () => {
      it('should send notification on successful download', async () => {
        mockMonitor.videoCount.completed = 2;
        mockMonitor.currentChannelName = 'Test Channel';

        const downloadPromise = executor.doDownload(mockArgs, mockJobId, mockJobType);

        mockProcess.emit('exit', 0);
        await downloadPromise;

        expect(notificationModule.sendDownloadNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            finalSummary: expect.objectContaining({
              totalDownloaded: 2,
              totalSkipped: 0,
              jobType: mockJobType
            }),
            videoData: expect.any(Array),
            channelName: 'Test Channel'
          })
        );
      });

      it('should not send notification on failed download', async () => {
        mockMonitor.videoCount.completed = 0;
        mockMonitor.videoCount.skipped = 0;
        archiveModule.getNewVideoUrlsSince.mockReturnValueOnce([]);
        VideoMetadataProcessor.processVideoMetadata.mockResolvedValueOnce([]);

        const downloadPromise = executor.doDownload(mockArgs, mockJobId, mockJobType);

        mockProcess.emit('exit', 1);
        await downloadPromise;

        expect(notificationModule.sendDownloadNotification).not.toHaveBeenCalled();
      });

      it('should not send notification on bot detection error', async () => {
        const downloadPromise = executor.doDownload(mockArgs, mockJobId, mockJobType);

        mockProcess.stderr.emit('data', Buffer.from('Sign in to confirm you are not a bot'));
        mockProcess.emit('exit', 1);
        await downloadPromise;

        expect(notificationModule.sendDownloadNotification).not.toHaveBeenCalled();
      });

      it('should not send notification on HTTP 403 error', async () => {
        const downloadPromise = executor.doDownload(mockArgs, mockJobId, mockJobType);

        mockProcess.stderr.emit('data', Buffer.from('HTTP Error 403: Forbidden'));
        mockProcess.emit('exit', 1);
        await downloadPromise;

        expect(notificationModule.sendDownloadNotification).not.toHaveBeenCalled();
      });

      it('should continue execution if notification fails', async () => {
        const notificationError = new Error('Notification service unavailable');
        notificationModule.sendDownloadNotification.mockRejectedValueOnce(notificationError);
        mockMonitor.videoCount.completed = 1;

        const downloadPromise = executor.doDownload(mockArgs, mockJobId, mockJobType);

        mockProcess.emit('exit', 0);
        await downloadPromise;

        // Should still complete the job successfully
        expect(plexModule.refreshLibrary).toHaveBeenCalled();
        expect(jobModule.startNextJob).toHaveBeenCalled();
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Failed to send notification:',
          'Notification service unavailable'
        );
      });

      it('should send notification with correct video data', async () => {
        const testVideoData = [
          { title: 'Video 1', url: 'https://youtube.com/watch?v=abc123', youtubeId: 'abc123' },
          { title: 'Video 2', url: 'https://youtube.com/watch?v=def456', youtubeId: 'def456' }
        ];
        VideoMetadataProcessor.processVideoMetadata.mockResolvedValueOnce(testVideoData);
        mockMonitor.videoCount.completed = 2;
        mockMonitor.currentChannelName = 'Tech Tutorials';

        const downloadPromise = executor.doDownload(mockArgs, mockJobId, mockJobType);

        mockProcess.emit('exit', 0);
        await downloadPromise;

        expect(notificationModule.sendDownloadNotification).toHaveBeenCalledWith({
          finalSummary: expect.objectContaining({
            totalDownloaded: 2,
            totalSkipped: 0,
            jobType: mockJobType,
            completedAt: expect.any(String)
          }),
          videoData: testVideoData,
          channelName: 'Tech Tutorials'
        });
      });

      it('should send notification when warnings are present but download succeeded', async () => {
        mockMonitor.videoCount.completed = 1;
        mockMonitor.videoCount.skipped = 2;

        const downloadPromise = executor.doDownload(mockArgs, mockJobId, mockJobType);

        mockProcess.stderr.emit('data', Buffer.from('WARNING: Some non-critical warning'));
        mockProcess.emit('exit', 1); // Exit code 1 with completed videos is treated as success
        await downloadPromise;

        expect(notificationModule.sendDownloadNotification).toHaveBeenCalled();
      });

      it('should send notification even when no new videos downloaded', async () => {
        archiveModule.getNewVideoUrlsSince.mockReturnValue([]);
        VideoMetadataProcessor.processVideoMetadata.mockReturnValue([]);
        mockMonitor.videoCount.completed = 0;
        mockMonitor.videoCount.skipped = 0;

        const downloadPromise = executor.doDownload(mockArgs, mockJobId, mockJobType);

        mockProcess.emit('exit', 0);
        await downloadPromise;

        // Should still send notification for "no new videos" case
        expect(notificationModule.sendDownloadNotification).toHaveBeenCalled();
      });
    });
  });

  describe('terminateCurrentJob', () => {
    const mockArgs = ['--output', '/path/to/video.mp4', 'https://youtube.com/watch?v=123'];
    const mockJobId = 'job-123';
    const mockJobType = 'Channel Downloads';

    it('should return null when no job is running', () => {
      const result = executor.terminateCurrentJob('Test reason');

      expect(result).toBeNull();
      expect(consoleLogSpy).toHaveBeenCalledWith('No job currently running to terminate');
    });

    it('should terminate current job with SIGTERM', () => {
      executor.doDownload(mockArgs, mockJobId, mockJobType);

      const result = executor.terminateCurrentJob('User requested termination');

      expect(result).toBe(mockJobId);
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
      expect(consoleLogSpy).toHaveBeenCalledWith(`Terminating job ${mockJobId}: User requested termination`);
      expect(consoleLogSpy).toHaveBeenCalledWith(`Sent SIGTERM to job ${mockJobId}`);
    });

    it('should use default reason when none provided', () => {
      executor.doDownload(mockArgs, mockJobId, mockJobType);

      const result = executor.terminateCurrentJob();

      expect(result).toBe(mockJobId);
      expect(consoleLogSpy).toHaveBeenCalledWith(`Terminating job ${mockJobId}: User requested termination`);
    });

    it('should use custom termination reason', () => {
      executor.doDownload(mockArgs, mockJobId, mockJobType);

      const customReason = 'Custom termination reason';
      executor.terminateCurrentJob(customReason);

      expect(consoleLogSpy).toHaveBeenCalledWith(`Terminating job ${mockJobId}: ${customReason}`);
    });

    it('should set manualTerminationReason for exit handler', () => {
      executor.doDownload(mockArgs, mockJobId, mockJobType);

      const reason = 'Test termination';
      executor.terminateCurrentJob(reason);

      expect(executor.manualTerminationReason).toBe(reason);
    });

    it('should schedule SIGKILL after grace period', () => {
      executor.doDownload(mockArgs, mockJobId, mockJobType);

      executor.terminateCurrentJob('Test reason');

      // Advance timers by 60 seconds (grace period)
      jest.advanceTimersByTime(60 * 1000);

      // Should send SIGKILL after grace period
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGKILL');
      expect(consoleLogSpy).toHaveBeenCalledWith(`Grace period expired for job ${mockJobId}, forcing kill with SIGKILL`);
    });

    it('should not send SIGKILL if process already exited', async () => {
      const downloadPromise = executor.doDownload(mockArgs, mockJobId, mockJobType);

      executor.terminateCurrentJob('Test reason');

      // Clear the kill mock to check if SIGKILL is sent
      mockProcess.kill.mockClear();

      // Simulate process exit before grace period
      mockProcess.emit('exit', 1, 'SIGTERM');
      await downloadPromise;

      // Now advance past grace period
      jest.advanceTimersByTime(60 * 1000);

      // Should NOT send SIGKILL since process already exited
      expect(mockProcess.kill).not.toHaveBeenCalled();
    });

    it('should handle error when sending SIGTERM', () => {
      executor.doDownload(mockArgs, mockJobId, mockJobType);

      const killError = new Error('Process already terminated');
      mockProcess.kill.mockImplementationOnce(() => {
        throw killError;
      });

      const result = executor.terminateCurrentJob('Test reason');

      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error terminating job:', killError.message);
      expect(executor.manualTerminationReason).toBeNull();
    });

    it('should handle error when sending SIGKILL during grace period', () => {
      executor.doDownload(mockArgs, mockJobId, mockJobType);

      // First kill succeeds (SIGTERM)
      mockProcess.kill.mockImplementationOnce(() => {});
      // Second kill fails (SIGKILL)
      mockProcess.kill.mockImplementationOnce(() => {
        throw new Error('Cannot kill process');
      });

      executor.terminateCurrentJob('Test reason');

      // Advance to grace period expiration
      jest.advanceTimersByTime(60 * 1000);

      expect(consoleLogSpy).toHaveBeenCalledWith('Error sending SIGKILL:', 'Cannot kill process');
    });

    it('should update job with manual termination reason on exit', async () => {
      const downloadPromise = executor.doDownload(mockArgs, mockJobId, mockJobType);

      const customReason = 'Manual user termination';
      executor.terminateCurrentJob(customReason);

      mockProcess.emit('exit', 1, 'SIGTERM');
      await downloadPromise;

      expect(jobModule.updateJob).toHaveBeenCalledWith(
        mockJobId,
        expect.objectContaining({
          status: 'Terminated',
          notes: customReason,
          output: expect.stringContaining('completed before termination')
        })
      );
    });

    it('should emit terminated state message with manual reason', async () => {
      mockMonitor.videoCount.completed = 3;
      const downloadPromise = executor.doDownload(mockArgs, mockJobId, mockJobType);

      const customReason = 'User cancelled download';
      executor.terminateCurrentJob(customReason);

      mockProcess.emit('exit', 1, 'SIGTERM');
      await downloadPromise;

      const emitCalls = MessageEmitter.emitMessage.mock.calls;
      const finalCall = emitCalls[emitCalls.length - 1];

      expect(finalCall[4]).toMatchObject({
        text: expect.stringContaining('Download terminated: User cancelled download'),
        warning: true,
        terminationReason: customReason
      });
    });

    it('should clear process references after manual termination exit', async () => {
      const downloadPromise = executor.doDownload(mockArgs, mockJobId, mockJobType);

      executor.terminateCurrentJob('Test reason');

      // Verify references are set during execution
      expect(executor.currentJobId).toBe(mockJobId);
      expect(executor.currentProcess).toBe(mockProcess);

      mockProcess.emit('exit', 1, 'SIGTERM');
      await downloadPromise;

      // Verify references are cleared after exit
      expect(executor.currentJobId).toBeNull();
      expect(executor.currentProcess).toBeNull();
      expect(executor.manualTerminationReason).toBeNull();
    });

    it('should cleanup partial files on manual termination', async () => {
      fsPromises.access.mockResolvedValue();
      fsPromises.unlink.mockResolvedValue();
      fsPromises.readdir.mockResolvedValue([]);

      const downloadPromise = executor.doDownload(mockArgs, mockJobId, mockJobType);

      // Track a destination
      mockProcess.stdout.emit('data', Buffer.from('[download] Destination: /path/to/video.mp4'));

      executor.terminateCurrentJob('User requested');

      mockProcess.emit('exit', 1, 'SIGTERM');
      await downloadPromise;

      expect(fsPromises.unlink).toHaveBeenCalledWith('/path/to/video.mp4.part');
    });
  });
});
