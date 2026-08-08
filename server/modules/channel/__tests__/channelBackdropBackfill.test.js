/* eslint-env jest */

const mockFactories = require('./mockFactories');

jest.mock('fs-extra', () => ({ existsSync: jest.fn() }));
jest.mock('../../../logger');
jest.mock('../../../models/channel', () => mockFactories.mockChannelModel());
jest.mock('../../configModule', () => mockFactories.mockConfigModule());
jest.mock('../channelMetadataFetcher', () => ({ fetchChannelMetadata: jest.fn() }));
jest.mock('../channelThumbnails', () => ({
  processChannelBanner: jest.fn(),
  backfillChannelImages: jest.fn(),
}));

describe('channelBackdropBackfill', () => {
  let channelBackdropBackfill;
  let configModule;
  let Channel;
  let fs;
  let channelMetadataFetcher;
  let channelThumbnails;
  let setTimeoutSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    fs = require('fs-extra');
    fs.existsSync.mockReturnValue(false);

    configModule = require('../../configModule');
    configModule.getConfig.mockReturnValue({ writeBackdropImages: false });

    Channel = require('../../../models/channel');
    Channel.findAll.mockResolvedValue([]);

    channelMetadataFetcher = require('../channelMetadataFetcher');
    channelMetadataFetcher.fetchChannelMetadata.mockResolvedValue({ channel_id: 'UC1', thumbnails: [] });

    channelThumbnails = require('../channelThumbnails');
    channelThumbnails.processChannelBanner.mockResolvedValue();
    channelThumbnails.backfillChannelImages.mockResolvedValue();

    setTimeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation((cb) => {
      cb();
      return 0;
    });

    channelBackdropBackfill = require('../channelBackdropBackfill');
  });

  afterEach(() => {
    setTimeoutSpy.mockRestore();
  });

  function getChangeCallback() {
    channelBackdropBackfill.subscribe();
    expect(configModule.onConfigChange).toHaveBeenCalledTimes(1);
    return configModule.onConfigChange.mock.calls[0][0];
  }

  describe('config change trigger', () => {
    test('runs the sweep when writeBackdropImages flips from false to true', async () => {
      const runSweepSpy = jest.spyOn(channelBackdropBackfill, 'runSweep').mockResolvedValue();
      const onChange = getChangeCallback();

      configModule.getConfig.mockReturnValue({ writeBackdropImages: true });
      onChange();

      expect(runSweepSpy).toHaveBeenCalledTimes(1);
    });

    test('does not run the sweep when the flag stays true', async () => {
      configModule.getConfig.mockReturnValue({ writeBackdropImages: true });
      const runSweepSpy = jest.spyOn(channelBackdropBackfill, 'runSweep').mockResolvedValue();
      const onChange = getChangeCallback();

      onChange();

      expect(runSweepSpy).not.toHaveBeenCalled();
    });

    test('does not run the sweep when the flag flips off', async () => {
      configModule.getConfig.mockReturnValue({ writeBackdropImages: true });
      const runSweepSpy = jest.spyOn(channelBackdropBackfill, 'runSweep').mockResolvedValue();
      const onChange = getChangeCallback();

      configModule.getConfig.mockReturnValue({ writeBackdropImages: false });
      onChange();

      expect(runSweepSpy).not.toHaveBeenCalled();
    });
  });

  describe('runSweep', () => {
    test('fetches and caches banners for enabled channels missing the cache', async () => {
      Channel.findAll.mockResolvedValue([
        { channel_id: 'UC1', url: 'https://www.youtube.com/@one' },
        { channel_id: 'UC2', url: 'https://www.youtube.com/@two' },
      ]);
      fs.existsSync.mockImplementation((p) => p === '/path/to/images/channelbanner-UC1.jpg');

      await channelBackdropBackfill.runSweep();

      expect(channelMetadataFetcher.fetchChannelMetadata).toHaveBeenCalledTimes(1);
      expect(channelMetadataFetcher.fetchChannelMetadata).toHaveBeenCalledWith('https://www.youtube.com/@two');
      expect(channelThumbnails.processChannelBanner).toHaveBeenCalledWith(
        expect.objectContaining({ channel_id: 'UC1' }),
        'UC2'
      );
    });

    test('falls back to the canonical channel URL when the row has none', async () => {
      Channel.findAll.mockResolvedValue([{ channel_id: 'UC3', url: null }]);

      await channelBackdropBackfill.runSweep();

      expect(channelMetadataFetcher.fetchChannelMetadata).toHaveBeenCalledWith(
        'https://www.youtube.com/channel/UC3'
      );
    });

    test('continues past per-channel fetch errors and still runs the backfill', async () => {
      Channel.findAll.mockResolvedValue([
        { channel_id: 'UC1', url: 'https://www.youtube.com/@one' },
        { channel_id: 'UC2', url: 'https://www.youtube.com/@two' },
      ]);
      channelMetadataFetcher.fetchChannelMetadata
        .mockRejectedValueOnce(new Error('fetch failed'))
        .mockResolvedValueOnce({ channel_id: 'UC2', thumbnails: [] });

      await channelBackdropBackfill.runSweep();

      expect(channelMetadataFetcher.fetchChannelMetadata).toHaveBeenCalledTimes(2);
      expect(channelThumbnails.backfillChannelImages).toHaveBeenCalledTimes(1);
    });

    test('runs the channel image backfill once at the end', async () => {
      const channels = [{ channel_id: 'UC1', url: 'https://www.youtube.com/@one' }];
      Channel.findAll.mockResolvedValue(channels);

      await channelBackdropBackfill.runSweep();

      expect(channelThumbnails.backfillChannelImages).toHaveBeenCalledWith(channels);
    });

    test('is single-flight: a second concurrent call is a no-op', async () => {
      Channel.findAll.mockResolvedValue([{ channel_id: 'UC1', url: 'https://www.youtube.com/@one' }]);
      let resolveFetch;
      channelMetadataFetcher.fetchChannelMetadata.mockReturnValue(
        new Promise((resolve) => { resolveFetch = resolve; })
      );

      const first = channelBackdropBackfill.runSweep();
      const second = channelBackdropBackfill.runSweep();
      resolveFetch({ channel_id: 'UC1', thumbnails: [] });
      await Promise.all([first, second]);

      expect(Channel.findAll).toHaveBeenCalledTimes(1);
    });

    test('skips channels without a channel_id', async () => {
      Channel.findAll.mockResolvedValue([{ channel_id: null, url: 'https://www.youtube.com/@x' }]);

      await channelBackdropBackfill.runSweep();

      expect(channelMetadataFetcher.fetchChannelMetadata).not.toHaveBeenCalled();
    });
  });
});
