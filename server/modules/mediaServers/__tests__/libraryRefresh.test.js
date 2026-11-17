jest.mock('../../../logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
}));
jest.mock('../../configModule', () => ({ getConfig: jest.fn() }));
jest.mock('../serverRegistry', () => ({ getEnabledAdapters: jest.fn() }));

const logger = require('../../../logger');
const configModule = require('../../configModule');
const serverRegistry = require('../serverRegistry');
const { refreshAfterDownload } = require('../libraryRefresh');

const makeAdapter = (serverType) => ({
  serverType,
  refreshAfterDownload: jest.fn().mockResolvedValue(),
});

describe('libraryRefresh.refreshAfterDownload', () => {
  const config = { jellyfinEnabled: true };

  beforeEach(() => {
    jest.clearAllMocks();
    configModule.getConfig.mockReturnValue(config);
  });

  test('asks each enabled media server to refresh once, using the current config', async () => {
    const jellyfin = makeAdapter('jellyfin');
    const emby = makeAdapter('emby');
    serverRegistry.getEnabledAdapters.mockReturnValue([jellyfin, emby]);

    await refreshAfterDownload();

    expect(serverRegistry.getEnabledAdapters).toHaveBeenCalledWith(config);
    expect(jellyfin.refreshAfterDownload).toHaveBeenCalledTimes(1);
    expect(emby.refreshAfterDownload).toHaveBeenCalledTimes(1);
  });

  test('does nothing when no media server is connected', async () => {
    serverRegistry.getEnabledAdapters.mockReturnValue([]);

    await expect(refreshAfterDownload()).resolves.toBeUndefined();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  test('logs a warning and still refreshes the other servers when one fails', async () => {
    const jellyfin = makeAdapter('jellyfin');
    const emby = makeAdapter('emby');
    jellyfin.refreshAfterDownload.mockRejectedValue(new Error('boom'));
    serverRegistry.getEnabledAdapters.mockReturnValue([jellyfin, emby]);

    await expect(refreshAfterDownload()).resolves.toBeUndefined();

    expect(emby.refreshAfterDownload).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ serverType: 'jellyfin' }),
      'Post-download library refresh failed'
    );
  });

  test('logs a warning instead of rejecting when the adapters cannot be resolved', async () => {
    serverRegistry.getEnabledAdapters.mockImplementation(() => { throw new Error('bad config'); });

    await expect(refreshAfterDownload()).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });
});
