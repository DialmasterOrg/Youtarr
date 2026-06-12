/* eslint-env jest */

const { EventEmitter } = require('events');

// Mock child_process spawn
const mockSpawn = jest.fn();
jest.mock('child_process', () => ({
  spawn: mockSpawn
}));

// Mock fs module - must define mockFsPromises before jest.mock
const mockFsPromises = {
  access: jest.fn(),
  readdir: jest.fn(),
  stat: jest.fn(),
  unlink: jest.fn(),
  rm: jest.fn(),
  rmdir: jest.fn(),
  writeFile: jest.fn(),
};
jest.mock('fs', () => {
  const mockActualFs = jest.requireActual('fs');
  return {
    ...mockActualFs,
    promises: mockFsPromises,
    existsSync: jest.fn()
  };
});

// Mock logger
jest.mock('../../../logger');

// Mock dependencies
jest.mock('../../configModule', () => ({
  getConfig: jest.fn(),
  directoryPath: '/mock/output'
}));

jest.mock('../../plexModule', () => ({
  refreshLibrary: jest.fn().mockResolvedValue(),
  refreshLibrariesForSubfolders: jest.fn().mockResolvedValue(),
}));

jest.mock('../../jobModule', () => ({
  updateJob: jest.fn().mockResolvedValue(),
  startNextJob: jest.fn(() => Promise.resolve()),
  getJob: jest.fn(),
  saveJobOnly: jest.fn().mockResolvedValue()
}));

jest.mock('../../messageEmitter', () => ({
  emitMessage: jest.fn()
}));

jest.mock('../../archiveModule', () => ({
  readCompleteListLines: jest.fn().mockReturnValue([]),
  getNewVideoUrlsSince: jest.fn().mockReturnValue([]),
  addVideoToArchive: jest.fn().mockResolvedValue(),
  removeVideoFromArchive: jest.fn().mockResolvedValue(true)
}));

jest.mock('../../notificationModule', () => ({
  sendDownloadNotification: jest.fn().mockResolvedValue()
}));

jest.mock('../../channelModule', () => ({
  backfillChannelPosters: jest.fn().mockResolvedValue()
}));

jest.mock('../DownloadProgressMonitor');
jest.mock('../videoMetadataProcessor');
jest.mock('../tempPathManager');
jest.mock('../../../models', () => ({
  JobVideoDownload: {
    findOrCreate: jest.fn().mockResolvedValue([{}, true]),
    findAll: jest.fn().mockResolvedValue([]),
    destroy: jest.fn().mockResolvedValue(0)
  }
}));

jest.mock('../../../models/channel', () => ({
  findAll: jest.fn().mockResolvedValue([]),
  findOne: jest.fn().mockResolvedValue(null)
}));

jest.mock('../../../models/channelvideo', () => ({
  update: jest.fn().mockResolvedValue([1]),
}));

jest.mock('../../downloadModule', () => ({
  afterDownloadHook: jest.fn().mockResolvedValue(),
}));

// Mock filesystem module
jest.mock('../../filesystem', () => {
  const actualPathBuilder = jest.requireActual('../../filesystem/pathBuilder');
  return {
    isMainVideoFile: jest.fn(),
    isVideoDirectory: jest.fn(),
    isChannelDirectory: jest.fn(),
    isDirectoryEmpty: jest.fn(),
    cleanupEmptyChannelDirectory: jest.fn().mockResolvedValue(false),
    ROOT_SENTINEL: '##ROOT##',
    GLOBAL_DEFAULT_SENTINEL: '##USE_GLOBAL_DEFAULT##',
    resolveEffectiveSubfolder: jest.fn((subfolder) => {
      if (subfolder === '##ROOT##') return null;
      if (subfolder === '##USE_GLOBAL_DEFAULT##') return null;
      if (subfolder && subfolder.trim() !== '') return subfolder.trim();
      return null;
    }),
    extractYoutubeIdFromPath: jest.fn(actualPathBuilder.extractYoutubeIdFromPath),
    extractSubfolderFromAbsPath: jest.fn(actualPathBuilder.extractSubfolderFromAbsPath),
  };
});

const DownloadExecutor = require('../downloadExecutor');
const filesystem = require('../../filesystem');
const configModule = require('../../configModule');
const plexModule = require('../../plexModule');
const jobModule = require('../../jobModule');
const MessageEmitter = require('../../messageEmitter');
const archiveModule = require('../../archiveModule');
const notificationModule = require('../../notificationModule');
const channelModule = require('../../channelModule');
const DownloadProgressMonitor = require('../DownloadProgressMonitor');
const VideoMetadataProcessor = require('../videoMetadataProcessor');
const tempPathManager = require('../tempPathManager');
const { JobVideoDownload } = require('../../../models');
const Channel = require('../../../models/channel');
const ChannelVideo = require('../../../models/channelvideo');
const logger = require('../../../logger');

