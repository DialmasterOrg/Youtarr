/* eslint-env jest */

jest.mock('../../logger');

const GB = 1024 ** 3;

describe('storageGuard', () => {
  let storageGuard;
  let mockConfigModule;
  let mockStorageUsage;
  let mockNotificationModule;
  let mockMessageEmitter;
  let config;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    config = { downloadPauseUsageLimit: '', downloadPauseMinFreeSpace: '' };
    mockConfigModule = {
      getConfig: jest.fn(() => config),
      convertStorageThresholdToBytes: jest.fn((value) => {
        const match = /^(\d+)GB$/.exec(value || '');
        return match ? Number(match[1]) * GB : null;
      }),
      getStorageStatus: jest.fn().mockResolvedValue({ available: 100 * GB }),
      onConfigChange: jest.fn()
    };
    mockStorageUsage = { getDownloadedBytes: jest.fn().mockResolvedValue(10 * GB) };
    mockNotificationModule = { sendDownloadPauseNotification: jest.fn().mockResolvedValue() };
    mockMessageEmitter = { emitMessage: jest.fn() };

    jest.doMock('../configModule', () => mockConfigModule);
    jest.doMock('../storageUsage', () => mockStorageUsage);
    jest.doMock('../notificationModule', () => mockNotificationModule);
    jest.doMock('../messageEmitter', () => mockMessageEmitter);

    storageGuard = require('../storageGuard');
  });

  afterEach(() => {
    // Clear any recheck interval left by a paused test.
    storageGuard._setRecheckTimer(false);
  });

  describe('refresh', () => {
    test('is not paused when no limits are configured', async () => {
      const status = await storageGuard.refresh();

      expect(status.paused).toBe(false);
    });

    test('pauses when downloaded videos exceed the usage limit', async () => {
      config.downloadPauseUsageLimit = '5GB';

      const status = await storageGuard.refresh();

      expect(status.reasons.map((r) => r.type)).toEqual(['usage']);
    });

    test('does not pause when usage equals the limit', async () => {
      config.downloadPauseUsageLimit = '10GB';

      const status = await storageGuard.refresh();

      expect(status.paused).toBe(false);
    });

    test('pauses when free space is below the minimum', async () => {
      config.downloadPauseMinFreeSpace = '200GB';

      const status = await storageGuard.refresh();

      expect(status.reasons.map((r) => r.type)).toEqual(['freeSpace']);
    });

    test('describes the reason in plain language', async () => {
      config.downloadPauseUsageLimit = '5GB';

      const status = await storageGuard.refresh();

      expect(status.reasons[0].text).toBe('downloaded videos use 10.0 GB, over the 5 GB limit');
    });

    test('reports both reasons when both limits are exceeded', async () => {
      config.downloadPauseUsageLimit = '5GB';
      config.downloadPauseMinFreeSpace = '200GB';

      const status = await storageGuard.refresh();

      expect(status.reasons).toHaveLength(2);
    });

    test('does not measure downloaded size when no usage limit is set', async () => {
      await storageGuard.refresh();

      expect(mockStorageUsage.getDownloadedBytes).not.toHaveBeenCalled();
    });

    test('measures downloaded size without a limit when asked to', async () => {
      const status = await storageGuard.refresh({ includeUsage: true });

      expect(status.usage.downloadedBytes).toBe(10 * GB);
    });

    test('does not check disk space when no free-space minimum is set', async () => {
      await storageGuard.refresh();

      expect(mockConfigModule.getStorageStatus).not.toHaveBeenCalled();
    });

    test('fails open when downloaded size cannot be measured', async () => {
      config.downloadPauseUsageLimit = '5GB';
      mockStorageUsage.getDownloadedBytes.mockRejectedValue(new Error('db down'));

      const status = await storageGuard.refresh();

      expect(status.paused).toBe(false);
    });

    test('fails open when disk space is unavailable', async () => {
      config.downloadPauseMinFreeSpace = '200GB';
      mockConfigModule.getStorageStatus.mockResolvedValue(null);

      const status = await storageGuard.refresh();

      expect(status.paused).toBe(false);
    });

    test('pauses while the downloads folder looks unavailable, describing it in plain language', async () => {
      storageGuard.setLibraryCheck(jest.fn().mockResolvedValue({
        ok: false, reason: 'empty', path: '/data', message: 'The downloads folder is empty.',
      }));

      const status = await storageGuard.refresh();

      expect(status.paused).toBe(true);
      expect(status.reasons).toEqual([{ type: 'library', libraryReason: 'empty', text: 'the downloads folder is empty' }]);
      expect(storageGuard.describe(status)).toBe('Downloads are paused: the downloads folder is empty');
    });

    test('does not pause for the downloads folder while it is fine', async () => {
      storageGuard.setLibraryCheck(jest.fn().mockResolvedValue(null));

      const status = await storageGuard.refresh();

      expect(status.paused).toBe(false);
    });

    test('fails open when the downloads folder cannot be checked', async () => {
      storageGuard.setLibraryCheck(jest.fn().mockRejectedValue(new Error('db down')));

      const status = await storageGuard.refresh();

      expect(status.paused).toBe(false);
    });

    describe('the downloads folder check', () => {
      const emptyFolder = { ok: false, reason: 'empty', path: '/data', message: 'The downloads folder is empty.' };

      afterEach(() => jest.useRealTimers());

      test('is reused for a while instead of listing the folder on every refresh', async () => {
        jest.useFakeTimers();
        const checkLibrary = jest.fn().mockResolvedValue(emptyFolder);
        storageGuard.setLibraryCheck(checkLibrary);

        await storageGuard.refresh();
        await storageGuard.refresh();
        expect(checkLibrary).toHaveBeenCalledTimes(1);

        jest.advanceTimersByTime(storageGuard.LIBRARY_CHECK_CACHE_MS);
        await storageGuard.refresh();
        expect(checkLibrary).toHaveBeenCalledTimes(2);
      });

      test('looks again right away when asked to, as after a rescan', async () => {
        const checkLibrary = jest.fn().mockResolvedValue(emptyFolder);
        storageGuard.setLibraryCheck(checkLibrary);
        await storageGuard.refresh();
        checkLibrary.mockResolvedValue(null);

        const status = await storageGuard.recheckLibrary();

        expect(status.paused).toBe(false);
        expect(checkLibrary).toHaveBeenCalledTimes(2);
      });

      test('fails open when the folder does not answer in time, without stalling later refreshes', async () => {
        jest.useFakeTimers();
        // A share that hangs: the check never settles.
        const checkLibrary = jest.fn(() => new Promise(() => {}));
        storageGuard.setLibraryCheck(checkLibrary);

        const first = storageGuard.refresh();
        await jest.advanceTimersByTimeAsync(storageGuard.LIBRARY_CHECK_TIMEOUT_MS);
        await expect(first).resolves.toEqual(expect.objectContaining({ paused: false }));

        // The hung check keeps its slot, and nobody waits for it again.
        await expect(storageGuard.refresh()).resolves.toEqual(expect.objectContaining({ paused: false }));
        expect(checkLibrary).toHaveBeenCalledTimes(1);
      });

      test('stays paused when a re-check of an unavailable folder times out', async () => {
        jest.useFakeTimers();
        const checkLibrary = jest.fn().mockResolvedValue(emptyFolder);
        storageGuard.setLibraryCheck(checkLibrary);
        await storageGuard.refresh();
        const onResumed = jest.fn();
        storageGuard.on('resumed', onResumed);

        // The cached answer expires and the dead share now answers too slowly.
        jest.advanceTimersByTime(storageGuard.LIBRARY_CHECK_CACHE_MS);
        checkLibrary.mockImplementation(() => new Promise(() => {}));
        const recheck = storageGuard.refresh();
        await jest.advanceTimersByTimeAsync(storageGuard.LIBRARY_CHECK_TIMEOUT_MS);

        await expect(recheck).resolves.toEqual(expect.objectContaining({ paused: true }));
        expect(onResumed).not.toHaveBeenCalled();
        expect(mockNotificationModule.sendDownloadPauseNotification).toHaveBeenCalledTimes(1);
        storageGuard._setRecheckTimer(false);
      });

      test('keeps downloads running when a re-check of a fine folder times out', async () => {
        jest.useFakeTimers();
        const checkLibrary = jest.fn().mockResolvedValue(null);
        storageGuard.setLibraryCheck(checkLibrary);
        await storageGuard.refresh();

        jest.advanceTimersByTime(storageGuard.LIBRARY_CHECK_CACHE_MS);
        checkLibrary.mockImplementation(() => new Promise(() => {}));
        const recheck = storageGuard.refresh();
        await jest.advanceTimersByTimeAsync(storageGuard.LIBRARY_CHECK_TIMEOUT_MS);

        await expect(recheck).resolves.toEqual(expect.objectContaining({ paused: false }));
        expect(mockNotificationModule.sendDownloadPauseNotification).not.toHaveBeenCalled();
      });

      test('uses a late answer from a check that had timed out', async () => {
        jest.useFakeTimers();
        let finish;
        const checkLibrary = jest.fn(() => new Promise((resolve) => { finish = resolve; }));
        storageGuard.setLibraryCheck(checkLibrary);

        const first = storageGuard.refresh();
        await jest.advanceTimersByTimeAsync(storageGuard.LIBRARY_CHECK_TIMEOUT_MS);
        await first;
        finish(emptyFolder);
        await jest.advanceTimersByTimeAsync(0);

        await expect(storageGuard.refresh()).resolves.toEqual(expect.objectContaining({ paused: true }));
        expect(checkLibrary).toHaveBeenCalledTimes(1);
      });
    });

    test('keeps the original pausedSince while staying paused', async () => {
      config.downloadPauseUsageLimit = '5GB';
      const first = await storageGuard.refresh();
      mockStorageUsage.getDownloadedBytes.mockResolvedValue(11 * GB);

      const second = await storageGuard.refresh();

      expect(second.pausedSince).toBe(first.pausedSince);
    });
  });

  describe('state transitions', () => {
    test('sends one notification when downloads become paused', async () => {
      config.downloadPauseUsageLimit = '5GB';

      await storageGuard.refresh();
      await storageGuard.refresh();

      expect(mockNotificationModule.sendDownloadPauseNotification).toHaveBeenCalledTimes(1);
    });

    test('sends a resumed notification when storage recovers', async () => {
      config.downloadPauseUsageLimit = '5GB';
      await storageGuard.refresh();
      mockStorageUsage.getDownloadedBytes.mockResolvedValue(GB);

      await storageGuard.refresh();

      expect(mockNotificationModule.sendDownloadPauseNotification).toHaveBeenLastCalledWith(
        expect.objectContaining({ paused: false })
      );
    });

    test('names what was holding downloads when it clears', async () => {
      const checkLibrary = jest.fn().mockResolvedValue({
        ok: false, reason: 'not-found', path: '/data', message: 'Most downloaded videos are not where Youtarr saved them.',
      });
      storageGuard.setLibraryCheck(checkLibrary);
      await storageGuard.refresh();
      checkLibrary.mockResolvedValue(null);

      await storageGuard.recheckLibrary();

      expect(mockNotificationModule.sendDownloadPauseNotification).toHaveBeenLastCalledWith(expect.objectContaining({
        paused: false,
        resumedFrom: [expect.objectContaining({ type: 'library' })],
      }));
    });

    test('does not notify on a first check that is not paused', async () => {
      await storageGuard.refresh();

      expect(mockNotificationModule.sendDownloadPauseNotification).not.toHaveBeenCalled();
    });

    test('emits resumed when downloads are allowed again', async () => {
      const onResumed = jest.fn();
      storageGuard.on('resumed', onResumed);
      config.downloadPauseUsageLimit = '5GB';
      await storageGuard.refresh();
      config.downloadPauseUsageLimit = '';

      await storageGuard.refresh();

      expect(onResumed).toHaveBeenCalledTimes(1);
    });

    test('broadcasts the status when the paused state changes', async () => {
      config.downloadPauseUsageLimit = '5GB';

      await storageGuard.refresh();

      expect(mockMessageEmitter.emitMessage).toHaveBeenCalledWith(
        'broadcast', null, 'download', 'downloadPauseChanged', expect.objectContaining({ paused: true })
      );
    });

    test('does not broadcast while unpaused and unchanged', async () => {
      await storageGuard.refresh();

      expect(mockMessageEmitter.emitMessage).not.toHaveBeenCalled();
    });

    test('re-checks periodically while paused', async () => {
      jest.useFakeTimers();
      try {
        config.downloadPauseUsageLimit = '5GB';
        await storageGuard.refresh();
        mockStorageUsage.getDownloadedBytes.mockClear();

        jest.advanceTimersByTime(storageGuard.PAUSED_RECHECK_INTERVAL_MS);
        await storageGuard.queue;

        expect(mockStorageUsage.getDownloadedBytes).toHaveBeenCalledTimes(1);
      } finally {
        storageGuard._setRecheckTimer(false);
        jest.useRealTimers();
      }
    });
  });

  describe('assertDownloadsAllowed', () => {
    test('resolves when downloads are not paused', async () => {
      await expect(storageGuard.assertDownloadsAllowed()).resolves.toBeUndefined();
    });

    test('throws a recognizable error when paused', async () => {
      config.downloadPauseUsageLimit = '5GB';

      const error = await storageGuard.assertDownloadsAllowed().catch((err) => err);

      expect(storageGuard.isPausedError(error)).toBe(true);
    });

    test('puts the reason in the error message', async () => {
      config.downloadPauseMinFreeSpace = '200GB';

      await expect(storageGuard.assertDownloadsAllowed()).rejects.toThrow(
        'Downloads are paused: only 100.0 GB of disk space is free, below the 200 GB minimum'
      );
    });
  });

  describe('isPausedError', () => {
    test('is false for unrelated errors', () => {
      expect(storageGuard.isPausedError(new Error('boom'))).toBe(false);
    });
  });

  describe('initialize', () => {
    test('re-checks when the config changes', async () => {
      config.downloadPauseUsageLimit = '50GB';
      await storageGuard.initialize();
      const onChange = mockConfigModule.onConfigChange.mock.calls[0][0];
      mockStorageUsage.getDownloadedBytes.mockClear();

      onChange();
      await storageGuard.queue;

      expect(mockStorageUsage.getDownloadedBytes).toHaveBeenCalledTimes(1);
    });

    test('subscribes to config changes only once', async () => {
      await storageGuard.initialize();
      await storageGuard.initialize();

      expect(mockConfigModule.onConfigChange).toHaveBeenCalledTimes(1);
    });
  });
});
