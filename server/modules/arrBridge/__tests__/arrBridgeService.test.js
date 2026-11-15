/* eslint-env jest */
const { createArrBridgeService, createUploadDateLookup } = require('../arrBridgeService');

const KEY = 'k'.repeat(64);

function fakeConfigModule(initial) {
  const listeners = [];
  const module = {
    config: initial,
    directoryPath: '/data',
    getConfig: () => module.config,
    updateConfig: jest.fn((next) => {
      module.config = next;
      listeners.forEach((listener) => listener());
    }),
    onConfigChange: (listener) => listeners.push(listener),
    change(next) {
      module.config = next;
      listeners.forEach((listener) => listener());
    },
  };
  return module;
}

function setup(config, overrides = {}) {
  const configModule = fakeConfigModule(config);
  const executor = { start: jest.fn(), stop: jest.fn(), wake: jest.fn(), handleJobEnded: jest.fn() };
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
  const service = createArrBridgeService({
    configModule,
    models: { ArrBridgeGrab: {}, Video: {}, ChannelVideo: {}, Job: {} },
    searchVideos: jest.fn(),
    ...overrides,
    isYoutubeApiAvailable: () => false,
    downloader: jest.fn(),
    jobLookup: jest.fn(),
    storageGuard: { isPausedError: () => false, getStatus: () => ({ paused: false }) },
    isArchived: () => false,
    getActivity: () => null,
    logger,
    createExecutor: () => executor,
  });
  return { service, configModule, executor, logger };
}

