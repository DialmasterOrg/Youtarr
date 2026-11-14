/* eslint-env jest */

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-11-14T12:00:00.000Z');

const daysAgo = (days) => new Date(NOW.getTime() - days * MS_PER_DAY);

describe('supportPromptModule', () => {
  let supportPromptModule;
  let configModule;
  let Video;
  let Job;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(NOW);

    jest.doMock('../configModule', () => ({
      getConfig: jest.fn(() => ({ supportPromptShownAt: null })),
      updateConfig: jest.fn(),
      isElfhostedPlatform: jest.fn(() => false)
    }));
    jest.doMock('../../models', () => ({
      Video: { count: jest.fn(), min: jest.fn() },
      Job: { min: jest.fn() }
    }));

    configModule = require('../configModule');
    ({ Video, Job } = require('../../models'));
    supportPromptModule = require('../supportPromptModule');

    // An established install: enough videos, first used a month ago.
    Video.count.mockResolvedValue(250);
    Video.min.mockResolvedValue(daysAgo(30));
    Job.min.mockResolvedValue(daysAgo(30));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('shouldShow', () => {
    test('shows the prompt to an established install that has never seen it', async () => {
      await expect(supportPromptModule.shouldShow()).resolves.toBe(true);
    });

    test('shows the prompt at exactly the video and age thresholds', async () => {
      Video.count.mockResolvedValue(supportPromptModule.MIN_DOWNLOADED_VIDEOS);
      Video.min.mockResolvedValue(daysAgo(supportPromptModule.MIN_DAYS_SINCE_FIRST_USE));
      Job.min.mockResolvedValue(null);

      await expect(supportPromptModule.shouldShow()).resolves.toBe(true);
    });

    test('never shows the prompt on Elfhosted, without querying the database', async () => {
      configModule.isElfhostedPlatform.mockReturnValue(true);

      await expect(supportPromptModule.shouldShow()).resolves.toBe(false);
      expect(Video.count).not.toHaveBeenCalled();
    });

    test('never shows the prompt again once it was shown, without querying the database', async () => {
      configModule.getConfig.mockReturnValue({ supportPromptShownAt: '2026-11-01T00:00:00.000Z' });

      await expect(supportPromptModule.shouldShow()).resolves.toBe(false);
      expect(Video.count).not.toHaveBeenCalled();
    });

    test('waits until enough videos have been downloaded', async () => {
      Video.count.mockResolvedValue(supportPromptModule.MIN_DOWNLOADED_VIDEOS - 1);

      await expect(supportPromptModule.shouldShow()).resolves.toBe(false);
    });

    test('waits when many videos were downloaded but the install is still new', async () => {
      Video.count.mockResolvedValue(5000);
      Video.min.mockResolvedValue(daysAgo(2));
      Job.min.mockResolvedValue(daysAgo(3));

      await expect(supportPromptModule.shouldShow()).resolves.toBe(false);
    });

    test('uses the oldest job when videos carry no download time', async () => {
      Video.min.mockResolvedValue(null);
      Job.min.mockResolvedValue(daysAgo(60));

      await expect(supportPromptModule.shouldShow()).resolves.toBe(true);
    });

    test('uses the earlier of the first download and the first job', async () => {
      Video.min.mockResolvedValue(daysAgo(1));
      Job.min.mockResolvedValue(daysAgo(20));

      await expect(supportPromptModule.shouldShow()).resolves.toBe(true);
    });

    test('stays hidden when no first-use date is known', async () => {
      Video.min.mockResolvedValue(null);
      Job.min.mockResolvedValue(null);

      await expect(supportPromptModule.shouldShow()).resolves.toBe(false);
    });

    test('rejects when the database query fails', async () => {
      Video.count.mockRejectedValue(new Error('db down'));

      await expect(supportPromptModule.shouldShow()).rejects.toThrow('db down');
    });
  });

  describe('markShown', () => {
    test('stamps the current time while keeping the rest of the config', () => {
      configModule.getConfig.mockReturnValue({ plexPort: '32400', supportPromptShownAt: null });

      supportPromptModule.markShown();

      expect(configModule.updateConfig).toHaveBeenCalledWith({
        plexPort: '32400',
        supportPromptShownAt: NOW.toISOString()
      });
    });

    test('keeps the first timestamp when called again', () => {
      configModule.getConfig.mockReturnValue({ supportPromptShownAt: '2026-11-01T00:00:00.000Z' });

      supportPromptModule.markShown();

      expect(configModule.updateConfig).not.toHaveBeenCalled();
    });
  });
});
