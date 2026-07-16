/* eslint-env jest */

// Facade-level tests for channelModule: constructor side effects plus the
// delegation contract between the facade and its channel/ sub-modules.
// Behavior of the sub-modules themselves is covered in
// server/modules/channel/__tests__/.

const mockFactories = require('../channel/__tests__/mockFactories');

jest.mock('fs');
jest.mock('child_process');
jest.mock('node-cron');
jest.mock('uuid');
jest.mock('../messageEmitter.js');
jest.mock('../../logger');
jest.mock('../../models/channel', () => mockFactories.mockChannelModel());
jest.mock('../../models/channelvideo', () => mockFactories.mockChannelVideoModel());
jest.mock('../../models/video', () => mockFactories.mockVideoModel());
jest.mock('../configModule', () => mockFactories.mockConfigModule());
jest.mock('../youtubeApi', () => mockFactories.mockYoutubeApi());
jest.mock('../../db', () => mockFactories.mockDb());
jest.mock('../filesystem', () => mockFactories.mockFilesystem());
jest.mock('../fileCheckModule', () => mockFactories.mockFileCheckModule());

jest.mock('../downloadModule', () => ({
  doChannelDownloads: jest.fn(),
  doChannelAndPlaylistDownloads: jest.fn()
}));

jest.mock('../jobModule', () => ({
  getAllJobs: jest.fn().mockReturnValue({})
}));

jest.mock('../ytDlpRunner', () => ({
  run: jest.fn()
}));

// Flush the facade constructor's fire-and-forget populateMissingChannelInfo()
// chain: with Channel.findAll unconfigured, channelCatalog.readChannels()
// still calls channelThumbnails.backfillChannelPosters(channels)
// unconditionally before its own catch block runs, so that call lands on the
// microtask queue unless flushed. Flushing (rather than configuring model
// mocks) keeps this file free of shared mock-value state that could race
// other cases.
const flushConstructorTasks = () => new Promise(setImmediate);

describe('channelModule facade', () => {
  describe('constructor', () => {
    test('schedules the auto-download task and subscribes to config changes', async () => {
      jest.resetModules();
      jest.clearAllMocks();
      const cron = require('node-cron');
      const configModule = require('../configModule');

      require('../channelModule');
      await flushConstructorTasks();

      expect(cron.schedule).toHaveBeenCalledWith(
        '0 */6 * * *',
        expect.any(Function)
      );
      expect(configModule.onConfigChange).toHaveBeenCalled();
    });
  });

  describe('delegation contract', () => {
    // [facade method, submodule path, target method, sample args, sync|async]
    const CASES = [
      ['subscribe', '../channel/autoDownloadScheduler', 'subscribe', [], 'sync'],
      ['isFetchInProgress', '../channel/fetchRegistry', 'isFetchInProgress', ['UC1', 'videos'], 'sync'],
      ['resolveChannelUrlFromId', '../channel/channelIdentity', 'resolveChannelUrlFromId', ['UC1'], 'sync'],
      ['getChannelInfo', '../channel/channelProvisioning', 'getChannelInfo', ['UC1', false, true, { sub_folder: 'x' }, { skipTabDetection: true }], 'async'],
      ['upsertChannel', '../channel/channelProvisioning', 'upsertChannel', [{ id: 'UC1' }, true, 'video', { video_quality: '1080' }], 'async'],
      ['getChannelsPaginated', '../channel/channelCatalog', 'getChannelsPaginated', [{ page: 2, pageSize: 10 }], 'async'],
      ['writeChannels', '../channel/channelCatalog', 'writeChannels', [['https://www.youtube.com/@a']], 'async'],
      ['updateChannelsByDelta', '../channel/channelCatalog', 'updateChannelsByDelta', [{ enableUrls: ['https://www.youtube.com/@a'], disableUrls: [] }], 'async'],
      ['getChannelVideos', '../channel/channelVideosService', 'getChannelVideos', ['UC1', 2, 25, 'only', 'q', 'title', 'asc', 'shorts', 60, 600, '2026-01-01', '2026-02-01', 'only', 'exclude', 'off'], 'async'],
      ['fetchAllChannelVideos', '../channel/channelVideosService', 'fetchAllChannelVideos', ['UC1', 2, 25, 'only', 'shorts'], 'async'],
      ['getChannelAvailableTabs', '../channel/tabManager', 'getChannelAvailableTabs', ['UC1'], 'async'],
      ['updateAutoDownloadForTab', '../channel/tabManager', 'updateAutoDownloadForTab', ['UC1', 'shorts', true], 'async'],
      ['redetectChannelTabs', '../channel/tabManager', 'redetectChannelTabs', ['UC1'], 'async'],
      ['resolveChannelFolderName', '../channel/channelMetadataFetcher', 'resolveChannelFolderName', [{ channel_id: 'UC1' }], 'async'],
      ['generateChannelsFile', '../channel/autoDownloadScheduler', 'generateChannelsFile', [], 'async'],
      ['getEnabledChannelDownloadUrls', '../channel/autoDownloadScheduler', 'getEnabledChannelDownloadUrls', [], 'async'],
      ['backfillChannelPosters', '../channel/channelThumbnails', 'backfillChannelPosters', [[{ channel_id: 'UC1' }]], 'async'],
    ];

    test.each(CASES)('%s delegates with arguments and result intact', async (method, modulePath, target, args, kind) => {
      jest.resetModules();
      jest.clearAllMocks();
      const submodule = require(modulePath);
      const sentinel = { sentinel: method };
      const spy = kind === 'async'
        ? jest.spyOn(submodule, target).mockResolvedValue(sentinel)
        : jest.spyOn(submodule, target).mockReturnValue(sentinel);

      const facade = require('../channelModule');
      await flushConstructorTasks();
      spy.mockClear(); // drop constructor-time calls (scheduleTask/subscribe)

      const result = facade[method](...args);
      if (kind === 'async') {
        await expect(result).resolves.toBe(sentinel);
      } else {
        expect(result).toBe(sentinel); // proves the method stayed synchronous
      }
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(...args);
      spy.mockRestore();
    });

    test('rejected promises propagate unchanged through the facade', async () => {
      jest.resetModules();
      jest.clearAllMocks();
      const channelProvisioning = require('../channel/channelProvisioning');
      const boom = new Error('boom');
      jest.spyOn(channelProvisioning, 'getChannelInfo').mockRejectedValue(boom);

      const facade = require('../channelModule');

      await expect(facade.getChannelInfo('UC1')).rejects.toBe(boom);
    });
  });
});