describe('DownloadExecutor', () => {
  let executor;
  let mockProcess;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mocks
    configModule.getConfig.mockReturnValue({
      enableStallDetection: false,
    });

    // Setup filesystem module mocks with sensible defaults
    filesystem.isMainVideoFile.mockReturnValue(true);
    filesystem.isVideoDirectory.mockReturnValue(true);
    filesystem.isChannelDirectory.mockReturnValue(true);
    filesystem.isDirectoryEmpty.mockReturnValue(true);

    // Create mock process
    mockProcess = new EventEmitter();
    mockProcess.kill = jest.fn();
    mockProcess.exitCode = null;
    mockProcess.signalCode = null;
    mockProcess.stdout = new EventEmitter();
    mockProcess.stderr = new EventEmitter();

    mockSpawn.mockReturnValue(mockProcess);

    // Setup DownloadProgressMonitor mock
    const mockMonitor = {
      videoCount: {
        current: 1,
        total: 0,
        completed: 0,
        skipped: 0,
        skippedThisChannel: 0
      },
      hasError: false,
      lastParsed: null,
      currentChannelName: '',
      processProgress: jest.fn().mockReturnValue({ state: 'downloading_video' }),
      snapshot: jest.fn().mockReturnValue({
        state: 'initiating',
        videoCount: { current: 1, total: 0, completed: 0, skipped: 0 }
      })
    };
    DownloadProgressMonitor.mockImplementation(() => mockMonitor);

    // Setup VideoMetadataProcessor mock
    VideoMetadataProcessor.processVideoMetadata = jest.fn().mockResolvedValue([]);
    jobModule.getJob.mockReturnValue(undefined);
    jobModule.updateJob.mockResolvedValue();
    jobModule.saveJobOnly.mockResolvedValue();

    // Setup health check mocks (succeed by default so existing tests pass)
    mockFsPromises.writeFile.mockResolvedValue();
    mockFsPromises.unlink.mockResolvedValue();

    // Setup tempPathManager mock
    tempPathManager.cleanTempDirectory = jest.fn().mockResolvedValue();
    tempPathManager.isEnabled = jest.fn().mockReturnValue(false);
    tempPathManager.convertFinalToTemp = jest.fn(path => path);

    executor = new DownloadExecutor();
  });

  afterEach(() => {
    // Clear any force kill timeouts from the executor
    if (executor.forceKillTimeout) {
      clearTimeout(executor.forceKillTimeout);
      executor.forceKillTimeout = null;
    }
    // Clean up any pending timers to prevent Jest hanging
    jest.clearAllTimers();
    // Ensure we're using real timers
    jest.useRealTimers();
  });

  describe('constructor', () => {
    it('should initialize with correct default values', () => {
      expect(executor.tempChannelsFile).toBeNull();
      expect(executor.activityTimeoutMs).toBe(30 * 60 * 1000);
      expect(executor.maxAbsoluteTimeoutMs).toBe(6 * 60 * 60 * 1000);
      expect(executor.currentProcess).toBeNull();
      expect(executor.currentJobId).toBeNull();
      expect(executor.manualTerminationReason).toBeNull();
      expect(executor.forceKillTimeout).toBeNull();
    });
  });

  describe('checkOutputDirectoryHealth', () => {
    it('should succeed when output directory is writable', async () => {
      mockFsPromises.writeFile.mockResolvedValue();
      mockFsPromises.unlink.mockResolvedValue();

      await expect(executor.checkOutputDirectoryHealth('/mock/output')).resolves.toBeUndefined();

      expect(mockFsPromises.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('/mock/output/.youtarr_healthcheck_'),
        'healthcheck'
      );
      expect(mockFsPromises.unlink).toHaveBeenCalledWith(
        expect.stringContaining('/mock/output/.youtarr_healthcheck_')
      );
    });

    it('should throw when output directory returns EACCES', async () => {
      const error = new Error('EACCES: permission denied');
      error.code = 'EACCES';
      mockFsPromises.writeFile.mockRejectedValue(error);

      await expect(executor.checkOutputDirectoryHealth('/mock/output')).rejects.toThrow('EACCES');
    });

    it('should throw on timeout for unresponsive filesystem', async () => {
      jest.useFakeTimers();

      // Simulate a hung NFS mount — writeFile never resolves
      mockFsPromises.writeFile.mockReturnValue(new Promise(() => {}));

      const healthPromise = executor.checkOutputDirectoryHealth('/mock/output', 5000);

      // Advance past the timeout
      jest.advanceTimersByTime(5000);

      await expect(healthPromise).rejects.toThrow('timed out');

      jest.useRealTimers();
    });

    it('should throw a clear error when outputDir is undefined', async () => {
      await expect(executor.checkOutputDirectoryHealth(undefined)).rejects.toThrow(
        'Output directory path is not configured'
      );
    });

    it('should attempt cleanup if writeFile succeeds but unlink fails', async () => {
      mockFsPromises.writeFile.mockResolvedValue();
      const unlinkError = new Error('NFS stale handle');
      // First call (inside the health check) rejects, second call (cleanup in finally) resolves
      mockFsPromises.unlink
        .mockRejectedValueOnce(unlinkError)
        .mockResolvedValueOnce();

      await expect(executor.checkOutputDirectoryHealth('/mock/output')).rejects.toThrow('NFS stale handle');

      // unlink should have been called twice: once in the main flow, once in the finally cleanup
      expect(mockFsPromises.unlink).toHaveBeenCalledTimes(2);
    });
  });

  describe('doDownload', () => {
    const mockArgs = ['--format', 'best', 'https://youtube.com/watch?v=test'];
    const mockJobId = 'job-123';
    const mockJobType = 'Channel Downloads';

    it('should spawn yt-dlp process with correct arguments', async () => {
      // Trigger immediate exit with code 0
      setTimeout(() => {
        mockProcess.emit('exit', 0, null);
      }, 10);

      await executor.doDownload(mockArgs, mockJobId, mockJobType);

      expect(mockSpawn).toHaveBeenCalledWith('yt-dlp', mockArgs, {
        env: expect.objectContaining({
          YOUTARR_JOB_ID: mockJobId
        })
      });
    });

    it('should clean temp directory before starting', async () => {
      setTimeout(() => {
        mockProcess.emit('exit', 0, null);
      }, 10);

      await executor.doDownload(mockArgs, mockJobId, mockJobType);

      expect(tempPathManager.cleanTempDirectory).toHaveBeenCalled();
    });

    it('should fail job early when output directory health check fails', async () => {
      const error = new Error('EACCES: permission denied');
      error.code = 'EACCES';
      mockFsPromises.writeFile.mockRejectedValue(error);

      await executor.doDownload(mockArgs, mockJobId, mockJobType);

      // Should NOT have spawned yt-dlp
      expect(mockSpawn).not.toHaveBeenCalled();

      // Should update job as Error
      expect(jobModule.updateJob).toHaveBeenCalledWith(
        mockJobId,
        expect.objectContaining({
          status: 'Error',
          output: expect.stringContaining('Output directory is not accessible'),
        })
      );

      // Should emit error via WebSocket
      expect(MessageEmitter.emitMessage).toHaveBeenCalledWith(
        'broadcast',
        null,
        'download',
        'downloadProgress',
        expect.objectContaining({
          error: true,
          text: expect.stringContaining('Output directory is not accessible'),
        })
      );

      // Should start next job
      expect(jobModule.startNextJob).toHaveBeenCalled();
    });

    it('should not start next job on health check failure when skipJobTransition is true', async () => {
      const error = new Error('EACCES: permission denied');
      error.code = 'EACCES';
      mockFsPromises.writeFile.mockRejectedValue(error);

      // skipJobTransition is 7th argument
      await executor.doDownload(mockArgs, mockJobId, mockJobType, 0, null, false, true);

      expect(mockSpawn).not.toHaveBeenCalled();
      expect(jobModule.startNextJob).not.toHaveBeenCalled();
    });

    it('should proceed normally when output directory health check passes', async () => {
      mockFsPromises.writeFile.mockResolvedValue();
      mockFsPromises.unlink.mockResolvedValue();

      setTimeout(() => {
        mockProcess.emit('exit', 0, null);
      }, 10);

      await executor.doDownload(mockArgs, mockJobId, mockJobType);

      // Should have spawned yt-dlp
      expect(mockSpawn).toHaveBeenCalled();
    });

    it('should emit initial progress message', async () => {
      setTimeout(() => {
        mockProcess.emit('exit', 0, null);
      }, 10);

      await executor.doDownload(mockArgs, mockJobId, mockJobType);

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
    });

    it('should handle successful completion', async () => {
      VideoMetadataProcessor.processVideoMetadata.mockResolvedValue([
        { youtubeId: 'abc123', filePath: '/output/video.mp4', fileSize: '1024' }
      ]);
      archiveModule.getNewVideoUrlsSince.mockReturnValue(['https://youtu.be/abc123']);

      setTimeout(() => {
        mockProcess.emit('exit', 0, null);
      }, 10);

      await executor.doDownload(mockArgs, mockJobId, mockJobType);

      expect(jobModule.updateJob).toHaveBeenCalledWith(
        mockJobId,
        expect.objectContaining({
          status: 'Complete',
          output: '1 videos.'
        })
      );
    });

    it('should handle exit with error code', async () => {
      setTimeout(() => {
        mockProcess.emit('exit', 1, null);
      }, 10);

      await executor.doDownload(mockArgs, mockJobId, mockJobType);

      expect(jobModule.updateJob).toHaveBeenCalledWith(
        mockJobId,
        expect.objectContaining({
          status: 'Error'
        })
      );
    });

    it('reports to the run tracker using the runId captured at entry, even after job.data is stripped', async () => {
      // Regression: terminal updateJob() replaces job.data with an object that
      // omits runId. doDownload must capture runId at entry, not re-read it at
      // completion, or the job never joins its run's aggregated summary.
      const downloadRunTracker = require('../downloadRunTracker');
      const runId = downloadRunTracker.startRun();
      const recordSpy = jest.spyOn(downloadRunTracker, 'recordJobResult');

      VideoMetadataProcessor.processVideoMetadata.mockResolvedValue([
        { youtubeId: 'abc123', filePath: '/output/video.mp4', fileSize: '1024' }
      ]);
      archiveModule.getNewVideoUrlsSince.mockReturnValue(['https://youtu.be/abc123']);

      // First getJob (doDownload entry) still has runId; later calls model the
      // stripped data left behind by terminal updateJob().
      jobModule.getJob
        .mockReturnValueOnce({ data: { runId } })
        .mockReturnValue({ data: {} });

      setTimeout(() => {
        mockProcess.emit('exit', 0, null);
      }, 10);

      await executor.doDownload(mockArgs, mockJobId, mockJobType);

      expect(recordSpy).toHaveBeenCalledWith(
        runId,
        mockJobId,
        expect.objectContaining({ totalDownloaded: 1, jobType: mockJobType })
      );

      // The run owns the summary, so no per-job finalSummary should be emitted.
      const emittedFinalSummary = MessageEmitter.emitMessage.mock.calls.some(
        (call) => call[4] && call[4].finalSummary
      );
      expect(emittedFinalSummary).toBe(false);

      downloadRunTracker.seal(runId);
      recordSpy.mockRestore();
    });

    it('should persist successful videos before terminal update when yt-dlp exits non-zero', async () => {
      const mockVideoData = [
        { youtubeId: 'success1234', filePath: '/output/video.mp4', fileSize: '1024' }
      ];
      const mockJob = { data: {} };

      VideoMetadataProcessor.processVideoMetadata.mockResolvedValue(mockVideoData);
      archiveModule.getNewVideoUrlsSince.mockReturnValue(['https://youtu.be/success1234']);
      jobModule.getJob.mockReturnValue(mockJob);

      setTimeout(() => {
        mockProcess.emit('exit', 1, null);
      }, 10);

      await executor.doDownload(mockArgs, mockJobId, mockJobType);

      expect(jobModule.saveJobOnly).toHaveBeenCalledWith(
        mockJobId,
        expect.objectContaining({
          data: expect.objectContaining({
            videos: mockVideoData,
            failedVideos: []
          })
        })
      );

      const saveJobOnlyCallIndex = jobModule.saveJobOnly.mock.invocationCallOrder[0];
      const terminalUpdateCallIndex = jobModule.updateJob.mock.invocationCallOrder.find(
        (order, idx) => jobModule.updateJob.mock.calls[idx][1]?.status === 'Complete with Warnings'
      );

      expect(saveJobOnlyCallIndex).toBeLessThan(terminalUpdateCallIndex);
      expect(jobModule.updateJob).toHaveBeenCalledWith(
        mockJobId,
        expect.objectContaining({
          status: 'Complete with Warnings',
          notes: 'Some videos failed (exit 1)',
          data: expect.objectContaining({
            videos: mockVideoData,
            failedVideos: []
          })
        })
      );
      expect(MessageEmitter.emitMessage).toHaveBeenCalledWith(
        'broadcast',
        null,
        'download',
        'downloadProgress',
        expect.objectContaining({
          warning: true,
          finalSummary: expect.objectContaining({
            totalDownloaded: 1
          })
        })
      );
      expect(notificationModule.sendDownloadNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          finalSummary: expect.objectContaining({
            totalDownloaded: 1
          }),
          videoData: mockVideoData
        })
      );
    });

    it('should handle bot detection', async () => {
      setTimeout(() => {
        mockProcess.stderr.emit('data', 'Sign in to confirm you\'re not a bot');
        mockProcess.emit('exit', 1, null);
      }, 10);

      await executor.doDownload(mockArgs, mockJobId, mockJobType);

      expect(jobModule.updateJob).toHaveBeenCalledWith(
        mockJobId,
        expect.objectContaining({
          status: 'Error',
          notes: expect.stringContaining('cookies'),
          error: 'COOKIES_REQUIRED'
        })
      );
    });

    it('should handle HTTP 403 errors', async () => {
      setTimeout(() => {
        mockProcess.stdout.emit('data', 'HTTP Error 403: Forbidden');
        mockProcess.emit('exit', 1, null);
      }, 10);

      await executor.doDownload(mockArgs, mockJobId, mockJobType);

      // Should emit warning message during download (not error - 403s may be recoverable)
      expect(MessageEmitter.emitMessage).toHaveBeenCalledWith(
        'broadcast',
        null,
        'download',
        'downloadProgress',
        expect.objectContaining({
          warning: true,
          errorCode: 'COOKIES_RECOMMENDED',
          text: expect.stringContaining('HTTP 403 detected')
        })
      );

      // Should update job as error since exit code was 1
      expect(jobModule.updateJob).toHaveBeenCalledWith(
        mockJobId,
        expect.objectContaining({
          status: 'Error',
          error: 'COOKIES_RECOMMENDED'
        })
      );
    });

    it('should process stdout progress data', async () => {
      setTimeout(() => {
        mockProcess.stdout.emit('data', '[download] 50.0% of 10.00MiB at 1.00MiB/s ETA 00:05\n');
        mockProcess.emit('exit', 0, null);
      }, 10);

      await executor.doDownload(mockArgs, mockJobId, mockJobType);

      expect(MessageEmitter.emitMessage).toHaveBeenCalledWith(
        'broadcast',
        null,
        'download',
        'downloadProgress',
        expect.objectContaining({
          text: expect.stringContaining('[download]')
        })
      );
    });

    it('marks job Complete (not "with Warnings") when stderr contains only benign yt-dlp warnings', async () => {
      setTimeout(() => {
        // Both benign warnings observed on real playlist/manual downloads.
        mockProcess.stderr.emit(
          'data',
          'WARNING: --paths is ignored since an absolute path is given in output template\n'
        );
        mockProcess.stderr.emit(
          'data',
          'WARNING: The extractor specified to use impersonation for this download, but no impersonate target is available. If you encounter errors, then see https://github.com/yt-dlp/yt-dlp#impersonation for information on installing the required dependencies\n'
        );
        mockProcess.emit('exit', 0, null);
      }, 10);

      await executor.doDownload(mockArgs, mockJobId, 'Manually Added Urls', 1);

      const statuses = jobModule.updateJob.mock.calls
        .map((call) => call[1] && call[1].status)
        .filter(Boolean);
      expect(statuses).toContain('Complete');
      expect(statuses).not.toContain('Complete with Warnings');
    });

    it('still marks job "Complete with Warnings" when stderr contains a non-benign warning', async () => {
      setTimeout(() => {
        mockProcess.stderr.emit('data', 'WARNING: Some unexpected non-whitelisted warning\n');
        mockProcess.emit('exit', 0, null);
      }, 10);

      await executor.doDownload(mockArgs, mockJobId, 'Manually Added Urls', 1);

      expect(jobModule.updateJob).toHaveBeenCalledWith(
        mockJobId,
        expect.objectContaining({
          status: 'Complete with Warnings',
        })
      );
    });

    it('should track destination files for cleanup', async () => {
      setTimeout(() => {
        mockProcess.stdout.emit('data', '[download] Destination: /output/Channel - Title [abc123XYZ_d].mp4\n');
        mockProcess.emit('exit', 0, null);
      }, 10);

      await executor.doDownload(mockArgs, mockJobId, mockJobType);

      expect(JobVideoDownload.findOrCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            job_id: mockJobId,
            youtube_id: 'abc123XYZ_d'
          }
        })
      );
    });

    it('should handle manual URL downloads with URL count', async () => {
      const originalUrls = ['https://youtube.com/watch?v=abc123', 'https://youtube.com/watch?v=def456'];

      setTimeout(() => {
        mockProcess.emit('exit', 0, null);
      }, 10);

      await executor.doDownload(mockArgs, mockJobId, 'Manually Added Urls', 2, originalUrls);

      expect(DownloadProgressMonitor).toHaveBeenCalledWith(mockJobId, 'Manually Added Urls');
    });

    it('should convert YouTube URLs to youtu.be format for manual downloads', async () => {
      const originalUrls = ['https://youtube.com/watch?v=abc123XYZ_d&feature=share'];
      VideoMetadataProcessor.processVideoMetadata.mockResolvedValue([]);

      setTimeout(() => {
        mockProcess.emit('exit', 0, null);
      }, 10);

      await executor.doDownload(mockArgs, mockJobId, 'Manually Added Urls', 1, originalUrls);

      expect(VideoMetadataProcessor.processVideoMetadata).toHaveBeenCalledWith(
        expect.arrayContaining(['https://youtu.be/abc123XYZ_d'])
      );
    });

    it('should update archive when allowRedownload is true', async () => {
      const fs = require('fs');
      fs.existsSync.mockReturnValue(true);

      VideoMetadataProcessor.processVideoMetadata.mockResolvedValue([
        { youtubeId: 'abc123XYZ_d', filePath: '/output/video.mp4', fileSize: '1024' }
      ]);

      setTimeout(() => {
        mockProcess.emit('exit', 0, null);
      }, 10);

      await executor.doDownload(mockArgs, mockJobId, mockJobType, 0, null, true);

      expect(archiveModule.addVideoToArchive).toHaveBeenCalledWith('abc123XYZ_d');
    });

    it('should refresh the Plex library for the subfolder extracted from the downloaded video path', async () => {
      VideoMetadataProcessor.processVideoMetadata.mockResolvedValue([
        {
          youtubeId: 'abc123XYZ_d',
          filePath: '/mock/output/__Adults/The Daily Show/The Daily Show - Video - abc123XYZ_d/The Daily Show - Video [abc123XYZ_d].mp4',
          fileSize: '1024'
        }
      ]);

      setTimeout(() => {
        mockProcess.emit('exit', 0, null);
      }, 10);

      await executor.doDownload(mockArgs, mockJobId, mockJobType);

      expect(plexModule.refreshLibrariesForSubfolders).toHaveBeenCalledTimes(1);
      expect(plexModule.refreshLibrariesForSubfolders).toHaveBeenCalledWith(['Adults']);
    });

    it('should refresh with null when the downloaded video is in the root directory', async () => {
      VideoMetadataProcessor.processVideoMetadata.mockResolvedValue([
        {
          youtubeId: 'abc123XYZ_d',
          filePath: '/mock/output/ChannelName/ChannelName - Video - abc123XYZ_d/ChannelName - Video [abc123XYZ_d].mp4',
          fileSize: '1024'
        }
      ]);

      setTimeout(() => {
        mockProcess.emit('exit', 0, null);
      }, 10);

      await executor.doDownload(mockArgs, mockJobId, mockJobType);

      expect(plexModule.refreshLibrariesForSubfolders).toHaveBeenCalledTimes(1);
      expect(plexModule.refreshLibrariesForSubfolders).toHaveBeenCalledWith([null]);
    });

    it('should refresh every distinct library once when videos span multiple subfolders', async () => {
      VideoMetadataProcessor.processVideoMetadata.mockResolvedValue([
        {
          youtubeId: 'adults_vid1',
          filePath: '/mock/output/__Adults/The Daily Show/vid1 - adults_vid1/vid1 [adults_vid1].mp4',
          fileSize: '1024'
        },
        {
          youtubeId: 'adults_vid2',
          filePath: '/mock/output/__Adults/The Daily Show/vid2 - adults_vid2/vid2 [adults_vid2].mp4',
          fileSize: '1024'
        },
        {
          youtubeId: 'kids_vid1',
          filePath: '/mock/output/__Kids/Sesame Street/vid3 - kids_vid1/vid3 [kids_vid1].mp4',
          fileSize: '1024'
        }
      ]);

      setTimeout(() => {
        mockProcess.emit('exit', 0, null);
      }, 10);

      await executor.doDownload(mockArgs, mockJobId, mockJobType);

      expect(plexModule.refreshLibrariesForSubfolders).toHaveBeenCalledTimes(1);
      const call = plexModule.refreshLibrariesForSubfolders.mock.calls[0][0];
      expect(call).toHaveLength(2);
      expect(new Set(call)).toEqual(new Set(['Adults', 'Kids']));
    });

    it('should fall back to audioFilePath when filePath is not set (audio-only download)', async () => {
      VideoMetadataProcessor.processVideoMetadata.mockResolvedValue([
        {
          youtubeId: 'abc123XYZ_d',
          filePath: null,
          audioFilePath: '/mock/output/__Podcasts/Podcast Channel/Podcast - abc123XYZ_d/Podcast [abc123XYZ_d].mp3',
          audioFileSize: '512'
        }
      ]);

      setTimeout(() => {
        mockProcess.emit('exit', 0, null);
      }, 10);

      await executor.doDownload(mockArgs, mockJobId, mockJobType);

      expect(plexModule.refreshLibrariesForSubfolders).toHaveBeenCalledWith(['Podcasts']);
    });

    it('should NOT trigger Plex refresh when no videos were downloaded', async () => {
      // Default mock returns [] - no videos
      setTimeout(() => {
        mockProcess.emit('exit', 0, null);
      }, 10);

      await executor.doDownload(mockArgs, mockJobId, mockJobType);

      expect(plexModule.refreshLibrariesForSubfolders).not.toHaveBeenCalled();
    });

    it('should NOT trigger Plex refresh when skipJobTransition is true', async () => {
      VideoMetadataProcessor.processVideoMetadata.mockResolvedValue([
        {
          youtubeId: 'abc123XYZ_d',
          filePath: '/mock/output/__Adults/Channel/video - abc123XYZ_d/video [abc123XYZ_d].mp4',
          fileSize: '1024'
        }
      ]);

      setTimeout(() => {
        mockProcess.emit('exit', 0, null);
      }, 10);

      // skipJobTransition=true (7th positional arg)
      await executor.doDownload(mockArgs, mockJobId, mockJobType, 0, null, false, true, { subfolderOverride: 'kids' });

      expect(plexModule.refreshLibrariesForSubfolders).not.toHaveBeenCalled();
    });

    it('should start next job after completion', async () => {
      setTimeout(() => {
        mockProcess.emit('exit', 0, null);
      }, 10);

      await executor.doDownload(mockArgs, mockJobId, mockJobType);

      expect(jobModule.startNextJob).toHaveBeenCalled();
    });

    it('should cleanup partial files on process error', async () => {
      const error = new Error('Spawn error');

      // Track destination file
      setTimeout(() => {
        mockProcess.stdout.emit('data', '[download] Destination: /output/video.mp4\n');
        mockProcess.emit('error', error);
      }, 5);

      // The promise should resolve (error handling is done internally)
      await executor.doDownload(mockArgs, mockJobId, mockJobType);

      // Job should be updated with error status
      expect(jobModule.updateJob).toHaveBeenCalledWith(
        mockJobId,
        expect.objectContaining({
          status: 'Error',
          output: expect.stringContaining('Download process error')
        })
      );

      // Cleanup should have been attempted for partial files
      expect(mockFsPromises.access).toHaveBeenCalled();
    });

    it('should send notification on successful download', async () => {
      VideoMetadataProcessor.processVideoMetadata.mockResolvedValue([
        { youtubeId: 'abc123XYZ_d', filePath: '/output/video.mp4', fileSize: '1024' }
      ]);
      archiveModule.getNewVideoUrlsSince.mockReturnValue(['https://youtu.be/abc123XYZ_d']);

      setTimeout(() => {
        mockProcess.emit('exit', 0, null);
      }, 10);

      await executor.doDownload(mockArgs, mockJobId, mockJobType);

      expect(notificationModule.sendDownloadNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          finalSummary: expect.objectContaining({
            totalDownloaded: 1,
            totalSkipped: 0,
            totalFailed: 0,
            failedVideos: expect.any(Array),
            jobType: mockJobType,
            completedAt: expect.any(String)
          }),
          videoData: expect.any(Array)
        })
      );
    });

    it('should cleanup JobVideoDownload entries after completion', async () => {
      setTimeout(() => {
        mockProcess.emit('exit', 0, null);
      }, 10);

      await executor.doDownload(mockArgs, mockJobId, mockJobType);

      expect(JobVideoDownload.destroy).toHaveBeenCalledWith({
        where: { job_id: mockJobId }
      });
    });

    it('should backfill channel posters when videos are downloaded', async () => {
      const mockChannels = [
        { channel_id: 'UC123', uploader: 'Test Channel' }
      ];

      VideoMetadataProcessor.processVideoMetadata.mockResolvedValue([
        { youtubeId: 'abc123', channel_id: 'UC123', filePath: '/output/video.mp4', fileSize: '1024' }
      ]);
      archiveModule.getNewVideoUrlsSince.mockReturnValue(['https://youtu.be/abc123']);
      Channel.findAll.mockResolvedValue(mockChannels);

      setTimeout(() => {
        mockProcess.emit('exit', 0, null);
      }, 10);

      await executor.doDownload(mockArgs, mockJobId, mockJobType);

      expect(Channel.findAll).toHaveBeenCalledWith({
        where: { channel_id: ['UC123'] }
      });
      expect(channelModule.backfillChannelPosters).toHaveBeenCalledWith(mockChannels);
    });

    it('should persist videos to database before updateJob for manual downloads', async () => {
      const mockVideoData = [
        { youtubeId: 'abc123', filePath: '/output/video.mp4', fileSize: '1024' }
      ];
      const mockFailedVideos = [];

      VideoMetadataProcessor.processVideoMetadata.mockResolvedValue(mockVideoData);
      archiveModule.getNewVideoUrlsSince.mockReturnValue(['https://youtu.be/abc123']);

      // Mock getJob to return a job with empty data initially
      const mockJob = { data: {} };
      jobModule.getJob.mockReturnValue(mockJob);

      setTimeout(() => {
        mockProcess.emit('exit', 0, null);
      }, 10);

      await executor.doDownload(mockArgs, mockJobId, 'Manually Added Urls');

      // Verify saveJobOnly was called with the video data
      expect(jobModule.saveJobOnly).toHaveBeenCalledWith(
        mockJobId,
        expect.objectContaining({
          data: expect.objectContaining({
            videos: mockVideoData,
            failedVideos: mockFailedVideos
          })
        })
      );

      // Verify saveJobOnly was called BEFORE updateJob
      const saveJobOnlyCallIndex = jobModule.saveJobOnly.mock.invocationCallOrder[0];
      const updateJobCallIndex = jobModule.updateJob.mock.invocationCallOrder.find(
        (order, idx) => {
          const call = jobModule.updateJob.mock.calls[idx];
          return call[1]?.status === 'Complete';
        }
      );

      expect(saveJobOnlyCallIndex).toBeLessThan(updateJobCallIndex);
    });

    it('should persist videos to database after updateJob for multi-group downloads', async () => {
      const mockVideoData = [
        { youtubeId: 'abc123', filePath: '/output/video.mp4', fileSize: '1024' }
      ];

      VideoMetadataProcessor.processVideoMetadata.mockResolvedValue(mockVideoData);
      archiveModule.getNewVideoUrlsSince.mockReturnValue(['https://youtu.be/abc123']);

      // Mock getJob to return a job with accumulated video data after updateJob
      const mockJobAfterUpdate = {
        data: {
          videos: mockVideoData,
          failedVideos: []
        }
      };
      jobModule.getJob.mockReturnValue(mockJobAfterUpdate);

      setTimeout(() => {
        mockProcess.emit('exit', 0, null);
      }, 10);

      // Pass skipJobTransition=true to simulate multi-group download
      await executor.doDownload(mockArgs, mockJobId, mockJobType, 0, null, false, true);

      // Verify saveJobOnly was called with accumulated videos
      expect(jobModule.saveJobOnly).toHaveBeenCalledWith(
        mockJobId,
        expect.objectContaining({
          data: expect.objectContaining({
            videos: mockVideoData
          })
        })
      );
    });

    it('should accumulate grouped videos without treating expected skips as failures', async () => {
      const existingVideo = { youtubeId: 'existing123', filePath: '/output/existing.mp4', fileSize: '2048' };
      const newVideo = { youtubeId: 'success1234', filePath: '/output/new.mp4', fileSize: '1024' };
      const existingFailedVideo = { youtubeId: 'oldfailed1', error: 'Old failure' };
      const mockJob = {
        data: {
          videos: [existingVideo],
          failedVideos: [existingFailedVideo],
          cumulativeSkipped: 2
        }
      };

      VideoMetadataProcessor.processVideoMetadata.mockResolvedValue([newVideo]);
      archiveModule.getNewVideoUrlsSince.mockReturnValue([
        'https://youtu.be/success1234',
        'https://youtu.be/failed12345'
      ]);
      jobModule.getJob.mockReturnValue(mockJob);
      jobModule.updateJob.mockImplementationOnce(async (_jobId, fields) => {
        Object.assign(mockJob, fields);
      });

      setTimeout(() => {
        mockProcess.stdout.emit('data', '[youtube] Extracting URL: https://youtube.com/watch?v=failed12345\n');
        mockProcess.stdout.emit('data', 'ERROR: This video is members-only\n');
        mockProcess.emit('exit', 1, null);
      }, 10);

      await executor.doDownload(mockArgs, mockJobId, mockJobType, 0, null, false, true);

      expect(jobModule.updateJob).toHaveBeenCalledWith(
        mockJobId,
        expect.objectContaining({
          data: expect.objectContaining({
            videos: [existingVideo, newVideo],
            failedVideos: [existingFailedVideo],
            cumulativeSkipped: 2
          })
        })
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          youtubeId: 'failed12345',
          source: 'stdout'
        }),
        'Expected video skip from yt-dlp'
      );
      expect(jobModule.updateJob).not.toHaveBeenCalledWith(
        mockJobId,
        expect.objectContaining({ status: 'Error' })
      );
      expect(jobModule.saveJobOnly).toHaveBeenCalledWith(
        mockJobId,
        expect.objectContaining({
          data: expect.objectContaining({
            videos: [existingVideo, newVideo]
          })
        })
      );
      expect(notificationModule.sendDownloadNotification).not.toHaveBeenCalled();
    });

    it('should preserve notes and error code for grouped 403 failures', async () => {
      const mockJob = {
        data: {
          videos: [],
          failedVideos: [],
          cumulativeSkipped: 0
        }
      };

      VideoMetadataProcessor.processVideoMetadata.mockResolvedValue([]);
      archiveModule.getNewVideoUrlsSince.mockReturnValue([]);
      jobModule.getJob.mockReturnValue(mockJob);

      setTimeout(() => {
        mockProcess.stdout.emit('data', 'ERROR: HTTP Error 403: Forbidden\n');
        mockProcess.emit('exit', 1, null);
      }, 10);

      await executor.doDownload(mockArgs, mockJobId, mockJobType, 0, null, false, true);

      expect(jobModule.updateJob).toHaveBeenCalledWith(
        mockJobId,
        expect.objectContaining({
          notes: 'YouTube denied access (HTTP 403). Configure cookies in Settings to resolve this issue.',
          error: 'COOKIES_RECOMMENDED'
        })
      );
    });

    it('should not persist to database when no videos were downloaded', async () => {
      VideoMetadataProcessor.processVideoMetadata.mockResolvedValue([]);
      archiveModule.getNewVideoUrlsSince.mockReturnValue([]);

      setTimeout(() => {
        mockProcess.emit('exit', 0, null);
      }, 10);

      await executor.doDownload(mockArgs, mockJobId, 'Manually Added Urls');

      // saveJobOnly should not be called when there are no videos
      expect(jobModule.saveJobOnly).not.toHaveBeenCalled();
    });

    it('should not backfill channel posters when no videos downloaded', async () => {
      VideoMetadataProcessor.processVideoMetadata.mockResolvedValue([]);
      archiveModule.getNewVideoUrlsSince.mockReturnValue([]);

      setTimeout(() => {
        mockProcess.emit('exit', 0, null);
      }, 10);

      await executor.doDownload(mockArgs, mockJobId, mockJobType);

      expect(channelModule.backfillChannelPosters).not.toHaveBeenCalled();
    });

    it('should handle channel poster backfill errors gracefully', async () => {
      VideoMetadataProcessor.processVideoMetadata.mockResolvedValue([
        { youtubeId: 'abc123', channel_id: 'UC123', filePath: '/output/video.mp4', fileSize: '1024' }
      ]);
      archiveModule.getNewVideoUrlsSince.mockReturnValue(['https://youtu.be/abc123']);
      Channel.findAll.mockResolvedValue([{ channel_id: 'UC123' }]);
      channelModule.backfillChannelPosters.mockRejectedValue(new Error('Backfill failed'));

      setTimeout(() => {
        mockProcess.emit('exit', 0, null);
      }, 10);

      await executor.doDownload(mockArgs, mockJobId, mockJobType);

      // Should log error but not fail the job
      expect(logger.error).toHaveBeenCalledWith(
        { err: expect.any(Error) },
        'Error backfilling channel posters'
      );
      expect(jobModule.updateJob).toHaveBeenCalledWith(
        mockJobId,
        expect.objectContaining({
          status: 'Complete'
        })
      );
    });

    it('should pass subfolderOverride to yt-dlp via environment variable', async () => {
      setTimeout(() => { mockProcess.emit('exit', 0, null); }, 10);
      await executor.doDownload(mockArgs, mockJobId, mockJobType, 0, null, false, false, { subfolderOverride: 'TestSubfolder' });
      expect(mockSpawn).toHaveBeenCalledWith('yt-dlp', mockArgs, {
        env: expect.objectContaining({ YOUTARR_JOB_ID: mockJobId, YOUTARR_SUBFOLDER_OVERRIDE: 'TestSubfolder' })
      });
    });

    it('should pass empty string subfolderOverride to yt-dlp', async () => {
      setTimeout(() => { mockProcess.emit('exit', 0, null); }, 10);
      await executor.doDownload(mockArgs, mockJobId, mockJobType, 0, null, false, false, { subfolderOverride: '' });
      expect(mockSpawn).toHaveBeenCalledWith('yt-dlp', mockArgs, {
        env: expect.objectContaining({ YOUTARR_JOB_ID: mockJobId, YOUTARR_SUBFOLDER_OVERRIDE: '' })
      });
    });

    it('should not set YOUTARR_SUBFOLDER_OVERRIDE when subfolderOverride is null', async () => {
      setTimeout(() => { mockProcess.emit('exit', 0, null); }, 10);
      await executor.doDownload(mockArgs, mockJobId, mockJobType, 0, null, false, false, { subfolderOverride: null });
      expect(mockSpawn).toHaveBeenCalledWith('yt-dlp', mockArgs, {
        env: expect.not.objectContaining({ YOUTARR_SUBFOLDER_OVERRIDE: expect.anything() })
      });
    });

    it('should not set YOUTARR_SUBFOLDER_OVERRIDE when no directives are passed', async () => {
      setTimeout(() => { mockProcess.emit('exit', 0, null); }, 10);
      await executor.doDownload(mockArgs, mockJobId, mockJobType, 0, null, false, false);
      expect(mockSpawn).toHaveBeenCalledWith('yt-dlp', mockArgs, {
        env: expect.not.objectContaining({ YOUTARR_SUBFOLDER_OVERRIDE: expect.anything() })
      });
    });

    it('should set YOUTARR_SUBFOLDER_FALLBACK when subfolderFallback is provided', async () => {
      setTimeout(() => { mockProcess.emit('exit', 0, null); }, 10);
      await executor.doDownload(mockArgs, mockJobId, mockJobType, 0, null, false, false, { subfolderFallback: 'PlaylistFolder' });
      expect(mockSpawn).toHaveBeenCalledWith('yt-dlp', mockArgs, {
        env: expect.objectContaining({ YOUTARR_SUBFOLDER_FALLBACK: 'PlaylistFolder' })
      });
    });

    it('should set YOUTARR_RATING_FALLBACK when ratingFallback is provided', async () => {
      setTimeout(() => { mockProcess.emit('exit', 0, null); }, 10);
      await executor.doDownload(mockArgs, mockJobId, mockJobType, 0, null, false, false, { ratingFallback: 'PG' });
      expect(mockSpawn).toHaveBeenCalledWith('yt-dlp', mockArgs, {
        env: expect.objectContaining({ YOUTARR_RATING_FALLBACK: 'PG' })
      });
    });

    it('should set YOUTARR_OWNER_CHANNEL_ID when ownerChannelId is provided', async () => {
      setTimeout(() => { mockProcess.emit('exit', 0, null); }, 10);
      await executor.doDownload(mockArgs, mockJobId, mockJobType, 0, null, false, false, { ownerChannelId: 'UC-subscription' });
      expect(mockSpawn).toHaveBeenCalledWith('yt-dlp', mockArgs, {
        env: expect.objectContaining({ YOUTARR_OWNER_CHANNEL_ID: 'UC-subscription' })
      });
    });

    it('should not set YOUTARR_OWNER_CHANNEL_ID when ownerChannelId is null', async () => {
      setTimeout(() => { mockProcess.emit('exit', 0, null); }, 10);
      await executor.doDownload(mockArgs, mockJobId, mockJobType, 0, null, false, false, { ownerChannelId: null });
      expect(mockSpawn).toHaveBeenCalledWith('yt-dlp', mockArgs, {
        env: expect.not.objectContaining({ YOUTARR_OWNER_CHANNEL_ID: expect.anything() })
      });
    });

    it('should set YOUTARR_OWNER_CHANNEL_MAP (serialized) when ownerChannelMap is provided', async () => {
      setTimeout(() => { mockProcess.emit('exit', 0, null); }, 10);
      const map = { abc123: 'UC-artist', def456: 'UC-other' };
      await executor.doDownload(mockArgs, mockJobId, mockJobType, 0, null, false, false, { ownerChannelMap: map });
      expect(mockSpawn).toHaveBeenCalledWith('yt-dlp', mockArgs, {
        env: expect.objectContaining({ YOUTARR_OWNER_CHANNEL_MAP: JSON.stringify(map) })
      });
    });

    it('should not set YOUTARR_OWNER_CHANNEL_MAP when the map is empty', async () => {
      setTimeout(() => { mockProcess.emit('exit', 0, null); }, 10);
      await executor.doDownload(mockArgs, mockJobId, mockJobType, 0, null, false, false, { ownerChannelMap: {} });
      expect(mockSpawn).toHaveBeenCalledWith('yt-dlp', mockArgs, {
        env: expect.not.objectContaining({ YOUTARR_OWNER_CHANNEL_MAP: expect.anything() })
      });
    });

    it('should log subfolderOverride in info message', async () => {
      setTimeout(() => { mockProcess.emit('exit', 0, null); }, 10);
      await executor.doDownload(mockArgs, mockJobId, mockJobType, 0, null, false, false, { subfolderOverride: 'MyFolder' });
      expect(logger.info).toHaveBeenCalledWith(
        { jobType: mockJobType, args: mockArgs, subfolderOverride: 'MyFolder' },
        'Running yt-dlp'
      );
    });

    describe('finalization error handling', () => {
      it('should resolve, mark the job Error, and start next job when finalization fails after clean exit', async () => {
        jobModule.updateJob.mockRejectedValueOnce(new Error('db down'));

        setTimeout(() => {
          mockProcess.emit('exit', 0, null);
        }, 10);

        await executor.doDownload(mockArgs, mockJobId, mockJobType);

        expect(logger.error).toHaveBeenCalledWith(
          expect.objectContaining({ err: expect.any(Error), jobId: mockJobId }),
          'Unexpected error finalizing download job'
        );
        expect(jobModule.updateJob).toHaveBeenCalledWith(
          mockJobId,
          expect.objectContaining({
            status: 'Error',
            endDate: expect.any(Number),
            output: expect.stringContaining('Job finalization error: db down')
          })
        );
        expect(jobModule.startNextJob).toHaveBeenCalled();
      });

      it('should resolve without starting next job when finalization fails and skipJobTransition is true', async () => {
        // getJob must return a job so the skipJobTransition path reaches
        // saveIntermediateGroupResults' updateJob call, which then rejects.
        jobModule.getJob.mockReturnValue({ id: mockJobId, data: {} });
        jobModule.updateJob.mockRejectedValueOnce(new Error('db down'));

        setTimeout(() => {
          mockProcess.emit('exit', 0, null);
        }, 10);

        await executor.doDownload(mockArgs, mockJobId, mockJobType, 0, null, false, true);

        expect(jobModule.updateJob).toHaveBeenCalledWith(
          mockJobId,
          expect.objectContaining({
            status: 'Error',
            endDate: expect.any(Number),
            output: expect.stringContaining('Job finalization error: db down')
          })
        );
        expect(jobModule.startNextJob).not.toHaveBeenCalled();
      });
    });

    describe('spawn error handling', () => {
      it('should mark the job Error with endDate and start next job on process spawn error', async () => {
        setTimeout(() => {
          mockProcess.emit('error', new Error('spawn yt-dlp ENOENT'));
        }, 5);

        await executor.doDownload(mockArgs, mockJobId, mockJobType);

        expect(jobModule.updateJob).toHaveBeenCalledWith(
          mockJobId,
          expect.objectContaining({
            status: 'Error',
            endDate: expect.any(Number),
            output: expect.stringContaining('Download process error: spawn yt-dlp ENOENT')
          })
        );
        expect(jobModule.startNextJob).toHaveBeenCalled();
      });

      it('should not start next job on process spawn error when skipJobTransition is true', async () => {
        setTimeout(() => {
          mockProcess.emit('error', new Error('spawn yt-dlp ENOENT'));
        }, 5);

        await executor.doDownload(mockArgs, mockJobId, mockJobType, 0, null, false, true);

        expect(jobModule.updateJob).toHaveBeenCalledWith(
          mockJobId,
          expect.objectContaining({
            status: 'Error',
            output: expect.stringContaining('Download process error: spawn yt-dlp ENOENT')
          })
        );
        expect(jobModule.startNextJob).not.toHaveBeenCalled();
      });

      it('should still settle and start next job when updateJob rejects during spawn error handling', async () => {
        jobModule.updateJob.mockRejectedValueOnce(new Error('db down'));

        setTimeout(() => {
          mockProcess.emit('error', new Error('spawn yt-dlp ENOENT'));
        }, 5);

        await executor.doDownload(mockArgs, mockJobId, mockJobType);

        expect(logger.error).toHaveBeenCalledWith(
          expect.objectContaining({ err: expect.any(Error), jobId: mockJobId }),
          'Failed to mark job as errored after process error'
        );
        expect(jobModule.startNextJob).toHaveBeenCalled();
      });
    });

    describe('exit/error double-fire guard', () => {
      it('ignores a late exit event after the error handler already finalized', async () => {
        setTimeout(() => {
          mockProcess.emit('error', new Error('kill EPERM'));
        }, 5);

        await executor.doDownload(mockArgs, mockJobId, mockJobType);

        const updateCalls = jobModule.updateJob.mock.calls.length;
        const startNextCalls = jobModule.startNextJob.mock.calls.length;
        expect(startNextCalls).toBe(1);

        // Node may emit 'exit' after 'error' for the same process; the exit
        // handler must not finalize the job a second time or start another job.
        mockProcess.emit('exit', 0, null);
        await new Promise((resolve) => setImmediate(resolve));

        expect(jobModule.updateJob.mock.calls.length).toBe(updateCalls);
        expect(jobModule.startNextJob.mock.calls.length).toBe(startNextCalls);
      });

      it('ignores a late error event after the exit handler already finalized', async () => {
        setTimeout(() => {
          mockProcess.emit('exit', 0, null);
        }, 5);

        await executor.doDownload(mockArgs, mockJobId, mockJobType);

        const updateCalls = jobModule.updateJob.mock.calls.length;

        mockProcess.emit('error', new Error('late kill failure'));
        await new Promise((resolve) => setImmediate(resolve));

        expect(jobModule.updateJob.mock.calls.length).toBe(updateCalls);
        expect(
          jobModule.updateJob.mock.calls.find(
            (c) => c[1].output && String(c[1].output).includes('Download process error')
          )
        ).toBeUndefined();
      });
    });

    describe('terminal status preservation', () => {
      it('does not overwrite a persisted Complete status when a post-persist step throws', async () => {
        // The final broadcast (the only emit carrying finalSummary) throws
        // AFTER the terminal updateJob has already persisted 'Complete'.
        MessageEmitter.emitMessage.mockImplementation((dest, clientId, src, type, payload) => {
          if (payload && payload.finalSummary) {
            throw new Error('websocket emit failed');
          }
        });

        setTimeout(() => {
          mockProcess.emit('exit', 0, null);
        }, 10);

        try {
          await executor.doDownload(mockArgs, mockJobId, mockJobType);
        } finally {
          MessageEmitter.emitMessage.mockReset();
        }

        expect(logger.error).toHaveBeenCalledWith(
          expect.objectContaining({ err: expect.any(Error), jobId: mockJobId }),
          'Unexpected error finalizing download job'
        );
        expect(jobModule.updateJob).toHaveBeenCalledWith(
          mockJobId,
          expect.objectContaining({ status: 'Complete' })
        );
        expect(
          jobModule.updateJob.mock.calls.find(
            (c) => c[1].output && String(c[1].output).includes('Job finalization error')
          )
        ).toBeUndefined();
        expect(jobModule.startNextJob).toHaveBeenCalled();
      });
    });
  });

  describe('failed video tracking', () => {
    const mockArgs = ['--format', 'best', 'https://youtube.com/watch?v=test'];
    const mockJobId = 'job-failed-123';
    const mockJobType = 'Manually Added Urls';

    it('should track failed videos when ERROR is detected in stdout', async () => {
      VideoMetadataProcessor.processVideoMetadata.mockResolvedValue([]);
      archiveModule.getNewVideoUrlsSince.mockReturnValue([]);

      setTimeout(() => {
        // Simulate extracting a video URL
        mockProcess.stdout.emit('data', '[youtube] Extracting URL: https://youtube.com/watch?v=abc123XYZ_d\n');
        // Simulate an error for that video
        mockProcess.stdout.emit('data', 'ERROR: Video unavailable\n');
        mockProcess.emit('exit', 0, null);
      }, 10);

      await executor.doDownload(mockArgs, mockJobId, mockJobType);

      // Should log the error
      expect(logger.warn).toHaveBeenCalledWith(
        { error: 'Video unavailable', currentVideoId: 'abc123XYZ_d' },
        'Error detected during download'
      );
      expect(logger.info).toHaveBeenCalledWith(
        { youtubeId: 'abc123XYZ_d', error: 'Video unavailable' },
        'Recorded video failure'
      );
    });

    it('should track failed videos when ERROR is detected in stderr', async () => {
      VideoMetadataProcessor.processVideoMetadata.mockResolvedValue([]);
      archiveModule.getNewVideoUrlsSince.mockReturnValue([]);

      setTimeout(() => {
        mockProcess.stdout.emit('data', '[youtube] Extracting URL: https://youtube.com/watch?v=def456XYZ\n');
        mockProcess.stderr.emit('data', 'ERROR: Private video\n');
        mockProcess.emit('exit', 0, null);
      }, 10);

      await executor.doDownload(mockArgs, mockJobId, mockJobType);

      expect(logger.warn).toHaveBeenCalledWith(
        { error: 'Private video', currentVideoId: 'def456XYZ' },
        'Error detected in stderr'
      );
    });

    it('should treat members-only download errors as expected skips', async () => {
      VideoMetadataProcessor.processVideoMetadata.mockResolvedValue([
        {
          youtubeId: 'success1234',
          filePath: '/output/video.mp4',
          fileSize: '1024',
          youTubeVideoName: 'Downloaded Video',
          youTubeChannelName: 'Channel'
        }
      ]);
      archiveModule.getNewVideoUrlsSince.mockReturnValue(['https://youtu.be/success1234']);

      setTimeout(() => {
        mockProcess.stdout.emit('data', '[youtube] Extracting URL: https://youtube.com/watch?v=member12345\n');
        mockProcess.stdout.emit('data', 'ERROR: [youtube] member12345: Join this channel to get access to members-only content like this video, and other exclusive perks.\n');
        mockProcess.emit('exit', 1, null);
      }, 10);

      await executor.doDownload(mockArgs, mockJobId, mockJobType);

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          youtubeId: 'member12345',
          source: 'stdout'
        }),
        'Expected video skip from yt-dlp'
      );
      expect(logger.warn).not.toHaveBeenCalledWith(
        expect.objectContaining({ currentVideoId: 'member12345' }),
        'Error detected during download'
      );
      expect(archiveModule.removeVideoFromArchive).not.toHaveBeenCalledWith('member12345');
      expect(jobModule.updateJob).toHaveBeenCalledWith(
        mockJobId,
        expect.objectContaining({
          status: 'Complete',
          data: expect.objectContaining({
            videos: expect.arrayContaining([
              expect.objectContaining({ youtubeId: 'success1234' })
            ]),
            failedVideos: []
          })
        })
      );

      const finalProgressCall = MessageEmitter.emitMessage.mock.calls.find(
        call => call[3] === 'downloadProgress' && call[4]?.finalSummary
      );
      expect(finalProgressCall[4]).toEqual(expect.objectContaining({
        text: 'Download completed: 1 video downloaded',
        finalSummary: expect.objectContaining({
          totalDownloaded: 1,
          totalFailed: 0,
          failedVideos: []
        })
      }));
      expect(finalProgressCall[4]).not.toHaveProperty('warning');
      expect(notificationModule.sendDownloadNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          finalSummary: expect.objectContaining({
            totalFailed: 0,
            failedVideos: []
          })
        })
      );
    });

    it('should complete with zero-download summary when only upcoming live videos are skipped', async () => {
      VideoMetadataProcessor.processVideoMetadata.mockResolvedValue([]);
      archiveModule.getNewVideoUrlsSince.mockReturnValue([]);

      setTimeout(() => {
        mockProcess.stdout.emit('data', '[youtube] Extracting URL: https://youtube.com/watch?v=live1234567\n');
        mockProcess.stdout.emit('data', 'ERROR: [youtube] live1234567: This live event will begin in 21 hours.\n');
        mockProcess.emit('exit', 1, null);
      }, 10);

      await executor.doDownload(mockArgs, mockJobId, mockJobType);

      expect(jobModule.updateJob).toHaveBeenCalledWith(
        mockJobId,
        expect.objectContaining({
          status: 'Complete',
          data: expect.objectContaining({
            videos: [],
            failedVideos: []
          })
        })
      );
      // Notification module is invoked, but its own totalDownloaded === 0 guard
      // keeps users from getting a "0 videos downloaded" message.
      expect(notificationModule.sendDownloadNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          finalSummary: expect.objectContaining({
            totalDownloaded: 0,
            totalFailed: 0,
            failedVideos: []
          })
        })
      );

      const finalProgressCall = MessageEmitter.emitMessage.mock.calls.find(
        call => call[3] === 'downloadProgress' && call[4]?.finalSummary
      );
      expect(finalProgressCall[4]).toEqual(expect.objectContaining({
        text: 'Download completed: No new videos to download',
        finalSummary: expect.objectContaining({
          totalDownloaded: 0,
          totalFailed: 0,
          failedVideos: []
        })
      }));
      expect(finalProgressCall[4]).not.toHaveProperty('warning');
    });

    it('should not mark job Complete when an unassociated stdout error coexists with expected skips', async () => {
      VideoMetadataProcessor.processVideoMetadata.mockResolvedValue([]);
      archiveModule.getNewVideoUrlsSince.mockReturnValue([]);

      setTimeout(() => {
        // Expected skip ERROR - suppressed by isExpectedYtdlpSkipMessage and
        // does not increment unexpectedErrorCount.
        mockProcess.stdout.emit('data', 'ERROR: This video is members-only\n');
        // Real ERROR with no currentVideoId set. failedVideos.set is gated on
        // currentVideoId so it never enters failedVideosList, but it must
        // still bump unexpectedErrorCount so the job is not classified as
        // "expected skips only".
        mockProcess.stdout.emit('data', 'ERROR: Generic unexpected failure\n');
        mockProcess.emit('exit', 1, null);
      }, 10);

      await executor.doDownload(mockArgs, mockJobId, mockJobType);

      expect(jobModule.updateJob).not.toHaveBeenCalledWith(
        mockJobId,
        expect.objectContaining({ status: 'Complete' })
      );

      const finalProgressCall = MessageEmitter.emitMessage.mock.calls.find(
        call => call[3] === 'downloadProgress' && call[4]?.finalSummary
      );
      expect(finalProgressCall[4]).not.toHaveProperty('warning');
      expect(finalProgressCall[4]).toHaveProperty('error', true);
    });

    it('should not mark job Complete when an unassociated stderr error coexists with expected skips', async () => {
      VideoMetadataProcessor.processVideoMetadata.mockResolvedValue([]);
      archiveModule.getNewVideoUrlsSince.mockReturnValue([]);

      setTimeout(() => {
        // Expected skip ERROR via stderr - matched by isExpectedYtdlpSkipMessage,
        // increments expectedSkipCount only.
        mockProcess.stderr.emit('data', 'ERROR: This video is members-only\n');
        // Real ERROR via stderr with no currentVideoId. The stderr handler
        // never calls monitor.processProgress, so monitor.hasError alone
        // would miss this case; unexpectedErrorCount must catch it.
        mockProcess.stderr.emit('data', 'ERROR: Generic unexpected failure\n');
        mockProcess.emit('exit', 1, null);
      }, 10);

      await executor.doDownload(mockArgs, mockJobId, mockJobType);

      expect(jobModule.updateJob).not.toHaveBeenCalledWith(
        mockJobId,
        expect.objectContaining({ status: 'Complete' })
      );

      const finalProgressCall = MessageEmitter.emitMessage.mock.calls.find(
        call => call[3] === 'downloadProgress' && call[4]?.finalSummary
      );
      expect(finalProgressCall[4]).not.toHaveProperty('warning');
      expect(finalProgressCall[4]).toHaveProperty('error', true);
    });

    it('should classify every ERROR line when a stderr chunk coalesces multiple lines', async () => {
      VideoMetadataProcessor.processVideoMetadata.mockResolvedValue([]);
      archiveModule.getNewVideoUrlsSince.mockReturnValue([]);

      setTimeout(() => {
        // Node streams can deliver multiple newline-separated lines in one
        // 'data' event. The stderr handler must classify each ERROR: line,
        // not just the first match in the chunk.
        mockProcess.stderr.emit(
          'data',
          'ERROR: This video is members-only\nERROR: Generic unexpected failure\n'
        );
        mockProcess.emit('exit', 1, null);
      }, 10);

      await executor.doDownload(mockArgs, mockJobId, mockJobType);

      expect(jobModule.updateJob).not.toHaveBeenCalledWith(
        mockJobId,
        expect.objectContaining({ status: 'Complete' })
      );

      const finalProgressCall = MessageEmitter.emitMessage.mock.calls.find(
        call => call[3] === 'downloadProgress' && call[4]?.finalSummary
      );
      expect(finalProgressCall[4]).not.toHaveProperty('warning');
      expect(finalProgressCall[4]).toHaveProperty('error', true);
    });

    it('should track currentVideoId from destination path for main video files', async () => {
      VideoMetadataProcessor.processVideoMetadata.mockResolvedValue([]);
      archiveModule.getNewVideoUrlsSince.mockReturnValue([]);

      setTimeout(() => {
        mockProcess.stdout.emit('data', '[download] Destination: /output/Channel - Title [xyz789ABC_d].mp4\n');
        mockProcess.stdout.emit('data', 'ERROR: Download failed\n');
        mockProcess.emit('exit', 0, null);
      }, 10);

      await executor.doDownload(mockArgs, mockJobId, mockJobType);

      expect(logger.debug).toHaveBeenCalledWith(
        { currentVideoId: 'xyz789ABC_d', destPath: '/output/Channel - Title [xyz789ABC_d].mp4' },
        'Updated current video ID from destination'
      );
    });

    it('should separate successful and failed videos based on fileSize', async () => {
      VideoMetadataProcessor.processVideoMetadata.mockResolvedValue([
        { youtubeId: 'success123', filePath: '/output/video1.mp4', fileSize: '1024', youTubeVideoName: 'Success Video', youTubeChannelName: 'Test Channel' },
        { youtubeId: 'failed456', filePath: '/output/video2.mp4', fileSize: null, youTubeVideoName: 'Failed Video', youTubeChannelName: 'Test Channel' }
      ]);
      archiveModule.getNewVideoUrlsSince.mockReturnValue(['https://youtu.be/success123']);

      setTimeout(() => {
        mockProcess.emit('exit', 0, null);
      }, 10);

      await executor.doDownload(mockArgs, mockJobId, mockJobType);

      // Should log warning for failed video
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          youtubeId: 'failed456',
          error: 'Media file not found or incomplete'
        }),
        'Download failed'
      );

      // Job data should include failedVideos
      expect(jobModule.updateJob).toHaveBeenCalledWith(
        mockJobId,
        expect.objectContaining({
          data: expect.objectContaining({
            videos: expect.arrayContaining([
              expect.objectContaining({ youtubeId: 'success123' })
            ]),
            failedVideos: expect.arrayContaining([
              expect.objectContaining({
                youtubeId: 'failed456',
                title: 'Failed Video',
                channel: 'Test Channel',
                error: 'Media file not found or incomplete'
              })
            ])
          })
        })
      );
    });

    it('should treat fileSize of "0" or "null" string as failed', async () => {
      VideoMetadataProcessor.processVideoMetadata.mockResolvedValue([
        { youtubeId: 'zero123', filePath: '/output/video1.mp4', fileSize: '0', youTubeVideoName: 'Zero Size', youTubeChannelName: 'Channel' },
        { youtubeId: 'null456', filePath: '/output/video2.mp4', fileSize: 'null', youTubeVideoName: 'Null Size', youTubeChannelName: 'Channel' }
      ]);
      archiveModule.getNewVideoUrlsSince.mockReturnValue([]);

      setTimeout(() => {
        mockProcess.emit('exit', 0, null);
      }, 10);

      await executor.doDownload(mockArgs, mockJobId, mockJobType);

      expect(jobModule.updateJob).toHaveBeenCalledWith(
        mockJobId,
        expect.objectContaining({
          data: expect.objectContaining({
            videos: [],
            failedVideos: expect.arrayContaining([
              expect.objectContaining({ youtubeId: 'zero123' }),
              expect.objectContaining({ youtubeId: 'null456' })
            ])
          })
        })
      );
    });

    it('should include failed videos that have no metadata', async () => {
      VideoMetadataProcessor.processVideoMetadata.mockResolvedValue([]);
      archiveModule.getNewVideoUrlsSince.mockReturnValue([]);

      setTimeout(() => {
        mockProcess.stdout.emit('data', '[youtube] Extracting URL: https://youtube.com/watch?v=nodata123\n');
        mockProcess.stdout.emit('data', 'ERROR: This video is not available\n');
        mockProcess.emit('exit', 0, null);
      }, 10);

      await executor.doDownload(mockArgs, mockJobId, mockJobType);

      expect(logger.warn).toHaveBeenCalledWith(
        { youtubeId: 'nodata123', error: 'This video is not available' },
        'Video failed without metadata'
      );

      expect(jobModule.updateJob).toHaveBeenCalledWith(
        mockJobId,
        expect.objectContaining({
          data: expect.objectContaining({
            failedVideos: expect.arrayContaining([
              expect.objectContaining({
                youtubeId: 'nodata123',
                title: 'Unknown',
                channel: 'Unknown',
                error: 'This video is not available'
              })
            ])
          })
        })
      );
    });

    it('should set final state to "warning" when some videos fail but others succeed', async () => {
      VideoMetadataProcessor.processVideoMetadata.mockResolvedValue([
        { youtubeId: 'success1', filePath: '/output/video1.mp4', fileSize: '1024', youTubeVideoName: 'Good', youTubeChannelName: 'Channel' },
        { youtubeId: 'failed1', filePath: '/output/video2.mp4', fileSize: null, youTubeVideoName: 'Bad', youTubeChannelName: 'Channel' }
      ]);
      archiveModule.getNewVideoUrlsSince.mockReturnValue(['https://youtu.be/success1']);

      setTimeout(() => {
        mockProcess.emit('exit', 0, null);
      }, 10);

      await executor.doDownload(mockArgs, mockJobId, mockJobType);

      // Final message should indicate partial failure
      expect(MessageEmitter.emitMessage).toHaveBeenCalledWith(
        'broadcast',
        null,
        'download',
        'downloadProgress',
        expect.objectContaining({
          text: expect.stringContaining('completed with errors'),
          warning: true,
          finalSummary: expect.objectContaining({
            totalDownloaded: 1,
            totalFailed: 1,
            failedVideos: expect.any(Array)
          })
        })
      );
    });

    it('should include failed count in completion message', async () => {
      VideoMetadataProcessor.processVideoMetadata.mockResolvedValue([
        { youtubeId: 'ok1', filePath: '/output/v1.mp4', fileSize: '1024', youTubeVideoName: 'OK', youTubeChannelName: 'Ch' },
        { youtubeId: 'ok2', filePath: '/output/v2.mp4', fileSize: '2048', youTubeVideoName: 'OK2', youTubeChannelName: 'Ch' },
        { youtubeId: 'bad1', filePath: '/output/v3.mp4', fileSize: '0', youTubeVideoName: 'Bad', youTubeChannelName: 'Ch' }
      ]);
      archiveModule.getNewVideoUrlsSince.mockReturnValue(['https://youtu.be/ok1', 'https://youtu.be/ok2']);

      setTimeout(() => {
        mockProcess.emit('exit', 0, null);
      }, 10);

      await executor.doDownload(mockArgs, mockJobId, mockJobType);

      expect(MessageEmitter.emitMessage).toHaveBeenCalledWith(
        'broadcast',
        null,
        'download',
        'downloadProgress',
        expect.objectContaining({
          text: expect.stringContaining('2 videos downloaded, 1 failed')
        })
      );
    });

    it('should not duplicate errors for the same video', async () => {
      VideoMetadataProcessor.processVideoMetadata.mockResolvedValue([]);
      archiveModule.getNewVideoUrlsSince.mockReturnValue([]);

      setTimeout(() => {
        mockProcess.stdout.emit('data', '[youtube] Extracting URL: https://youtube.com/watch?v=dup123\n');
        mockProcess.stdout.emit('data', 'ERROR: First error\n');
        mockProcess.stdout.emit('data', 'ERROR: Second error\n'); // Should not replace first
        mockProcess.emit('exit', 0, null);
      }, 10);

      await executor.doDownload(mockArgs, mockJobId, mockJobType);

      // Should only record the first error
      expect(logger.info).toHaveBeenCalledWith(
        { youtubeId: 'dup123', error: 'First error' },
        'Recorded video failure'
      );

      // Second error should be logged but not recorded
      expect(logger.info).not.toHaveBeenCalledWith(
        { youtubeId: 'dup123', error: 'Second error' },
        'Recorded video failure'
      );
    });

    it('should populate URL in failedVideos from urlsToProcess', async () => {
      VideoMetadataProcessor.processVideoMetadata.mockResolvedValue([]);
      const testUrls = ['https://youtu.be/url123', 'https://youtu.be/url456'];
      archiveModule.getNewVideoUrlsSince.mockReturnValue(testUrls);

      setTimeout(() => {
        mockProcess.stdout.emit('data', '[youtube] Extracting URL: https://youtube.com/watch?v=url123\n');
        mockProcess.stdout.emit('data', 'ERROR: Failed to download\n');
        mockProcess.emit('exit', 0, null);
      }, 10);

      await executor.doDownload(mockArgs, mockJobId, mockJobType);

      expect(jobModule.updateJob).toHaveBeenCalledWith(
        mockJobId,
        expect.objectContaining({
          data: expect.objectContaining({
            failedVideos: expect.arrayContaining([
              expect.objectContaining({
                youtubeId: 'url123',
                url: 'https://youtu.be/url123'
              })
            ])
          })
        })
      );
    });

    it('should clear lastErrorMessage when starting new video', async () => {
      VideoMetadataProcessor.processVideoMetadata.mockResolvedValue([]);
      archiveModule.getNewVideoUrlsSince.mockReturnValue([]);

      setTimeout(() => {
        mockProcess.stdout.emit('data', '[youtube] Extracting URL: https://youtube.com/watch?v=first\n');
        mockProcess.stdout.emit('data', 'ERROR: Error for first video\n');
        // Start second video - should clear error
        mockProcess.stdout.emit('data', '[youtube] Extracting URL: https://youtube.com/watch?v=second\n');
        mockProcess.emit('exit', 0, null);
      }, 10);

      await executor.doDownload(mockArgs, mockJobId, mockJobType);

      // Should track video ID change
      expect(logger.debug).toHaveBeenCalledWith(
        { currentVideoId: 'first', url: 'https://youtube.com/watch?v=first' },
        'Tracking video extraction'
      );
      expect(logger.debug).toHaveBeenCalledWith(
        { currentVideoId: 'second', url: 'https://youtube.com/watch?v=second' },
        'Tracking video extraction'
      );
    });

    it('should not remove videos from archive when failure was only detected by missing file size (stat failure)', async () => {
      VideoMetadataProcessor.processVideoMetadata.mockResolvedValue([
        { youtubeId: 'success1', filePath: '/output/video1.mp4', fileSize: '1024', youTubeVideoName: 'Good', youTubeChannelName: 'Channel' },
        { youtubeId: 'statfail1', filePath: '/output/video2.mp4', fileSize: null, youTubeVideoName: 'Maybe OK', youTubeChannelName: 'Channel' }
      ]);
      archiveModule.getNewVideoUrlsSince.mockReturnValue(['https://youtu.be/success1']);

      setTimeout(() => {
        mockProcess.emit('exit', 0, null);
      }, 10);

      await executor.doDownload(mockArgs, mockJobId, mockJobType);

      // Should NOT remove from archive — the video was not explicitly failed,
      // only missing file size (e.g. NFS stat timeout). Removing would cause spurious re-downloads.
      expect(archiveModule.removeVideoFromArchive).not.toHaveBeenCalledWith('statfail1');
      expect(archiveModule.removeVideoFromArchive).not.toHaveBeenCalledWith('success1');
    });

    it('should remove explicitly failed videos from archive when allowRedownload is false', async () => {
      VideoMetadataProcessor.processVideoMetadata.mockResolvedValue([
        { youtubeId: 'success1', filePath: '/output/video1.mp4', fileSize: '1024', youTubeVideoName: 'Good', youTubeChannelName: 'Channel' },
        { youtubeId: 'failed1', filePath: '/output/video2.mp4', fileSize: null, youTubeVideoName: 'Bad', youTubeChannelName: 'Channel' }
      ]);
      archiveModule.getNewVideoUrlsSince.mockReturnValue(['https://youtu.be/success1']);

      setTimeout(() => {
        // Simulate yt-dlp explicitly reporting an error for failed1
        mockProcess.stdout.emit('data', '[youtube] Extracting URL: https://youtube.com/watch?v=failed1\n');
        mockProcess.stdout.emit('data', 'ERROR: Failed to download\n');
        mockProcess.emit('exit', 0, null);
      }, 10);

      await executor.doDownload(mockArgs, mockJobId, mockJobType);

      // Should remove the explicitly failed video from archive so it can be retried
      expect(archiveModule.removeVideoFromArchive).toHaveBeenCalledWith('failed1');
      // Should NOT remove the successful video
      expect(archiveModule.removeVideoFromArchive).not.toHaveBeenCalledWith('success1');
    });

    it('should not remove failed videos from archive when allowRedownload is true', async () => {
      const fs = require('fs');
      fs.existsSync.mockReturnValue(true);
      VideoMetadataProcessor.processVideoMetadata.mockResolvedValue([
        { youtubeId: 'success1', filePath: '/output/video1.mp4', fileSize: '1024', youTubeVideoName: 'Good', youTubeChannelName: 'Channel' },
        { youtubeId: 'failed1', filePath: '/output/video2.mp4', fileSize: null, youTubeVideoName: 'Bad', youTubeChannelName: 'Channel' }
      ]);
      archiveModule.getNewVideoUrlsSince.mockReturnValue(['https://youtu.be/success1']);

      setTimeout(() => {
        mockProcess.emit('exit', 0, null);
      }, 10);

      // allowRedownload = true (6th argument)
      await executor.doDownload(mockArgs, mockJobId, mockJobType, 0, null, true);

      // Should NOT remove from archive when allowRedownload is true
      expect(archiveModule.removeVideoFromArchive).not.toHaveBeenCalled();
    });

    it('should remove failed videos from archive that have no metadata', async () => {
      VideoMetadataProcessor.processVideoMetadata.mockResolvedValue([]);
      archiveModule.getNewVideoUrlsSince.mockReturnValue([]);

      setTimeout(() => {
        mockProcess.stdout.emit('data', '[youtube] Extracting URL: https://youtube.com/watch?v=nodata123\n');
        mockProcess.stdout.emit('data', 'ERROR: This video is not available\n');
        mockProcess.emit('exit', 0, null);
      }, 10);

      await executor.doDownload(mockArgs, mockJobId, mockJobType);

      // Should remove from archive even if no metadata was available
      expect(archiveModule.removeVideoFromArchive).toHaveBeenCalledWith('nodata123');
    });
  });

  describe('terminateCurrentJob', () => {
    it('should return null when no job is running', () => {
      expect(executor.terminateCurrentJob()).toBeNull();
      expect(logger.info).toHaveBeenCalledWith('No job currently running to terminate');
    });

    it('should send SIGTERM to current process', () => {
      executor.currentProcess = mockProcess;
      executor.currentJobId = 'job-123';

      const jobId = executor.terminateCurrentJob('User requested');

      expect(jobId).toBe('job-123');
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
      expect(executor.manualTerminationReason).toBe('User requested');
    });

    it('should force kill after grace period', () => {
      jest.useFakeTimers();

      executor.currentProcess = mockProcess;
      executor.currentJobId = 'job-123';

      executor.terminateCurrentJob('Timeout');

      // Fast-forward 60 seconds
      jest.advanceTimersByTime(60 * 1000);

      expect(mockProcess.kill).toHaveBeenCalledWith('SIGKILL');

      jest.useRealTimers();
    });

    it('should not force kill if process already exited', () => {
      jest.useFakeTimers();

      executor.currentProcess = mockProcess;
      executor.currentJobId = 'job-123';

      executor.terminateCurrentJob('Test');

      // Simulate process exit
      executor.currentProcess = null;
      executor.currentJobId = null;

      // Fast-forward
      jest.advanceTimersByTime(60 * 1000);

      expect(mockProcess.kill).toHaveBeenCalledTimes(1); // Only SIGTERM, not SIGKILL

      jest.useRealTimers();
    });

    it('should handle kill errors gracefully', () => {
      executor.currentProcess = mockProcess;
      executor.currentJobId = 'job-123';
      mockProcess.kill.mockImplementation(() => {
        throw new Error('Process not found');
      });

      const jobId = executor.terminateCurrentJob();

      expect(jobId).toBeNull();
      expect(executor.manualTerminationReason).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        { err: expect.any(Error) },
        'Error terminating job'
      );
    });
  });

  describe('timeout and activity monitoring', () => {
    const mockArgs = ['--format', 'best', 'https://youtube.com/watch?v=test'];

    it('should have configurable timeout values', () => {
      expect(executor.activityTimeoutMs).toBe(30 * 60 * 1000); // 30 minutes
      expect(executor.maxAbsoluteTimeoutMs).toBe(6 * 60 * 60 * 1000); // 6 hours
    });

    it('should track current process for manual termination', async () => {
      let processReference = null;
      let jobIdReference = null;

      setTimeout(() => {
        // Capture references before they're cleared
        processReference = executor.currentProcess;
        jobIdReference = executor.currentJobId;

        mockProcess.emit('exit', 0, null);
      }, 10);

      await executor.doDownload(mockArgs, 'job-123', 'Channel Downloads');

      // Verify process was tracked during execution
      expect(processReference).not.toBeNull();
      expect(jobIdReference).toBe('job-123');

      // After exit, references should be cleared
      expect(executor.currentProcess).toBeNull();
      expect(executor.currentJobId).toBeNull();
    });
  });

  describe('persistTerminatedChannel', () => {
    beforeEach(() => {
      Channel.findOne.mockReset();
    });

    it('stamps terminated_at and clears auto_download_enabled_tabs on first detection', async () => {
      const channelRow = {
        terminated_at: null,
        uploader: 'Test Channel',
        url: 'https://www.youtube.com/channel/UC1234567890123456789012',
        update: jest.fn().mockResolvedValue()
      };
      Channel.findOne.mockResolvedValueOnce(channelRow);

      const result = await executor.persistTerminatedChannel('UC1234567890123456789012');

      expect(Channel.findOne).toHaveBeenCalledWith({ where: { channel_id: 'UC1234567890123456789012' } });
      expect(channelRow.update).toHaveBeenCalledWith({
        terminated_at: expect.any(Date),
        auto_download_enabled_tabs: ''
      });
      expect(result).toBe(channelRow);
    });

    it('preserves the original terminated_at on re-detection but still clears tabs', async () => {
      const originalDate = new Date('2026-01-15T12:00:00Z');
      const channelRow = {
        terminated_at: originalDate,
        uploader: 'Test Channel',
        url: 'https://www.youtube.com/channel/UC1234567890123456789012',
        update: jest.fn().mockResolvedValue()
      };
      Channel.findOne.mockResolvedValueOnce(channelRow);

      await executor.persistTerminatedChannel('UC1234567890123456789012');

      expect(channelRow.update).toHaveBeenCalledWith({
        terminated_at: originalDate,
        auto_download_enabled_tabs: ''
      });
    });

    it('returns null and logs a warning when the channel is not in the database', async () => {
      Channel.findOne.mockResolvedValueOnce(null);

      const result = await executor.persistTerminatedChannel('UC0000000000000000000000');

      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ channelId: 'UC0000000000000000000000' }),
        'Terminated channel not in DB; skipping persistence'
      );
    });

    it('swallows db errors and returns null', async () => {
      Channel.findOne.mockRejectedValueOnce(new Error('db down'));

      const result = await executor.persistTerminatedChannel('UC1234567890123456789012');

      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ channelId: 'UC1234567890123456789012' }),
        'Failed to persist terminated channel state'
      );
    });

    it('is a no-op when channelId is falsy', async () => {
      await expect(executor.persistTerminatedChannel(null)).resolves.toBeNull();
      await expect(executor.persistTerminatedChannel('')).resolves.toBeNull();
      await expect(executor.persistTerminatedChannel(undefined)).resolves.toBeNull();
      expect(Channel.findOne).not.toHaveBeenCalled();
    });
  });

  describe('terminated channel handling in doDownload', () => {
    const mockArgs = ['--format', 'best', 'https://www.youtube.com/channel/UC1234567890123456789012'];
    const mockJobId = 'job-term-1';
    const mockJobType = 'Channel Downloads';

    beforeEach(() => {
      Channel.findOne.mockReset();
    });

    it('marks termination-only runs as Complete with Warnings and includes terminatedChannels in finalSummary', async () => {
      const channelRow = {
        terminated_at: null,
        uploader: 'Banned Channel',
        url: 'https://www.youtube.com/channel/UC1234567890123456789012',
        update: jest.fn().mockResolvedValue()
      };
      Channel.findOne.mockResolvedValue(channelRow);

      VideoMetadataProcessor.processVideoMetadata.mockResolvedValue([]);
      archiveModule.getNewVideoUrlsSince.mockReturnValue([]);

      setTimeout(() => {
        const termLine = 'ERROR: [youtube:tab] UC1234567890123456789012: YouTube said: This account has been terminated for violating Google\'s Terms of Service.\n';
        mockProcess.stderr.emit('data', Buffer.from(termLine));
        setTimeout(() => mockProcess.emit('exit', 1, null), 5);
      }, 10);

      await executor.doDownload(mockArgs, mockJobId, mockJobType);

      expect(channelRow.update).toHaveBeenCalledWith({
        terminated_at: expect.any(Date),
        auto_download_enabled_tabs: ''
      });

      const updateJobCalls = jobModule.updateJob.mock.calls.filter(c => c[0] === mockJobId);
      const terminalCall = updateJobCalls[updateJobCalls.length - 1];
      expect(terminalCall[1].status).toBe('Complete with Warnings');
      expect(terminalCall[1].data.terminatedChannels).toEqual([
        expect.objectContaining({ channelId: 'UC1234567890123456789012', uploader: 'Banned Channel' })
      ]);
      expect(terminalCall[1].data.totalTerminatedChannels).toBe(1);
    });

    it('emits a final WebSocket payload with terminatedChannels under finalSummary', async () => {
      const channelRow = {
        terminated_at: null,
        uploader: 'Banned Channel',
        url: 'https://www.youtube.com/channel/UC1234567890123456789012',
        update: jest.fn().mockResolvedValue()
      };
      Channel.findOne.mockResolvedValue(channelRow);

      setTimeout(() => {
        const termLine = 'ERROR: [youtube:tab] UC1234567890123456789012: YouTube said: This account has been terminated for violating Google\'s Terms of Service.\n';
        mockProcess.stderr.emit('data', Buffer.from(termLine));
        setTimeout(() => mockProcess.emit('exit', 1, null), 5);
      }, 10);

      await executor.doDownload(mockArgs, mockJobId, mockJobType);

      const finalCall = MessageEmitter.emitMessage.mock.calls.find(call => call[4] && call[4].finalSummary);
      expect(finalCall).toBeDefined();
      expect(finalCall[4].finalSummary.terminatedChannels).toEqual([
        expect.objectContaining({ channelId: 'UC1234567890123456789012', uploader: 'Banned Channel' })
      ]);
      expect(finalCall[4].finalSummary.totalTerminatedChannels).toBe(1);
    });

    it('does not increment unexpectedErrorCount or record a failed video for terminated errors', async () => {
      const channelRow = {
        terminated_at: null,
        uploader: 'Banned Channel',
        url: 'https://www.youtube.com/channel/UC1234567890123456789012',
        update: jest.fn().mockResolvedValue()
      };
      Channel.findOne.mockResolvedValue(channelRow);

      setTimeout(() => {
        const termLine = 'ERROR: [youtube:tab] UC1234567890123456789012: YouTube said: This account has been terminated for violating Google\'s Terms of Service.\n';
        mockProcess.stderr.emit('data', Buffer.from(termLine));
        setTimeout(() => mockProcess.emit('exit', 1, null), 5);
      }, 10);

      await executor.doDownload(mockArgs, mockJobId, mockJobType);

      const updateJobCalls = jobModule.updateJob.mock.calls.filter(c => c[0] === mockJobId);
      const terminalCall = updateJobCalls[updateJobCalls.length - 1];
      expect(terminalCall[1].data.failedVideos).toEqual([]);
    });

    it('dedupes when the same termination message arrives on both stdout and stderr', async () => {
      const channelRow = {
        terminated_at: null,
        uploader: 'Banned Channel',
        url: 'https://www.youtube.com/channel/UC1234567890123456789012',
        update: jest.fn().mockResolvedValue()
      };
      Channel.findOne.mockResolvedValue(channelRow);

      setTimeout(() => {
        const termLine = 'ERROR: [youtube:tab] UC1234567890123456789012: YouTube said: This account has been terminated for violating Google\'s Terms of Service.\n';
        mockProcess.stdout.emit('data', Buffer.from(termLine));
        mockProcess.stderr.emit('data', Buffer.from(termLine));
        setTimeout(() => mockProcess.emit('exit', 1, null), 5);
      }, 10);

      await executor.doDownload(mockArgs, mockJobId, mockJobType);

      // Set dedupe means only one lookup across both stream sources.
      expect(Channel.findOne).toHaveBeenCalledTimes(1);
      expect(channelRow.update).toHaveBeenCalledTimes(1);
    });

    it('does NOT mark run as handled when channel cannot be persisted', async () => {
      // Channel not in DB: persistence returns null, run must surface as a failure.
      Channel.findOne.mockResolvedValue(null);
      VideoMetadataProcessor.processVideoMetadata.mockResolvedValue([]);

      setTimeout(() => {
        const termLine = 'ERROR: [youtube:tab] UC1234567890123456789012: YouTube said: This account has been terminated for violating Google\'s Terms of Service.\n';
        mockProcess.stderr.emit('data', Buffer.from(termLine));
        setTimeout(() => mockProcess.emit('exit', 1, null), 5);
      }, 10);

      await executor.doDownload(mockArgs, mockJobId, mockJobType);

      const updateJobCalls = jobModule.updateJob.mock.calls.filter(c => c[0] === mockJobId);
      const terminalCall = updateJobCalls[updateJobCalls.length - 1];
      // Not Complete with Warnings: persistence failed, this is a real error.
      expect(['Error', 'Failed']).toContain(terminalCall[1].status);
      // No false-positive summary entry.
      expect(terminalCall[1].data.terminatedChannels).toEqual([]);
      expect(terminalCall[1].data.totalTerminatedChannels).toBe(0);
      // The channel id IS recorded as a termination failure for the finalizer.
      expect(terminalCall[1].data.terminationFailures).toEqual(['UC1234567890123456789012']);
      expect(terminalCall[1].data.totalTerminationFailures).toBe(1);
    });

    it('records terminationFailures in the finalSummary broadcast', async () => {
      Channel.findOne.mockResolvedValue(null);
      VideoMetadataProcessor.processVideoMetadata.mockResolvedValue([]);

      setTimeout(() => {
        const termLine = 'ERROR: [youtube:tab] UC1234567890123456789012: YouTube said: This account has been terminated for violating Google\'s Terms of Service.\n';
        mockProcess.stderr.emit('data', Buffer.from(termLine));
        setTimeout(() => mockProcess.emit('exit', 1, null), 5);
      }, 10);

      await executor.doDownload(mockArgs, mockJobId, mockJobType);

      const finalCall = MessageEmitter.emitMessage.mock.calls.find(call => call[4] && call[4].finalSummary);
      expect(finalCall).toBeDefined();
      expect(finalCall[4].finalSummary.terminationFailures).toEqual(['UC1234567890123456789012']);
      expect(finalCall[4].finalSummary.totalTerminationFailures).toBe(1);
    });

    it('does NOT mark run as handled when persistTerminatedChannel throws (db error)', async () => {
      // Update throws: surface as a real failure, same as the "not in DB" path.
      const channelRow = {
        terminated_at: null,
        uploader: 'Banned Channel',
        url: 'https://www.youtube.com/channel/UC1234567890123456789012',
        update: jest.fn().mockRejectedValue(new Error('db down'))
      };
      Channel.findOne.mockResolvedValue(channelRow);
      VideoMetadataProcessor.processVideoMetadata.mockResolvedValue([]);

      setTimeout(() => {
        const termLine = 'ERROR: [youtube:tab] UC1234567890123456789012: YouTube said: This account has been terminated for violating Google\'s Terms of Service.\n';
        mockProcess.stderr.emit('data', Buffer.from(termLine));
        setTimeout(() => mockProcess.emit('exit', 1, null), 5);
      }, 10);

      await executor.doDownload(mockArgs, mockJobId, mockJobType);

      const updateJobCalls = jobModule.updateJob.mock.calls.filter(c => c[0] === mockJobId);
      const terminalCall = updateJobCalls[updateJobCalls.length - 1];
      expect(['Error', 'Failed']).toContain(terminalCall[1].status);
      expect(terminalCall[1].data.terminatedChannels).toEqual([]);
    });

    it('falls through to unexpected-error branch when termination message has no extractable channel_id', async () => {
      VideoMetadataProcessor.processVideoMetadata.mockResolvedValue([]);

      setTimeout(() => {
        const badLine = 'ERROR: account has been terminated for violating Google\'s Terms of Service.\n';
        mockProcess.stderr.emit('data', Buffer.from(badLine));
        setTimeout(() => mockProcess.emit('exit', 1, null), 5);
      }, 10);

      await executor.doDownload(mockArgs, mockJobId, mockJobType);

      expect(Channel.findOne).not.toHaveBeenCalled();
      const updateJobCalls = jobModule.updateJob.mock.calls.filter(c => c[0] === mockJobId);
      const terminalCall = updateJobCalls[updateJobCalls.length - 1];
      // No channel id: generic Error.
      expect(['Error', 'Failed']).toContain(terminalCall[1].status);
    });
  });

  describe('persistMembersOnlyAvailability', () => {
    beforeEach(() => {
      ChannelVideo.update.mockClear();
      ChannelVideo.update.mockResolvedValue([1]);
    });

    it('should update channelvideos with subscriber_only when youtubeId provided', async () => {
      await executor.persistMembersOnlyAvailability('abc12345678');

      expect(ChannelVideo.update).toHaveBeenCalledWith(
        { availability: 'subscriber_only' },
        { where: { youtube_id: 'abc12345678' } },
      );
    });

    it('should be a no-op when youtubeId is null', async () => {
      await executor.persistMembersOnlyAvailability(null);
      await executor.persistMembersOnlyAvailability(undefined);
      await executor.persistMembersOnlyAvailability('');

      expect(ChannelVideo.update).not.toHaveBeenCalled();
    });

    it('should swallow update errors and log a warning', async () => {
      const dbErr = new Error('db down');
      ChannelVideo.update.mockRejectedValueOnce(dbErr);

      // Must not throw
      await expect(executor.persistMembersOnlyAvailability('errvid1')).resolves.toBeUndefined();

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ youtubeId: 'errvid1' }),
        'Failed to persist subscriber_only availability after download error',
      );
    });
  });

  describe('doDownload - throttling integration', () => {
    const mockArgs = ['--format', 'best', 'https://youtube.com/watch?v=test'];
    const mockJobId = 'job-123';
    const mockJobType = 'Channel Downloads';

    it('should use throttled emission for rapid progress updates', async () => {
      const downloadPromise = executor.doDownload(mockArgs, mockJobId, mockJobType);

      // Emit rapid progress updates within same tick
      mockProcess.stdout.emit('data', '{"percent":"10.0%","downloaded":"1048576","total":"10485760"}\n');
      mockProcess.stdout.emit('data', '{"percent":"20.0%","downloaded":"2097152","total":"10485760"}\n');
      mockProcess.stdout.emit('data', '{"percent":"30.0%","downloaded":"3145728","total":"10485760"}\n');

      // Important message should go through immediately
      mockProcess.stdout.emit('data', '[download] Destination: /output/video.mp4\n');

      // Complete the download
      setTimeout(() => {
        mockProcess.emit('exit', 0, null);
      }, 10);

      await downloadPromise;

      // Should have fewer emits than lines due to throttling
      // Initial message + important message + at most 1 throttled progress
      const emitCalls = MessageEmitter.emitMessage.mock.calls.filter(
        call => call[2] === 'download' && call[3] === 'downloadProgress'
      );
      // We should have: initial, 1 progress (first goes through), destination (important), final summary
      // The rapid progress updates (2nd and 3rd) should be throttled/pending
      expect(emitCalls.length).toBeLessThan(10); // Less than if all were emitted
    });

    it('should flush the pending throttled progress message on job exit', async () => {
      const downloadPromise = executor.doDownload(mockArgs, mockJobId, mockJobType);

      // Let the async preflight finish so the stream handlers are attached
      await new Promise(resolve => setTimeout(resolve, 5));

      // First progress message emits immediately (state change)
      mockProcess.stdout.emit('data', '{"percent":"25.0%","downloaded":"2621440","total":"10485760"}\n');

      // Second progress message within 250ms gets throttled to pending
      mockProcess.stdout.emit('data', '{"percent":"50.0%","downloaded":"5242880","total":"10485760"}\n');

      // Exit the process
      setTimeout(() => {
        mockProcess.emit('exit', 0, null);
      }, 10);

      await downloadPromise;

      // The pending message must have been flushed during exit handling, not dropped
      const texts = MessageEmitter.emitMessage.mock.calls
        .map(call => call[4] && call[4].text)
        .filter(Boolean);
      expect(texts).toContain('{"percent":"50.0%","downloaded":"5242880","total":"10485760"}');
    });

    it('should flush the pending throttled progress message on job error', async () => {
      const downloadPromise = executor.doDownload(mockArgs, mockJobId, mockJobType);

      // Let the async preflight finish so the stream handlers are attached
      await new Promise(resolve => setTimeout(resolve, 5));

      // First progress message emits immediately (state change)
      mockProcess.stdout.emit('data', '{"percent":"25.0%","downloaded":"2621440","total":"10485760"}\n');

      // Second progress message within 250ms gets throttled to pending
      mockProcess.stdout.emit('data', '{"percent":"50.0%","downloaded":"5242880","total":"10485760"}\n');

      // Emit error
      setTimeout(() => {
        mockProcess.emit('error', new Error('Process error'));
      }, 10);

      await downloadPromise;

      // The pending message must have been flushed during error handling, not dropped
      const texts = MessageEmitter.emitMessage.mock.calls
        .map(call => call[4] && call[4].text)
        .filter(Boolean);
      expect(texts).toContain('{"percent":"50.0%","downloaded":"5242880","total":"10485760"}');
    });
  });

  describe('doDownload timeout handling', () => {
    const mockArgs = ['--format', 'best', 'https://youtube.com/watch?v=test'];
    const mockJobId = 'job-123';
    const mockJobType = 'Channel Downloads';

    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    });

    it('sends SIGTERM after 30 minutes of no activity', async () => {
      const downloadPromise = executor.doDownload(mockArgs, mockJobId, mockJobType);
      // Let the pre-spawn awaits (cleanTempDirectory, health check) settle
      await jest.advanceTimersByTimeAsync(0);
      expect(mockSpawn).toHaveBeenCalled();

      await jest.advanceTimersByTimeAsync(31 * 60 * 1000);
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');

      // Process exits during grace period -> job is Terminated with timeout note
      mockProcess.exitCode = null;
      mockProcess.signalCode = 'SIGTERM';
      mockProcess.emit('exit', null, 'SIGTERM');
      await jest.advanceTimersByTimeAsync(0);
      await downloadPromise;

      const updateCall = jobModule.updateJob.mock.calls.find(
        (c) => c[1].status === 'Terminated'
      );
      expect(updateCall).toBeDefined();
      expect(updateCall[1].notes).toMatch(/No download activity for \d+ minutes/);
    });

    it('escalates to SIGKILL when grace period expires', async () => {
      executor.doDownload(mockArgs, mockJobId, mockJobType).catch(() => {});
      await jest.advanceTimersByTimeAsync(0);

      await jest.advanceTimersByTimeAsync(31 * 60 * 1000);
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');

      // Still running after 60s grace
      mockProcess.exitCode = null;
      mockProcess.signalCode = null;
      await jest.advanceTimersByTimeAsync(60 * 1000);
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGKILL');
    });

    it('post-processing output extends the inactivity timeout to 60 minutes', async () => {
      executor.doDownload(mockArgs, mockJobId, mockJobType).catch(() => {});
      await jest.advanceTimersByTimeAsync(0);

      // 25 min idle, then a Merger line resets the clock and extends to 60 min
      await jest.advanceTimersByTimeAsync(25 * 60 * 1000);
      mockProcess.stdout.emit('data', Buffer.from('[Merger] Merging formats\n'));

      // 45 more minutes: would have fired under the 30-min rule, must not fire now
      await jest.advanceTimersByTimeAsync(45 * 60 * 1000);
      expect(mockProcess.kill).not.toHaveBeenCalled();

      // 20 more minutes (65 since last activity) -> fires
      await jest.advanceTimersByTimeAsync(20 * 60 * 1000);
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
    });

    it('download activity resets the extended timeout back to 30 minutes', async () => {
      executor.doDownload(mockArgs, mockJobId, mockJobType).catch(() => {});
      await jest.advanceTimersByTimeAsync(0);

      mockProcess.stdout.emit('data', Buffer.from('[Merger] Merging formats\n'));
      mockProcess.stdout.emit('data', Buffer.from('[download]   1.0% of 100MiB\n'));

      await jest.advanceTimersByTimeAsync(31 * 60 * 1000);
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
    });

    it('enforces the 6-hour absolute runtime cap despite ongoing activity', async () => {
      const downloadPromise = executor.doDownload(mockArgs, mockJobId, mockJobType);
      await jest.advanceTimersByTimeAsync(0);

      // Keep emitting activity every 10 minutes for 6+ hours
      for (let i = 0; i < 37; i++) {
        mockProcess.stdout.emit('data', Buffer.from('[download]   1.0% of 100MiB\n'));
        await jest.advanceTimersByTimeAsync(10 * 60 * 1000);
      }
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');

      // Exit during the grace period and confirm the absolute cap (not the
      // inactivity timeout) is what fired
      mockProcess.exitCode = null;
      mockProcess.signalCode = 'SIGTERM';
      mockProcess.emit('exit', null, 'SIGTERM');
      await jest.advanceTimersByTimeAsync(0);
      await downloadPromise;

      const updateCall = jobModule.updateJob.mock.calls.find(
        (c) => c[1].status === 'Terminated'
      );
      expect(updateCall).toBeDefined();
      expect(updateCall[1].notes).toMatch(/Maximum runtime limit/);
    });
  });
});
