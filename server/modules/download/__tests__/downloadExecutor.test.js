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
  rmdir: jest.fn()
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
  getConfig: jest.fn()
}));

jest.mock('../../plexModule', () => ({
  refreshLibrary: jest.fn().mockResolvedValue()
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
  addVideoToArchive: jest.fn().mockResolvedValue()
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
  findAll: jest.fn().mockResolvedValue([])
}));

// Mock filesystem module
jest.mock('../../filesystem', () => ({
  isMainVideoFile: jest.fn(),
  isVideoDirectory: jest.fn(),
  isChannelDirectory: jest.fn(),
  isDirectoryEmpty: jest.fn()
}));

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
      // Throttling state
      expect(executor.lastProgressEmitTime).toBe(0);
      expect(executor.pendingProgressMessage).toBeNull();
      expect(executor.progressFlushTimer).toBeNull();
      expect(executor.lastEmittedProgressState).toBeNull();
      expect(executor.PROGRESS_THROTTLE_MS).toBe(250);
    });
  });

  describe('getCountOfDownloadedVideos', () => {
    it('should return count from archive module', () => {
      archiveModule.readCompleteListLines.mockReturnValue(['video1', 'video2', 'video3']);
      expect(executor.getCountOfDownloadedVideos()).toBe(3);
    });

    it('should return 0 for empty archive', () => {
      archiveModule.readCompleteListLines.mockReturnValue([]);
      expect(executor.getCountOfDownloadedVideos()).toBe(0);
    });
  });

  describe('getNewVideoUrls', () => {
    it('should return new video URLs from archive module', () => {
      const mockUrls = ['https://youtu.be/abc123', 'https://youtu.be/def456'];
      archiveModule.getNewVideoUrlsSince.mockReturnValue(mockUrls);

      const result = executor.getNewVideoUrls(5);

      expect(archiveModule.getNewVideoUrlsSince).toHaveBeenCalledWith(5);
      expect(result).toEqual(mockUrls);
    });
  });

  describe('extractYoutubeIdFromPath', () => {
    it('should extract ID from bracket notation', () => {
      const path = '/path/to/Channel - Video Title [abc123XYZ_d].mp4';
      expect(executor.extractYoutubeIdFromPath(path)).toBe('abc123XYZ_d');
    });

    it('should extract ID from directory name with dash', () => {
      const path = '/path/to/Channel - Video Title - abc123XYZ_d/video.mp4';
      expect(executor.extractYoutubeIdFromPath(path)).toBe('abc123XYZ_d');
    });

    it('should return null for invalid paths', () => {
      expect(executor.extractYoutubeIdFromPath('/path/without/id.mp4')).toBeNull();
    });

    it('should handle extraction errors gracefully', () => {
      expect(executor.extractYoutubeIdFromPath('')).toBeNull();
    });

    it('should require 10-12 character IDs', () => {
      // Too short
      expect(executor.extractYoutubeIdFromPath('/path/[abc].mp4')).toBeNull();
      // Valid length
      expect(executor.extractYoutubeIdFromPath('/path/[abc1234567].mp4')).toBe('abc1234567');
    });
  });

  // NOTE: isMainVideoFile, isVideoDirectory (previously isVideoSpecificDirectory),
  // isChannelDirectory, and isDirectoryEmpty tests have been moved to
  // server/modules/filesystem/__tests__/directoryManager.test.js

  describe('cleanupInProgressVideos', () => {
    beforeEach(() => {
      // Reset all fs.promises mocks to default resolved values
      mockFsPromises.access.mockResolvedValue();
      mockFsPromises.readdir.mockResolvedValue([]);
      mockFsPromises.stat.mockResolvedValue({ isFile: () => true, isDirectory: () => false });
      mockFsPromises.unlink.mockResolvedValue();
      mockFsPromises.rm.mockResolvedValue();
      mockFsPromises.rmdir.mockResolvedValue();
    });

    it('should handle no in-progress videos', async () => {
      JobVideoDownload.findAll.mockResolvedValue([]);

      await executor.cleanupInProgressVideos('job-123');

      expect(logger.info).toHaveBeenCalledWith('No in-progress videos to clean up');
    });

    it('should cleanup video directory and database entry', async () => {
      const mockVideoDownload = {
        youtube_id: 'abc123XYZ_d',
        file_path: '/output/Channel - Title - abc123XYZ_d',
        destroy: jest.fn().mockResolvedValue()
      };

      JobVideoDownload.findAll.mockResolvedValue([mockVideoDownload]);
      mockFsPromises.access.mockResolvedValue(); // Directory exists
      mockFsPromises.readdir.mockResolvedValue(['video.mp4', 'poster.jpg']);

      await executor.cleanupInProgressVideos('job-123');

      expect(mockFsPromises.readdir).toHaveBeenCalledWith('/output/Channel - Title - abc123XYZ_d');
      expect(mockFsPromises.unlink).toHaveBeenCalledTimes(2);
      expect(mockFsPromises.rmdir).toHaveBeenCalledWith('/output/Channel - Title - abc123XYZ_d');
      expect(mockVideoDownload.destroy).toHaveBeenCalled();
    });

    it('should skip non-video directories', async () => {
      const mockVideoDownload = {
        youtube_id: 'abc123XYZ_d',
        file_path: '/output/Channel',
        destroy: jest.fn().mockResolvedValue()
      };

      JobVideoDownload.findAll.mockResolvedValue([mockVideoDownload]);
      mockFsPromises.access.mockResolvedValue(); // Directory exists
      // Mock filesystem.isVideoDirectory to return false for this path
      filesystem.isVideoDirectory.mockReturnValue(false);

      await executor.cleanupInProgressVideos('job-123');

      expect(logger.info).toHaveBeenCalledWith({ dirPath: '/output/Channel' }, 'Skipping non-video directory');
      expect(mockFsPromises.rmdir).not.toHaveBeenCalled();
      // Should still destroy the entry since cleanup was attempted
      expect(mockVideoDownload.destroy).not.toHaveBeenCalled();
    });

    it('should check temp location when temp downloads enabled', async () => {
      tempPathManager.isEnabled.mockReturnValue(true);
      tempPathManager.convertFinalToTemp.mockReturnValue('/tmp/Channel - Title - abc123XYZ_d');

      const mockVideoDownload = {
        youtube_id: 'abc123XYZ_d',
        file_path: '/output/Channel - Title - abc123XYZ_d',
        destroy: jest.fn().mockResolvedValue()
      };

      JobVideoDownload.findAll.mockResolvedValue([mockVideoDownload]);
      mockFsPromises.access.mockResolvedValue(); // Both paths exist
      mockFsPromises.readdir.mockResolvedValue([]);

      await executor.cleanupInProgressVideos('job-123');

      expect(mockFsPromises.access).toHaveBeenCalledWith('/output/Channel - Title - abc123XYZ_d');
      expect(mockFsPromises.access).toHaveBeenCalledWith('/tmp/Channel - Title - abc123XYZ_d');
    });

    it('should handle file removal errors gracefully', async () => {
      const mockVideoDownload = {
        youtube_id: 'abc123XYZ_d',
        file_path: '/output/Channel - Title - abc123XYZ_d',
        destroy: jest.fn().mockResolvedValue()
      };

      JobVideoDownload.findAll.mockResolvedValue([mockVideoDownload]);
      mockFsPromises.access.mockResolvedValue(); // Directory exists
      mockFsPromises.readdir.mockResolvedValue(['video.mp4']);
      mockFsPromises.stat.mockResolvedValue({ isFile: () => true, isDirectory: () => false });
      mockFsPromises.unlink.mockRejectedValue(new Error('Permission denied'));

      await executor.cleanupInProgressVideos('job-123');

      expect(logger.error).toHaveBeenCalledWith(
        { err: expect.any(Error), fileName: 'video.mp4' },
        'Error removing file'
      );
    });
  });

  describe('cleanupPartialFiles', () => {
    beforeEach(() => {
      // Reset fs.promises mocks for this test suite
      mockFsPromises.access.mockResolvedValue();
      mockFsPromises.unlink.mockResolvedValue();
      mockFsPromises.readdir.mockResolvedValue([]);
    });

    it('should remove .part files', async () => {
      const files = ['/output/video.mp4'];
      // access() resolves to indicate file exists
      mockFsPromises.access
        .mockResolvedValueOnce() // .part file exists
        .mockRejectedValueOnce(); // For subsequent call in readdir error catch

      await executor.cleanupPartialFiles(files);

      expect(mockFsPromises.access).toHaveBeenCalledWith('/output/video.mp4.part');
      expect(mockFsPromises.unlink).toHaveBeenCalledWith('/output/video.mp4.part');
    });

    it('should remove fragment files', async () => {
      const path = require('path');
      const files = ['/output/Channel - Title [abc123XYZ_d].mp4'];
      mockFsPromises.access
        .mockRejectedValueOnce(new Error('Not found')); // .part doesn't exist
      mockFsPromises.readdir.mockResolvedValue([
        'Channel - Title [abc123XYZ_d].f137.mp4',
        'Channel - Title [abc123XYZ_d].f140.m4a',
        'other-file.txt'
      ]);

      await executor.cleanupPartialFiles(files);

      const dir = path.dirname(files[0]);
      expect(mockFsPromises.readdir).toHaveBeenCalledWith(dir);
      // Check that fragment files were removed
      const unlinkCalls = mockFsPromises.unlink.mock.calls;
      expect(unlinkCalls.some(call => call[0].includes('.f137.mp4'))).toBe(true);
      expect(unlinkCalls.some(call => call[0].includes('.f140.m4a'))).toBe(true);
      expect(unlinkCalls.some(call => call[0].includes('other-file.txt'))).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      const files = ['/output/video.mp4'];
      mockFsPromises.access.mockRejectedValue(new Error('Access error'));
      mockFsPromises.readdir.mockRejectedValue(new Error('Read error'));

      await executor.cleanupPartialFiles(files);

      expect(logger.error).toHaveBeenCalledWith(
        { err: expect.any(Error), dir: '/output' },
        'Error reading directory'
      );
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

    it('should trigger Plex library refresh on completion', async () => {
      setTimeout(() => {
        mockProcess.emit('exit', 0, null);
      }, 10);

      await executor.doDownload(mockArgs, mockJobId, mockJobType);

      expect(plexModule.refreshLibrary).toHaveBeenCalled();
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
      setTimeout(() => {
        mockProcess.emit('exit', 0, null);
      }, 10);

      await executor.doDownload(mockArgs, mockJobId, mockJobType, 0, null, false, false, 'TestSubfolder');

      expect(mockSpawn).toHaveBeenCalledWith('yt-dlp', mockArgs, {
        env: expect.objectContaining({
          YOUTARR_JOB_ID: mockJobId,
          YOUTARR_SUBFOLDER_OVERRIDE: 'TestSubfolder'
        })
      });
    });

    it('should pass empty string subfolderOverride to yt-dlp', async () => {
      setTimeout(() => {
        mockProcess.emit('exit', 0, null);
      }, 10);

      // Empty string means "no subfolder" (downloads to root)
      await executor.doDownload(mockArgs, mockJobId, mockJobType, 0, null, false, false, '');

      expect(mockSpawn).toHaveBeenCalledWith('yt-dlp', mockArgs, {
        env: expect.objectContaining({
          YOUTARR_JOB_ID: mockJobId,
          YOUTARR_SUBFOLDER_OVERRIDE: ''
        })
      });
    });

    it('should not set YOUTARR_SUBFOLDER_OVERRIDE when subfolderOverride is null', async () => {
      setTimeout(() => {
        mockProcess.emit('exit', 0, null);
      }, 10);

      await executor.doDownload(mockArgs, mockJobId, mockJobType, 0, null, false, false, null);

      expect(mockSpawn).toHaveBeenCalledWith('yt-dlp', mockArgs, {
        env: expect.not.objectContaining({
          YOUTARR_SUBFOLDER_OVERRIDE: expect.anything()
        })
      });
    });

    it('should not set YOUTARR_SUBFOLDER_OVERRIDE when subfolderOverride is undefined', async () => {
      setTimeout(() => {
        mockProcess.emit('exit', 0, null);
      }, 10);

      await executor.doDownload(mockArgs, mockJobId, mockJobType, 0, null, false, false, undefined);

      expect(mockSpawn).toHaveBeenCalledWith('yt-dlp', mockArgs, {
        env: expect.not.objectContaining({
          YOUTARR_SUBFOLDER_OVERRIDE: expect.anything()
        })
      });
    });

    it('should log subfolderOverride in info message', async () => {
      setTimeout(() => {
        mockProcess.emit('exit', 0, null);
      }, 10);

      await executor.doDownload(mockArgs, mockJobId, mockJobType, 0, null, false, false, 'MyFolder');

      expect(logger.info).toHaveBeenCalledWith(
        { jobType: mockJobType, args: mockArgs, subfolderOverride: 'MyFolder' },
        'Running yt-dlp'
      );
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
          error: 'Video file not found or incomplete'
        }),
        'Video download failed'
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
                error: 'Video file not found or incomplete'
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

  describe('isImportantMessage', () => {
    it('should identify download destination messages as important', () => {
      const line = '[download] Destination: /output/Channel - Title [abc123].mp4';
      expect(executor.isImportantMessage(line, null)).toBe(true);
    });

    it('should identify merger messages as important', () => {
      const line = '[Merger] Merging formats into "output.mp4"';
      expect(executor.isImportantMessage(line, null)).toBe(true);
    });

    it('should identify move files messages as important', () => {
      const line = '[MoveFiles] Moving file from temp to final location';
      expect(executor.isImportantMessage(line, null)).toBe(true);
    });

    it('should identify metadata messages as important', () => {
      const line = '[Metadata] Adding metadata to file';
      expect(executor.isImportantMessage(line, null)).toBe(true);
    });

    it('should identify extract audio messages as important', () => {
      const line = '[ExtractAudio] Extracting audio from video';
      expect(executor.isImportantMessage(line, null)).toBe(true);
    });

    it('should identify completion messages as important', () => {
      const line = '[download] 100% of 10.00MiB';
      expect(executor.isImportantMessage(line, null)).toBe(true);
    });

    it('should identify new item download messages as important', () => {
      const line = '[download] Downloading item 5 of 10';
      expect(executor.isImportantMessage(line, null)).toBe(true);
    });

    it('should identify already archived messages as important', () => {
      const line = '[download] Video abc123 has already been recorded in the archive';
      expect(executor.isImportantMessage(line, null)).toBe(true);
    });

    it('should identify filter skip messages as important', () => {
      const line = '[download] Video does not pass filter (subscribers only)';
      expect(executor.isImportantMessage(line, null)).toBe(true);
    });

    it('should identify error messages as important', () => {
      const line = 'ERROR: Unable to download video';
      expect(executor.isImportantMessage(line, null)).toBe(true);
    });

    it('should identify warning messages as important', () => {
      const line = 'WARNING: Video format may not be supported';
      expect(executor.isImportantMessage(line, null)).toBe(true);
    });

    it('should identify HTTP 403 errors as important', () => {
      expect(executor.isImportantMessage('HTTP Error 403: Forbidden', null)).toBe(true);
      expect(executor.isImportantMessage('Server returned 403: Forbidden', null)).toBe(true);
    });

    it('should identify bot detection messages as important', () => {
      const line = 'Sign in to confirm you\'re not a bot';
      expect(executor.isImportantMessage(line, null)).toBe(true);
    });

    it('should identify state changes as important', () => {
      executor.lastEmittedProgressState = 'downloading_video';
      const progress = { state: 'merging' };
      expect(executor.isImportantMessage('[download] Some progress', progress)).toBe(true);
    });

    it('should not mark regular progress messages as important', () => {
      executor.lastEmittedProgressState = 'downloading_video';
      const progress = { state: 'downloading_video' };
      const line = '{"percent":"50.0%","downloaded":"5242880","total":"10485760"}';
      expect(executor.isImportantMessage(line, progress)).toBe(false);
    });

    it('should not mark empty lines as important', () => {
      expect(executor.isImportantMessage('', null)).toBe(false);
    });
  });

  describe('emitProgressMessage', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.clearAllMocks();
    });

    afterEach(() => {
      if (executor.progressFlushTimer) {
        clearTimeout(executor.progressFlushTimer);
        executor.progressFlushTimer = null;
      }
      jest.useRealTimers();
    });

    it('should emit important messages immediately', () => {
      const line = '[download] Destination: /output/video.mp4';
      const progress = { state: 'downloading_video' };

      executor.emitProgressMessage(line, progress);

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
      // Set up a pending message
      executor.pendingProgressMessage = { text: 'pending', progress: null };
      executor.progressFlushTimer = setTimeout(() => {}, 1000);

      const line = '[download] Destination: /output/video.mp4';
      executor.emitProgressMessage(line, null);

      expect(executor.pendingProgressMessage).toBeNull();
      expect(executor.progressFlushTimer).toBeNull();
    });

    it('should throttle progress messages to 250ms intervals', () => {
      // First message should go through immediately
      executor.emitProgressMessage('Progress 1', { state: 'downloading_video' });
      expect(MessageEmitter.emitMessage).toHaveBeenCalledTimes(1);

      // Second message within 250ms should be pending
      jest.advanceTimersByTime(100);
      executor.emitProgressMessage('Progress 2', { state: 'downloading_video' });
      expect(MessageEmitter.emitMessage).toHaveBeenCalledTimes(1); // Still only 1

      // Third message should update pending
      jest.advanceTimersByTime(50);
      executor.emitProgressMessage('Progress 3', { state: 'downloading_video' });
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
      executor.emitProgressMessage('Progress 1', null);
      expect(MessageEmitter.emitMessage).toHaveBeenCalledTimes(1);

      // Wait 250ms
      jest.advanceTimersByTime(250);

      // Next message should go through immediately
      executor.emitProgressMessage('Progress 2', null);
      expect(MessageEmitter.emitMessage).toHaveBeenCalledTimes(2);
    });

    it('should update lastEmittedProgressState when state changes', () => {
      const progress = { state: 'downloading_video' };
      executor.emitProgressMessage('[download] Destination: /output/video.mp4', progress);

      expect(executor.lastEmittedProgressState).toBe('downloading_video');
    });

    it('should only create one flush timer for multiple rapid messages', () => {
      executor.emitProgressMessage('Progress 1', null);
      executor.emitProgressMessage('Progress 2', null);
      executor.emitProgressMessage('Progress 3', null);

      // Only one timer should exist
      expect(executor.progressFlushTimer).not.toBeNull();

      // Fast forward past throttle time
      jest.advanceTimersByTime(250);

      // Timer should be cleared
      expect(executor.progressFlushTimer).toBeNull();
    });

    it('should handle null progress gracefully', () => {
      executor.emitProgressMessage('Some message', null);

      expect(MessageEmitter.emitMessage).toHaveBeenCalledWith(
        'broadcast',
        null,
        'download',
        'downloadProgress',
        { text: 'Some message', progress: null }
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

    it('should clear pending progress timer on job exit', async () => {
      const downloadPromise = executor.doDownload(mockArgs, mockJobId, mockJobType);

      // Emit initial progress to set lastProgressEmitTime
      mockProcess.stdout.emit('data', '{"percent":"25.0%","downloaded":"2621440","total":"10485760"}\n');

      // Send another progress message that should get throttled (within 250ms of first)
      mockProcess.stdout.emit('data', '{"percent":"50.0%","downloaded":"5242880","total":"10485760"}\n');

      // Give time for timer to be set
      await new Promise(resolve => setTimeout(resolve, 5));

      // Timer should exist if throttling occurred
      const timerExisted = executor.progressFlushTimer !== null;

      // Exit the process
      setTimeout(() => {
        mockProcess.emit('exit', 0, null);
      }, 10);

      await downloadPromise;

      // Timer should be cleared (whether it existed or not)
      expect(executor.progressFlushTimer).toBeNull();
      expect(executor.pendingProgressMessage).toBeNull();

      // If throttling occurred, verify cleanup happened
      if (timerExisted) {
        expect(executor.progressFlushTimer).toBeNull();
      }
    });

    it('should clear pending progress timer on job error', async () => {
      const downloadPromise = executor.doDownload(mockArgs, mockJobId, mockJobType);

      // Emit initial progress
      mockProcess.stdout.emit('data', '{"percent":"25.0%","downloaded":"2621440","total":"10485760"}\n');

      // Send another progress message that should get throttled
      mockProcess.stdout.emit('data', '{"percent":"50.0%","downloaded":"5242880","total":"10485760"}\n');

      // Give time for timer to be set
      await new Promise(resolve => setTimeout(resolve, 5));

      // Emit error
      setTimeout(() => {
        mockProcess.emit('error', new Error('Process error'));
      }, 10);

      await downloadPromise;

      // Timer should be cleared
      expect(executor.progressFlushTimer).toBeNull();
      expect(executor.pendingProgressMessage).toBeNull();
    });
  });
});
