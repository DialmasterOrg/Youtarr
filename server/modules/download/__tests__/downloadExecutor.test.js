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
  startNextJob: jest.fn()
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

const DownloadExecutor = require('../downloadExecutor');
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
      youtubeOutputDirectory: '/mock/output'
    });

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
      expect(executor.maxAbsoluteTimeoutMs).toBe(4 * 60 * 60 * 1000);
      expect(executor.currentProcess).toBeNull();
      expect(executor.currentJobId).toBeNull();
      expect(executor.manualTerminationReason).toBeNull();
      expect(executor.forceKillTimeout).toBeNull();
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

  describe('isMainVideoFile', () => {
    it('should identify main video files with mp4 extension', () => {
      expect(executor.isMainVideoFile('/path/Channel - Title [abc123XYZ_].mp4')).toBe(true);
    });

    it('should identify main video files with mkv extension', () => {
      expect(executor.isMainVideoFile('/path/Channel - Title [abc123XYZ_].mkv')).toBe(true);
    });

    it('should identify main video files with webm extension', () => {
      expect(executor.isMainVideoFile('/path/Channel - Title [abc123XYZ_].webm')).toBe(true);
    });

    it('should reject fragment files', () => {
      expect(executor.isMainVideoFile('/path/Channel - Title.f137.mp4')).toBe(false);
    });

    it('should reject audio fragment files', () => {
      expect(executor.isMainVideoFile('/path/Channel - Title.f140.m4a')).toBe(false);
    });

    it('should reject files without video ID', () => {
      expect(executor.isMainVideoFile('/path/video.mp4')).toBe(false);
    });

    it('should reject files with too short video IDs', () => {
      expect(executor.isMainVideoFile('/path/Channel - Title [abc].mp4')).toBe(false);
    });
  });

  describe('isVideoSpecificDirectory', () => {
    it('should identify valid video directory', () => {
      expect(executor.isVideoSpecificDirectory('/path/Channel - Video Title - abc123XYZ_d')).toBe(true);
    });

    it('should reject directory with insufficient segments', () => {
      expect(executor.isVideoSpecificDirectory('/path/Channel - Title')).toBe(false);
    });

    it('should reject directory with invalid video ID', () => {
      expect(executor.isVideoSpecificDirectory('/path/Channel - Title - abc')).toBe(false);
    });

    it('should accept video IDs between 10-12 characters', () => {
      expect(executor.isVideoSpecificDirectory('/path/Ch - Title - 1234567890')).toBe(true);
      expect(executor.isVideoSpecificDirectory('/path/Ch - Title - 12345678901')).toBe(true);
      expect(executor.isVideoSpecificDirectory('/path/Ch - Title - 123456789012')).toBe(true);
    });

    it('should reject video IDs with too few characters', () => {
      expect(executor.isVideoSpecificDirectory('/path/Ch - Title - 123456789')).toBe(false);
    });

    it('should handle errors gracefully', () => {
      const originalBasename = require('path').basename;
      require('path').basename = jest.fn(() => {
        throw new Error('Path error');
      });

      expect(executor.isVideoSpecificDirectory('/invalid')).toBe(false);

      require('path').basename = originalBasename;
    });
  });

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
        { youtubeId: 'abc123', filePath: '/output/video.mp4' }
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
        { youtubeId: 'abc123XYZ_d', filePath: '/output/video.mp4' }
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
        { youtubeId: 'abc123XYZ_d', filePath: '/output/video.mp4' }
      ]);
      archiveModule.getNewVideoUrlsSince.mockReturnValue(['https://youtu.be/abc123XYZ_d']);

      setTimeout(() => {
        mockProcess.emit('exit', 0, null);
      }, 10);

      await executor.doDownload(mockArgs, mockJobId, mockJobType);

      expect(notificationModule.sendDownloadNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          finalSummary: expect.any(Object),
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
        { youtubeId: 'abc123', channel_id: 'UC123', filePath: '/output/video.mp4' }
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
        { youtubeId: 'abc123', channel_id: 'UC123', filePath: '/output/video.mp4' }
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
      expect(executor.maxAbsoluteTimeoutMs).toBe(4 * 60 * 60 * 1000); // 4 hours
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
});
