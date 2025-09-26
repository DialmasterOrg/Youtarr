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

const { spawn } = require('child_process');
const { EventEmitter } = require('events');
const DownloadExecutor = require('../downloadExecutor');
const DownloadProgressMonitor = require('../DownloadProgressMonitor');
const VideoMetadataProcessor = require('../videoMetadataProcessor');
const configModule = require('../../configModule');
const plexModule = require('../../plexModule');
const jobModule = require('../../jobModule');
const MessageEmitter = require('../../messageEmitter');

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
    jest.resetModules();
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
      lastParsed: null
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

    executor = new DownloadExecutor();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('constructor', () => {
    it('should initialize with null tempChannelsFile', () => {
      expect(executor.tempChannelsFile).toBeNull();
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

    it('should set timeout based on configuration', () => {
      const expectedTimeout = Math.max(
        mockConfig.downloadSocketTimeoutSeconds * 1000 * (mockConfig.downloadRetryCount + 1),
        20 * 60 * 1000
      );

      executor.doDownload(mockArgs, mockJobId, mockJobType);

      // Check that setTimeout was called by checking timer count
      expect(jest.getTimerCount()).toBe(1);

      // Advance timers to just before timeout
      jest.advanceTimersByTime(expectedTimeout - 1);
      expect(mockProcess.kill).not.toHaveBeenCalled();

      // Advance to timeout
      jest.advanceTimersByTime(1);
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGKILL');
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

        // The process cleanup should happen
        expect(consoleLogSpy).toHaveBeenCalledWith('Spawn failed');
      });

      it('should kill process on timeout', async () => {
        const downloadPromise = executor.doDownload(mockArgs, mockJobId, mockJobType);

        jest.advanceTimersByTime(mockConfig.downloadSocketTimeoutSeconds * 1000 * (mockConfig.downloadRetryCount + 1));

        await downloadPromise;

        expect(mockProcess.kill).toHaveBeenCalledWith('SIGKILL');
        expect(jobModule.updateJob).toHaveBeenCalledWith(
          mockJobId,
          expect.objectContaining({
            status: 'Killed',
            output: 'Job time exceeded timeout'
          })
        );
      });

      it('should cleanup temp channels file on timeout', async () => {
        executor.tempChannelsFile = '/tmp/channels.txt';
        fsPromises.unlink.mockResolvedValue();

        const downloadPromise = executor.doDownload(mockArgs, mockJobId, mockJobType);

        // Trigger timeout
        jest.advanceTimersByTime(mockConfig.downloadSocketTimeoutSeconds * 1000 * (mockConfig.downloadRetryCount + 1));

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
  });
});