describe('arrBridgeService', () => {
  test('does nothing while the bridge is off', () => {
    const { service, configModule, executor } = setup({ arrBridgeEnabled: false });

    service.start();

    expect(service.isEnabled()).toBe(false);
    expect(executor.start).not.toHaveBeenCalled();
    expect(configModule.updateConfig).not.toHaveBeenCalled();
  });

  test('creates the key the first time the bridge is found enabled, and starts the executor', () => {
    const { service, configModule, executor } = setup({ arrBridgeEnabled: true, plexApiKey: 'keep-me' });

    service.start();

    expect(configModule.updateConfig).toHaveBeenCalledTimes(1);
    expect(configModule.config.arrBridgeApiKey).toMatch(/^[0-9a-f]{64}$/);
    expect(configModule.config.plexApiKey).toBe('keep-me');
    expect(executor.start).toHaveBeenCalledTimes(1);
  });

  test('never writes the key to the log', () => {
    const { service, configModule, logger } = setup({ arrBridgeEnabled: true });

    service.start();

    const logged = JSON.stringify([logger.info.mock.calls, logger.warn.mock.calls, logger.debug.mock.calls]);
    expect(logged).not.toContain(configModule.config.arrBridgeApiKey);
  });

  test('keeps an existing key', () => {
    const { service, configModule } = setup({ arrBridgeEnabled: true, arrBridgeApiKey: 'a'.repeat(64) });
    service.start();
    expect(configModule.updateConfig).not.toHaveBeenCalled();
  });

  test('starts when the bridge is switched on later', () => {
    const { service, configModule, executor } = setup({ arrBridgeEnabled: false });
    service.start();

    configModule.change({ arrBridgeEnabled: true, arrBridgeApiKey: 'a'.repeat(64) });

    expect(executor.start).toHaveBeenCalledTimes(1);
  });

  test('stops when the bridge is switched off', () => {
    const { service, configModule, executor } = setup({ arrBridgeEnabled: true, arrBridgeApiKey: 'a'.repeat(64) });
    service.start();

    configModule.change({ arrBridgeEnabled: false, arrBridgeApiKey: 'a'.repeat(64) });

    expect(executor.stop).toHaveBeenCalledTimes(1);
  });

  test('a settings change while running sweeps again, so new category folders appear', () => {
    const { service, configModule, executor } = setup({ arrBridgeEnabled: true, arrBridgeApiKey: 'a'.repeat(64) });
    service.start();

    configModule.change({ ...configModule.config, arrBridgeCategories: [{ name: 'tv-4k' }] });

    expect(executor.start).toHaveBeenCalledTimes(1);
    expect(executor.wake).toHaveBeenCalledTimes(1);
  });

  test('passes finished jobs to the executor', () => {
    const { service, executor } = setup({ arrBridgeEnabled: true, arrBridgeApiKey: 'a'.repeat(64) });
    service.handleJobEnded({ jobId: 'j' });
    expect(executor.handleJobEnded).toHaveBeenCalledWith({ jobId: 'j' });
  });

  test('checks a key against the stored one, and accepts none while the bridge is off', () => {
    const key = 'a'.repeat(64);
    const on = setup({ arrBridgeEnabled: true, arrBridgeApiKey: key }).service;
    const off = setup({ arrBridgeEnabled: false, arrBridgeApiKey: key }).service;

    expect(on.isAuthorized(key)).toBe(true);
    expect(on.isAuthorized('wrong')).toBe(false);
    expect(on.isAuthorized(undefined)).toBe(false);
    expect(on.isAuthorized([key])).toBe(false);
    expect(off.isAuthorized(key)).toBe(false);
  });

  test('exposes both protocol handlers', () => {
    const { service } = setup({ arrBridgeEnabled: true });
    expect(typeof service.newznab.handleApi).toBe('function');
    expect(typeof service.newznab.handleNzb).toBe('function');
    expect(typeof service.sabnzbd.handle).toBe('function');
  });

  test('a search asks the configured Sonarr about the episode and matches by its title', async () => {
    const sonarr = { url: 'http://sonarr:8989', apiKey: 'sonarr-key-0001' };
    const arrClient = {
      fetchSeries: jest.fn().mockResolvedValue([
        { id: 14, title: 'Beyblade', titles: [], runtimeSeconds: 1500, sceneNumbering: false },
      ]),
      fetchEpisodes: jest.fn().mockResolvedValue([
        { season: 1, episode: 29, title: 'Play It Again, Dizzi!', runtimeSeconds: 1500, absoluteNumber: 29 },
      ]),
      fetchMovies: jest.fn(),
    };
    const searchVideos = jest.fn().mockResolvedValue([{
      youtubeId: 'g7VYYfoNaf0',
      title: 'BEYBLADE EN Episode 29: Play it Again Dizzi!',
      channelName: 'BEYBLADE Official',
      duration: 1318,
      publishedAt: '2020-08-30T16:00:24.000Z',
    }]);
    const noRows = { findAll: jest.fn().mockResolvedValue([]) };
    const { service } = setup(
      {
        arrBridgeEnabled: true,
        arrBridgeApiKey: KEY,
        arrBridgeSonarrUrl: sonarr.url,
        arrBridgeSonarrApiKey: sonarr.apiKey,
        preferredResolution: '1080',
      },
      { searchVideos, createClient: () => arrClient, models: { ArrBridgeGrab: noRows, Video: noRows, ChannelVideo: noRows, Job: {} } }
    );

    const response = await service.newznab.handleApi(
      { t: 'tvsearch', apikey: KEY, cat: '5030,5040', title: 'Beyblade', season: '1', ep: '29' },
      'http://youtarr:3011'
    );

    expect(arrClient.fetchSeries).toHaveBeenCalledWith(sonarr);
    expect(arrClient.fetchEpisodes).toHaveBeenCalledWith(sonarr, 14);
    expect(searchVideos).toHaveBeenCalledWith('Beyblade Play It Again Dizzi', 25);
    expect(response.body).toContain('Beyblade.S01E29.1080p.WEB-DL-BEYBLADEOfficial');
  });

  describe('createUploadDateLookup', () => {
    function lookup({ videos = [], channelVideos = [] }) {
      const Video = { findAll: jest.fn().mockResolvedValue(videos) };
      const ChannelVideo = { findAll: jest.fn().mockResolvedValue(channelVideos) };
      return { knownUploadDates: createUploadDateLookup({ Video, ChannelVideo }), Video, ChannelVideo };
    }

    test('prefers the exact date of a downloaded video', async () => {
      const { knownUploadDates } = lookup({
        videos: [{ youtubeId: 'a', originalDate: '20240301' }],
        channelVideos: [{ youtube_id: 'a', publishedAt: '2024-02-27T00:00:00.000Z', published_at_source: 'approximate' }],
      });
      const dates = await knownUploadDates(['a']);
      expect(dates.get('a')).toEqual(new Date('2024-03-01T00:00:00.000Z'));
    });

    test('uses a channel listing date, which at least stays the same between searches', async () => {
      const { knownUploadDates } = lookup({
        channelVideos: [{ youtube_id: 'b', publishedAt: '2023-07-04T10:00:00.000Z', published_at_source: null }],
      });
      expect((await knownUploadDates(['b'])).get('b')).toEqual(new Date('2023-07-04T10:00:00.000Z'));
    });

    test('ignores placeholder and unreadable dates', async () => {
      const { knownUploadDates } = lookup({
        videos: [{ youtubeId: 'c', originalDate: 'unknown' }],
        channelVideos: [
          { youtube_id: 'c', publishedAt: '2023-07-04T10:00:00.000Z', published_at_source: 'estimated' },
          { youtube_id: 'd', publishedAt: 'not a date', published_at_source: 'exact' },
        ],
      });
      const dates = await knownUploadDates(['c', 'd']);
      expect(dates.size).toBe(0);
    });

    test('skips both queries for an empty list', async () => {
      const { knownUploadDates, Video, ChannelVideo } = lookup({});
      expect((await knownUploadDates([])).size).toBe(0);
      expect(Video.findAll).not.toHaveBeenCalled();
      expect(ChannelVideo.findAll).not.toHaveBeenCalled();
    });
  });
});
