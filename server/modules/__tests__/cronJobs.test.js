/* eslint-env jest */

describe('CronJobs', () => {
  let cronJobs;
  let mockSchedule;
  let mockDb;
  let mockVideosModule;
  let mockVideoDeletionModule;
  let mockLogger;
  let mockYtdlpModule;
  let mockConfigModule;
  let mockConfigStore;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    // Mock node-cron
    mockSchedule = {
      schedule: jest.fn()
    };

    jest.doMock('node-cron', () => mockSchedule);

    // Mock logger
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn()
    };

    jest.doMock('../../logger', () => mockLogger);

    // Mock database
    mockDb = {
      Session: {
        destroy: jest.fn()
      },
      Sequelize: {
        Op: {
          or: Symbol('or'),
          lt: Symbol('lt')
        }
      }
    };

    jest.doMock('../../db', () => mockDb);

    // Mock videosModule
    mockVideosModule = {
      backfillVideoMetadata: jest.fn()
    };

    jest.doMock('../videosModule', () => mockVideosModule);

    // Mock videoDeletionModule
    mockVideoDeletionModule = {
      performAutomaticCleanup: jest.fn(),
      cleanupOrphanDirectories: jest.fn().mockResolvedValue({ removed: [], errors: [] })
    };

    jest.doMock('../videoDeletionModule', () => mockVideoDeletionModule);

    // Mock notificationModule to prevent real notifications during tests
    jest.doMock('../notificationModule', () => ({
      sendAutoRemovalNotification: jest.fn().mockResolvedValue(undefined)
    }));

    // Mock ytdlpModule
    mockYtdlpModule = {
      performUpdate: jest.fn()
    };
    jest.doMock('../ytdlpModule', () => mockYtdlpModule);

    // Mock configModule with a tiny in-memory store so the auto-update job can read/write
    mockConfigStore = { autoUpdateYtdlp: false };
    mockConfigModule = {
      getConfig: jest.fn(() => mockConfigStore),
      updateConfig: jest.fn((next) => { mockConfigStore = next; }),
      isElfhostedPlatform: jest.fn(() => false)
    };
    jest.doMock('../configModule', () => mockConfigModule);

    // Require the module after mocks are in place
    cronJobs = require('../cronJobs');
  });

  describe('module export', () => {
    test('should export initialize function', () => {
      expect(cronJobs).toBeDefined();
      expect(cronJobs.initialize).toBeDefined();
      expect(typeof cronJobs.initialize).toBe('function');
    });
  });

  describe('initialize', () => {
    test('should register all four cron jobs', () => {
      cronJobs.initialize();

      expect(mockSchedule.schedule).toHaveBeenCalledTimes(4);
      expect(mockSchedule.schedule).toHaveBeenCalledWith('0 2 * * *', expect.any(Function));
      expect(mockSchedule.schedule).toHaveBeenCalledWith('0 3 * * *', expect.any(Function));
      expect(mockSchedule.schedule).toHaveBeenCalledWith('30 3 * * *', expect.any(Function));
      expect(mockSchedule.schedule).toHaveBeenCalledWith('0 4 * * *', expect.any(Function));
    });

    test('should log initialization messages', () => {
      cronJobs.initialize();

      expect(mockLogger.info).toHaveBeenCalledWith('Initializing scheduled cron jobs');
      expect(mockLogger.info).toHaveBeenCalledWith('Scheduled cron jobs initialized successfully');
      expect(mockLogger.info).toHaveBeenCalledWith('  - Automatic video cleanup: 2:00 AM daily');
      expect(mockLogger.info).toHaveBeenCalledWith('  - Session cleanup: 3:00 AM daily');
      expect(mockLogger.info).toHaveBeenCalledWith('  - Video metadata backfill: 3:30 AM daily');
      expect(mockLogger.info).toHaveBeenCalledWith('  - yt-dlp auto-update: 4:00 AM daily (when enabled)');
    });
  });

  describe('automatic video cleanup cron job (2:00 AM)', () => {
    let cleanupCallback;

    beforeEach(() => {
      cronJobs.initialize();
      cleanupCallback = mockSchedule.schedule.mock.calls[0][1];
    });

    test('should call performAutomaticCleanup when triggered', async () => {
      mockVideoDeletionModule.performAutomaticCleanup.mockResolvedValue({
        totalDeleted: 0,
        freedBytes: 0,
        errors: []
      });

      await cleanupCallback();

      expect(mockVideoDeletionModule.performAutomaticCleanup).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Running automatic video cleanup cron job');
    });

    test('should log success when videos are deleted', async () => {
      mockVideoDeletionModule.performAutomaticCleanup.mockResolvedValue({
        totalDeleted: 5,
        freedBytes: 1073741824,
        errors: []
      });

      await cleanupCallback();

      expect(mockLogger.info).toHaveBeenCalledWith(
        {
          totalDeleted: 5,
          freedGB: '1.00'
        },
        'Automatic cleanup completed successfully'
      );
    });

    test('should log message when no videos are deleted', async () => {
      mockVideoDeletionModule.performAutomaticCleanup.mockResolvedValue({
        totalDeleted: 0,
        freedBytes: 0,
        errors: []
      });

      await cleanupCallback();

      expect(mockLogger.info).toHaveBeenCalledWith('Automatic cleanup completed: no videos deleted');
    });

    test('should log warning when errors occur during cleanup', async () => {
      mockVideoDeletionModule.performAutomaticCleanup.mockResolvedValue({
        totalDeleted: 3,
        freedBytes: 500000000,
        errors: ['Error 1', 'Error 2']
      });

      await cleanupCallback();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        { errorCount: 2 },
        'Automatic cleanup completed with errors'
      );
    });

    test('should handle errors thrown by performAutomaticCleanup', async () => {
      const testError = new Error('Cleanup failed');
      mockVideoDeletionModule.performAutomaticCleanup.mockRejectedValue(testError);

      await cleanupCallback();

      expect(mockLogger.error).toHaveBeenCalledWith({ err: testError }, 'Error during automatic video cleanup');
    });

    test('should format GB correctly with multiple decimal places', async () => {
      mockVideoDeletionModule.performAutomaticCleanup.mockResolvedValue({
        totalDeleted: 10,
        freedBytes: 5368709120,
        errors: []
      });

      await cleanupCallback();

      expect(mockLogger.info).toHaveBeenCalledWith(
        {
          totalDeleted: 10,
          freedGB: '5.00'
        },
        'Automatic cleanup completed successfully'
      );
    });
  });

  describe('session cleanup cron job (3:00 AM)', () => {
    let sessionCleanupCallback;

    beforeEach(() => {
      cronJobs.initialize();
      sessionCleanupCallback = mockSchedule.schedule.mock.calls[1][1];
    });

    test('should destroy expired and inactive sessions', async () => {
      mockDb.Session.destroy.mockResolvedValue(5);

      await sessionCleanupCallback();

      expect(mockDb.Session.destroy).toHaveBeenCalledWith({
        where: {
          [mockDb.Sequelize.Op.or]: [
            {
              expires_at: {
                [mockDb.Sequelize.Op.lt]: expect.any(Date)
              }
            },
            {
              is_active: false,
              updatedAt: {
                [mockDb.Sequelize.Op.lt]: expect.any(Date)
              }
            }
          ]
        }
      });

      expect(mockLogger.info).toHaveBeenCalledWith({ removed: 5 }, 'Removed expired sessions');
    });

    test('should log when no sessions are removed', async () => {
      mockDb.Session.destroy.mockResolvedValue(0);

      await sessionCleanupCallback();

      expect(mockLogger.info).toHaveBeenCalledWith({ removed: 0 }, 'Removed expired sessions');
    });

    test('should handle errors during session cleanup', async () => {
      const testError = new Error('Database error');
      mockDb.Session.destroy.mockRejectedValue(testError);

      await sessionCleanupCallback();

      expect(mockLogger.error).toHaveBeenCalledWith({ err: testError }, 'Error cleaning sessions');
    });

    test('should use correct date for inactive session threshold (30 days)', async () => {
      mockDb.Session.destroy.mockResolvedValue(0);

      await sessionCleanupCallback();

      const callArgs = mockDb.Session.destroy.mock.calls[0][0];
      const inactiveCondition = callArgs.where[mockDb.Sequelize.Op.or][1];
      const thresholdDate = inactiveCondition.updatedAt[mockDb.Sequelize.Op.lt];

      const now = new Date();
      const expectedDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      expect(thresholdDate.getTime()).toBeGreaterThanOrEqual(expectedDate.getTime() - 1000);
      expect(thresholdDate.getTime()).toBeLessThanOrEqual(expectedDate.getTime() + 1000);
    });
  });

  describe('video metadata backfill cron job (3:30 AM)', () => {
    let backfillCallback;

    beforeEach(() => {
      cronJobs.initialize();
      backfillCallback = mockSchedule.schedule.mock.calls[2][1];
    });

    test('should call backfillVideoMetadata when triggered', async () => {
      const resolvedPromise = Promise.resolve({ timedOut: false });
      mockVideosModule.backfillVideoMetadata.mockReturnValue(resolvedPromise);

      await backfillCallback();

      await resolvedPromise;

      expect(mockVideosModule.backfillVideoMetadata).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Starting scheduled video metadata backfill');
    });

    test('should log success when backfill completes without timeout', async () => {
      const resolvedPromise = Promise.resolve({ timedOut: false });
      mockVideosModule.backfillVideoMetadata.mockReturnValue(resolvedPromise);

      await backfillCallback();

      await resolvedPromise;

      expect(mockLogger.info).toHaveBeenCalledWith('Video metadata backfill completed successfully');
    });

    test('should log message when backfill times out', async () => {
      const resolvedPromise = Promise.resolve({ timedOut: true });
      mockVideosModule.backfillVideoMetadata.mockReturnValue(resolvedPromise);

      await backfillCallback();

      await resolvedPromise;

      expect(mockLogger.info).toHaveBeenCalledWith('Video metadata backfill reached time limit, will continue tomorrow');
    });

    test('should handle errors during backfill', async () => {
      const testError = new Error('Backfill failed');
      const rejectedPromise = Promise.reject(testError);
      mockVideosModule.backfillVideoMetadata.mockReturnValue(rejectedPromise);

      await backfillCallback();

      await new Promise(resolve => setImmediate(resolve));

      expect(mockLogger.error).toHaveBeenCalledWith({ err: testError }, 'Video metadata backfill failed');
    });

    test('should handle synchronous errors in backfillVideoMetadata', async () => {
      const testError = new Error('Sync error');
      mockVideosModule.backfillVideoMetadata.mockImplementation(() => {
        throw testError;
      });

      await backfillCallback();

      expect(mockLogger.error).toHaveBeenCalledWith({ err: testError }, 'Error starting video metadata backfill');
    });

    test('should handle null result from backfill', async () => {
      const resolvedPromise = Promise.resolve(null);
      mockVideosModule.backfillVideoMetadata.mockReturnValue(resolvedPromise);

      await backfillCallback();

      await resolvedPromise;

      expect(mockLogger.info).toHaveBeenCalledWith('Video metadata backfill completed successfully');
    });

    test('should handle result without timedOut property', async () => {
      const resolvedPromise = Promise.resolve({ processed: 100 });
      mockVideosModule.backfillVideoMetadata.mockReturnValue(resolvedPromise);

      await backfillCallback();

      await resolvedPromise;

      expect(mockLogger.info).toHaveBeenCalledWith('Video metadata backfill completed successfully');
    });
  });

  describe('yt-dlp auto-update cron job (4:00 AM)', () => {
    let autoUpdateCallback;
    let mockRefreshCache;

    beforeEach(() => {
      mockRefreshCache = jest.fn();
      cronJobs.initialize({ refreshYtDlpVersionCache: mockRefreshCache });
      autoUpdateCallback = mockSchedule.schedule.mock.calls[3][1];
    });

    test('does nothing when autoUpdateYtdlp is false', async () => {
      mockConfigStore = { autoUpdateYtdlp: false };

      await autoUpdateCallback();

      expect(mockYtdlpModule.performUpdate).not.toHaveBeenCalled();
      expect(mockConfigModule.updateConfig).not.toHaveBeenCalled();
      expect(mockRefreshCache).not.toHaveBeenCalled();
    });

    test('does nothing on Elfhosted even when toggle is on', async () => {
      mockConfigStore = { autoUpdateYtdlp: true };
      mockConfigModule.isElfhostedPlatform.mockReturnValue(true);

      await autoUpdateCallback();

      expect(mockYtdlpModule.performUpdate).not.toHaveBeenCalled();
      expect(mockConfigModule.updateConfig).not.toHaveBeenCalled();
      expect(mockRefreshCache).not.toHaveBeenCalled();
    });

    test('records updated result and refreshes version cache on success with new version', async () => {
      mockConfigStore = { autoUpdateYtdlp: true, otherField: 'preserved' };
      mockYtdlpModule.performUpdate.mockResolvedValue({
        success: true,
        reason: 'updated',
        message: 'Successfully updated to 2026.04.20',
        newVersion: '2026.04.20'
      });

      await autoUpdateCallback();

      expect(mockYtdlpModule.performUpdate).toHaveBeenCalled();
      expect(mockConfigModule.updateConfig).toHaveBeenCalledTimes(1);

      const writtenConfig = mockConfigModule.updateConfig.mock.calls[0][0];
      expect(writtenConfig.otherField).toBe('preserved');
      expect(writtenConfig.ytdlpLastChecked).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(writtenConfig.ytdlpLastUpdated).toBe(writtenConfig.ytdlpLastChecked);
      expect(writtenConfig.ytdlpLastResult).toEqual({ status: 'updated', version: '2026.04.20' });

      expect(mockRefreshCache).toHaveBeenCalledTimes(1);
    });

    test('records up-to-date result without setting lastUpdated when no new version', async () => {
      mockConfigStore = { autoUpdateYtdlp: true };
      mockYtdlpModule.performUpdate.mockResolvedValue({
        success: true,
        reason: 'up-to-date',
        message: 'yt-dlp is already up to date'
      });

      await autoUpdateCallback();

      const writtenConfig = mockConfigModule.updateConfig.mock.calls[0][0];
      expect(writtenConfig.ytdlpLastChecked).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(writtenConfig.ytdlpLastUpdated).toBeUndefined();
      expect(writtenConfig.ytdlpLastResult).toEqual({ status: 'up-to-date' });

      expect(mockRefreshCache).toHaveBeenCalledTimes(1);
    });

    test('records skipped result when downloads are in progress', async () => {
      mockConfigStore = { autoUpdateYtdlp: true };
      mockYtdlpModule.performUpdate.mockResolvedValue({
        success: false,
        reason: 'skipped',
        message: 'Update deferred by yt-dlp module.'
      });

      await autoUpdateCallback();

      const writtenConfig = mockConfigModule.updateConfig.mock.calls[0][0];
      expect(writtenConfig.ytdlpLastResult.status).toBe('skipped');
      expect(writtenConfig.ytdlpLastResult.message).toBe('Update deferred by yt-dlp module.');
      expect(mockRefreshCache).not.toHaveBeenCalled();
    });

    test('records error result on a real update failure', async () => {
      mockConfigStore = { autoUpdateYtdlp: true };
      mockYtdlpModule.performUpdate.mockResolvedValue({
        success: false,
        reason: 'error',
        message: 'Update failed: Permission denied. On managed platforms, yt-dlp may be updated by the platform operator.'
      });

      await autoUpdateCallback();

      const writtenConfig = mockConfigModule.updateConfig.mock.calls[0][0];
      expect(writtenConfig.ytdlpLastResult.status).toBe('error');
      expect(writtenConfig.ytdlpLastResult.message).toMatch(/Permission denied/);
      expect(mockRefreshCache).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        { message: expect.any(String) },
        'Nightly yt-dlp auto-update failed'
      );
    });

    test('swallows unexpected errors so the cron keeps running', async () => {
      mockConfigStore = { autoUpdateYtdlp: true };
      mockYtdlpModule.performUpdate.mockRejectedValue(new Error('boom'));

      await expect(autoUpdateCallback()).resolves.toBeUndefined();

      expect(mockLogger.error).toHaveBeenCalledWith(
        { err: expect.any(Error) },
        'Unexpected error in nightly yt-dlp auto-update'
      );
    });

    test('tolerates a missing refreshYtDlpVersionCache dependency', async () => {
      // Re-initialize without passing the dep to register a fresh callback
      cronJobs.initialize();
      const initialCallCount = mockSchedule.schedule.mock.calls.length;
      const callbackNoDeps = mockSchedule.schedule.mock.calls[initialCallCount - 1][1];

      mockConfigStore = { autoUpdateYtdlp: true };
      mockYtdlpModule.performUpdate.mockResolvedValue({
        success: true,
        reason: 'updated',
        message: 'Successfully updated to 2026.04.21',
        newVersion: '2026.04.21'
      });

      await expect(callbackNoDeps()).resolves.toBeUndefined();
      expect(mockConfigModule.updateConfig).toHaveBeenCalled();
    });
  });

  describe('cron schedule validation', () => {
    test('should use correct cron schedule for video cleanup (2:00 AM daily)', () => {
      cronJobs.initialize();

      const scheduleCall = mockSchedule.schedule.mock.calls.find(
        call => call[0] === '0 2 * * *'
      );

      expect(scheduleCall).toBeDefined();
    });

    test('should use correct cron schedule for session cleanup (3:00 AM daily)', () => {
      cronJobs.initialize();

      const scheduleCall = mockSchedule.schedule.mock.calls.find(
        call => call[0] === '0 3 * * *'
      );

      expect(scheduleCall).toBeDefined();
    });

    test('should use correct cron schedule for metadata backfill (3:30 AM daily)', () => {
      cronJobs.initialize();

      const scheduleCall = mockSchedule.schedule.mock.calls.find(
        call => call[0] === '30 3 * * *'
      );

      expect(scheduleCall).toBeDefined();
    });

    test('should use correct cron schedule for yt-dlp auto-update (4:00 AM daily)', () => {
      cronJobs.initialize();

      const scheduleCall = mockSchedule.schedule.mock.calls.find(
        call => call[0] === '0 4 * * *'
      );

      expect(scheduleCall).toBeDefined();
    });
  });

  describe('integration scenarios', () => {
    test('should handle all cron jobs executing successfully', async () => {
      cronJobs.initialize();

      const videoCleanupCallback = mockSchedule.schedule.mock.calls[0][1];
      const sessionCleanupCallback = mockSchedule.schedule.mock.calls[1][1];
      const backfillCallback = mockSchedule.schedule.mock.calls[2][1];

      mockVideoDeletionModule.performAutomaticCleanup.mockResolvedValue({
        totalDeleted: 2,
        freedBytes: 1000000,
        errors: []
      });

      mockDb.Session.destroy.mockResolvedValue(3);

      mockVideosModule.backfillVideoMetadata.mockResolvedValue({ timedOut: false });

      await videoCleanupCallback();
      await sessionCleanupCallback();
      await backfillCallback();

      expect(mockVideoDeletionModule.performAutomaticCleanup).toHaveBeenCalled();
      expect(mockDb.Session.destroy).toHaveBeenCalled();
      expect(mockVideosModule.backfillVideoMetadata).toHaveBeenCalled();

      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    test('should handle partial failures across cron jobs', async () => {
      cronJobs.initialize();

      const videoCleanupCallback = mockSchedule.schedule.mock.calls[0][1];
      const sessionCleanupCallback = mockSchedule.schedule.mock.calls[1][1];
      const backfillCallback = mockSchedule.schedule.mock.calls[2][1];

      mockVideoDeletionModule.performAutomaticCleanup.mockRejectedValue(new Error('Cleanup failed'));
      mockDb.Session.destroy.mockResolvedValue(5);
      mockVideosModule.backfillVideoMetadata.mockResolvedValue({ timedOut: false });

      await videoCleanupCallback();
      await sessionCleanupCallback();
      await backfillCallback();

      expect(mockLogger.error).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).toHaveBeenCalledWith(
        { err: expect.any(Error) },
        'Error during automatic video cleanup'
      );
    });

    test('should handle all cron jobs failing', async () => {
      cronJobs.initialize();

      const videoCleanupCallback = mockSchedule.schedule.mock.calls[0][1];
      const sessionCleanupCallback = mockSchedule.schedule.mock.calls[1][1];
      const backfillCallback = mockSchedule.schedule.mock.calls[2][1];

      mockVideoDeletionModule.performAutomaticCleanup.mockRejectedValue(new Error('Cleanup failed'));
      mockDb.Session.destroy.mockRejectedValue(new Error('Session cleanup failed'));
      mockVideosModule.backfillVideoMetadata.mockRejectedValue(new Error('Backfill failed'));

      await videoCleanupCallback();
      await sessionCleanupCallback();
      await backfillCallback();

      await new Promise(resolve => setImmediate(resolve));

      expect(mockLogger.error).toHaveBeenCalledTimes(3);
    });
  });

  describe('error handling edge cases', () => {
    test('should handle undefined result from performAutomaticCleanup gracefully', async () => {
      cronJobs.initialize();
      const cleanupCallback = mockSchedule.schedule.mock.calls[0][1];

      mockVideoDeletionModule.performAutomaticCleanup.mockResolvedValue(undefined);

      await cleanupCallback();

      expect(mockLogger.error).toHaveBeenCalledWith(
        { err: expect.any(TypeError) },
        'Error during automatic video cleanup'
      );
    });

    test('should handle result with missing properties from performAutomaticCleanup gracefully', async () => {
      cronJobs.initialize();
      const cleanupCallback = mockSchedule.schedule.mock.calls[0][1];

      mockVideoDeletionModule.performAutomaticCleanup.mockResolvedValue({
        totalDeleted: 5
      });

      await cleanupCallback();

      expect(mockLogger.error).toHaveBeenCalledWith(
        { err: expect.any(TypeError) },
        'Error during automatic video cleanup'
      );
    });

    test('should handle non-numeric result from Session.destroy', async () => {
      cronJobs.initialize();
      const sessionCleanupCallback = mockSchedule.schedule.mock.calls[1][1];

      mockDb.Session.destroy.mockResolvedValue('invalid');

      await sessionCleanupCallback();

      expect(mockLogger.info).toHaveBeenCalledWith({ removed: 'invalid' }, 'Removed expired sessions');
    });
  });
});
