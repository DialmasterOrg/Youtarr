/* eslint-env jest */
const { Op } = require('sequelize');
const { createArrBridgeService, createUploadDateLookup, createLibraryResolutionLookup } = require('../arrBridgeService');

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
  const executor = {
    start: jest.fn(),
    stop: jest.fn(),
    wake: jest.fn(),
    handleJobEnded: jest.fn(),
    retryNow: jest.fn().mockResolvedValue('started'),
    blockStatus: jest.fn(() => ({ active: false, nextTryAt: null })),
    isRetryRequested: jest.fn(() => false),
  };
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
  const service = createArrBridgeService({
    configModule,
    models: { ArrBridgeGrab: {}, Video: {}, ChannelVideo: {}, Job: {} },
    searchVideos: jest.fn(),
    probeResolution: jest.fn().mockResolvedValue(null),
    isYoutubeApiAvailable: () => false,
    ...overrides,
    downloader: jest.fn(),
    jobLookup: jest.fn(),
    storageGuard: { isPausedError: () => false, getStatus: () => ({ paused: overrides.paused === true }) },
    isArchived: () => false,
    getActivity: () => null,
    logger,
    createExecutor: (deps) => {
      executor.deps = deps;
      return executor;
    },
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
    const beyblade = { id: 14, title: 'Beyblade', titles: [], year: null, runtimeSeconds: 1500, sceneNumbering: false };
    const arrClient = {
      fetchParsedEpisode: jest.fn().mockResolvedValue({ series: beyblade, episodes: [] }),
      fetchSeriesById: jest.fn().mockResolvedValue(beyblade),
      fetchSeries: jest.fn().mockResolvedValue([beyblade]),
      fetchEpisodes: jest.fn().mockResolvedValue([
        { season: 1, episode: 29, title: 'Play It Again, Dizzi!', runtimeSeconds: 1500, absoluteNumber: 29 },
      ]),
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

    expect(arrClient.fetchParsedEpisode).toHaveBeenCalledWith(sonarr, 'Beyblade.S01E29.480p.YT.WEB-DL-YOUTARR');
    expect(arrClient.fetchSeriesById).toHaveBeenCalledWith(sonarr, 14);
    expect(arrClient.fetchEpisodes).toHaveBeenCalledWith(sonarr, 14);
    expect(searchVideos).toHaveBeenCalledWith('Beyblade "Play It Again Dizzi"', 25, {
      useApi: true, onApiUnits: expect.any(Function),
    });
    expect(response.body).toContain('Beyblade.S01E29.1080p.YT.WEB-DL-BEYBLADEOfficial');
  });

  test('a search labels each release with the resolution the probe reports', async () => {
    const searchVideos = jest.fn().mockResolvedValue([{
      youtubeId: 'g7VYYfoNaf0',
      title: 'Beyblade S01E29',
      channelName: 'BEYBLADE Official',
      duration: 1318,
      publishedAt: '2020-08-30T16:00:24.000Z',
    }]);
    const probeResolution = jest.fn().mockResolvedValue(480);
    const noRows = { findAll: jest.fn().mockResolvedValue([]) };
    const { service } = setup(
      { arrBridgeEnabled: true, arrBridgeApiKey: KEY, preferredResolution: '1080' },
      { searchVideos, probeResolution, models: { ArrBridgeGrab: noRows, Video: noRows, ChannelVideo: noRows, Job: {} } }
    );

    const response = await service.newznab.handleApi(
      { t: 'tvsearch', apikey: KEY, cat: '5030,5040', title: 'Beyblade', season: '1', ep: '29' },
      'http://youtarr:3011'
    );

    expect(probeResolution).toHaveBeenCalledWith('g7VYYfoNaf0');
    expect(response.body).toContain('Beyblade.S01E29.480p.YT.WEB-DL-BEYBLADEOfficial');
  });

  describe('daily API share', () => {
    // One service, so its budget carries over from search to search.
    const makeService = (searchVideos, overrides = {}) => {
      const noRows = { findAll: jest.fn().mockResolvedValue([]) };
      return setup(
        { arrBridgeEnabled: true, arrBridgeApiKey: KEY, preferredResolution: '1080' },
        { searchVideos, models: { ArrBridgeGrab: noRows, Video: noRows, ChannelVideo: noRows, Job: {} }, ...overrides }
      ).service;
    };
    const tv = (service, query) => service.newznab.handleApi(
      { t: 'tvsearch', apikey: KEY, cat: '5030,5040', ...query }, 'http://youtarr:3011'
    );
    const episode = { title: 'Bluey', season: '1', ep: '1' };
    const spendsEverything = () => jest.fn().mockImplementation(async (_query, _count, options) => {
      options.onApiUnits(5000);
      return [];
    });

    test('a search under the share uses the API and reports its units to the budget', async () => {
      const searchVideos = spendsEverything();
      const service = makeService(searchVideos);
      await tv(service, episode);
      expect(searchVideos.mock.calls[0][2]).toEqual({ useApi: true, onApiUnits: expect.any(Function) });

      await tv(service, { ...episode, title: 'Peppa' });
      expect(searchVideos.mock.calls[1][2].useApi).toBe(false);
    });

    test('the wrapped search hands the results back unchanged, under and over the share', async () => {
      const resultFor = (name) => [{
        youtubeId: `id-${name}`, title: `${name} S01E01`, channelName: `${name} Official`,
        duration: 1318, publishedAt: '2020-08-30T16:00:24.000Z',
      }];
      const returned = [];
      const searchVideos = jest.fn().mockImplementation(async (query, _count, options) => {
        options.onApiUnits(5000);
        const found = resultFor(query.split(' ')[0]);
        returned.push(found);
        return found;
      });
      const service = makeService(searchVideos);
      const under = await tv(service, episode);
      const over = await tv(service, { ...episode, title: 'Peppa' });
      expect(searchVideos.mock.calls.map((call) => call[2].useApi)).toEqual([true, false]);
      expect(under.body).toContain('Bluey.S01E01');
      expect(over.body).toContain('Peppa.S01E01');
      expect(returned).toEqual([resultFor('Bluey'), resultFor('Peppa')]);
    });

    test('a daily request over the share still uses the API', async () => {
      const searchVideos = spendsEverything();
      const service = makeService(searchVideos, { isYoutubeApiAvailable: () => true });
      await tv(service, episode);
      await tv(service, { title: 'Last Week Tonight', season: '2025', ep: '02/16' });
      expect(searchVideos).toHaveBeenCalledTimes(2);
      expect(searchVideos.mock.calls[1][2].useApi).toBe(true);
    });
  });

  test('removes the library copy of a handed-off grab once the connected Sonarr recorded its import', async () => {
    const sonarr = { url: 'http://sonarr:8989', apiKey: 'sonarr-key-0001' };
    const grab = {
      id: '9b89e5bc-8c90-4e72-b245-270fed2eacc2',
      youtube_id: 'g7VYYfoNaf0',
      kind: 'tv',
      status: 'removed',
      library_copy: 'owned',
      removed_at: new Date(),
    };
    const ArrBridgeGrab = {
      update: jest.fn(async (values) => {
        Object.assign(grab, values);
        return [1];
      }),
      findAll: jest.fn(async ({ where }) => (where.library_copy === grab.library_copy ? [grab] : [])),
    };
    const Video = { findOne: jest.fn().mockResolvedValue({ youtubeId: grab.youtube_id, filePath: null }) };
    const removeVideo = jest.fn().mockResolvedValue(true);
    const arrClient = { fetchImported: jest.fn().mockResolvedValue(true) };
    const { executor } = setup(
      {
        arrBridgeEnabled: true,
        arrBridgeApiKey: KEY,
        arrBridgeRemoveAfterImport: true,
        arrBridgeSonarrUrl: sonarr.url,
        arrBridgeSonarrApiKey: sonarr.apiKey,
      },
      { removeVideo, createClient: () => arrClient, models: { ArrBridgeGrab, Video, ChannelVideo: {}, Job: {} } }
    );

    await executor.deps.onHandedOff(grab);
    expect(grab.library_copy).toBe('remove');

    await executor.deps.settleLibraryCopies();

    expect(arrClient.fetchImported).toHaveBeenCalledWith(sonarr, grab.id);
    expect(removeVideo).toHaveBeenCalledWith('g7VYYfoNaf0', expect.objectContaining({ detail: 'after Sonarr imported it' }));
    expect(grab.library_copy).toBe('removed');
  });

  test('exposes the settings the Settings page works with, sharing the bridge key', () => {
    const { service, configModule } = setup({ arrBridgeEnabled: true });
    service.start();

    expect(service.settings.getOrCreateKey()).toBe(configModule.config.arrBridgeApiKey);
    expect(service.settings.getStatus().stagingRoot).toBe('/data/.arr-staging');
    expect(configModule.updateConfig).toHaveBeenCalledTimes(1);
  });

  describe('retryGrab', () => {
    const GRAB_ID = '9b89e5bc-8c90-4e72-b245-270fed2eacc2';

    test('has the executor try the grab now and passes its answer on', async () => {
      const { service, executor } = setup({ arrBridgeEnabled: true });
      executor.retryNow.mockResolvedValue('queued');

      await expect(service.retryGrab(GRAB_ID)).resolves.toBe('queued');
      expect(executor.retryNow).toHaveBeenCalledWith(GRAB_ID);
    });

    test.each([['not-a-grab-id'], [undefined], [['a', 'b']]])('answers null for the id %p without asking the executor', async (id) => {
      const { service, executor } = setup({ arrBridgeEnabled: true });

      await expect(service.retryGrab(id)).resolves.toBeNull();
      expect(executor.retryNow).not.toHaveBeenCalled();
    });
  });

  describe('retryGrab while the bridge is off', () => {
    test('answers null without asking the executor', async () => {
      const { service, executor } = setup({ arrBridgeEnabled: false });

      await expect(service.retryGrab('9b89e5bc-8c90-4e72-b245-270fed2eacc2')).resolves.toBeNull();
      expect(executor.retryNow).not.toHaveBeenCalled();
    });
  });

  describe('the grab executor', () => {
    test('is told which cookie file is in use and whether downloads are paused', () => {
      const getCookieKey = () => 'cookie-key';
      const { executor } = setup({ arrBridgeEnabled: true }, { getCookieKey, paused: true });

      expect(executor.deps.getCookieKey).toBe(getCookieKey);
      expect(executor.deps.isPaused()).toBe(true);
    });
  });

  describe('listRecentGrabs', () => {
    const CREATED = new Date('2025-06-10T10:00:00.000Z');
    const COMPLETED = new Date('2025-06-10T10:05:00.000Z');
    const REMOVED = new Date('2025-06-10T10:07:00.000Z');
    const grabRow = {
      id: '9b89e5bc-8c90-4e72-b245-270fed2eacc2',
      youtube_id: 'g7VYYfoNaf0',
      kind: 'tv',
      category: 'tv',
      release_title: 'Beyblade.S01E29.1080p.WEB-DL-BEYBLADEOfficial',
      status: 'removed',
      job_id: 'job-1',
      staged_path: '/data/.arr-staging/tv/x/x.mp4',
      fail_message: null,
      created_at: CREATED,
      completed_at: COMPLETED,
      removed_at: REMOVED,
    };

    function withRows(rows, count = rows.length, { paused = false } = {}) {
      const ArrBridgeGrab = { findAndCountAll: jest.fn().mockResolvedValue({ rows, count }) };
      const { service, executor } = setup(
        { arrBridgeEnabled: true },
        { models: { ArrBridgeGrab, ArrBridgeSearch: {}, Video: {}, ChannelVideo: {}, Job: {} }, paused }
      );
      return { service, ArrBridgeGrab, executor };
    }

    test('describes each grab of the page with its state and the title of the video Youtarr holds', async () => {
      const video = { youTubeVideoName: 'BEYBLADE EN Episode 29', youTubeChannelName: 'BEYBLADE Official' };
      const { service, ArrBridgeGrab } = withRows([{ ...grabRow, video }], 31);

      expect(await service.listRecentGrabs({ page: '2', pageSize: '20', q: 'beyblade' })).toEqual({
        grabs: [{
          id: grabRow.id,
          releaseTitle: grabRow.release_title,
          youtubeId: 'g7VYYfoNaf0',
          videoTitle: 'BEYBLADE EN Episode 29',
          channelName: 'BEYBLADE Official',
          kind: 'tv',
          category: 'tv',
          state: 'handed-off',
          failMessage: null,
          blockedAt: null,
          nextTryAt: null,
          retryRequested: false,
          downloadsPaused: false,
          hiddenUntil: null,
          libraryCopy: null,
          createdAt: CREATED,
          completedAt: COMPLETED,
          removedAt: REMOVED,
        }],
        total: 31,
        page: 2,
        pageSize: 20,
      });
      expect(ArrBridgeGrab.findAndCountAll.mock.calls[0][0]).toMatchObject({ limit: 20, offset: 20 });
    });

    test.each([
      ['remove', 'checking'],
      ['removed', 'removed'],
      ['kept', 'kept'],
      ['owned', null],
      [null, null],
    ])('reports a library copy stored as %p as %p', async (stored, shown) => {
      const { service } = withRows([{ ...grabRow, library_copy: stored }]);

      const { grabs: [grab] } = await service.listRecentGrabs();

      expect(grab.libraryCopy).toBe(shown);
    });

    test('leaves the titles empty for a video Youtarr does not hold', async () => {
      const { service } = withRows([{ ...grabRow, status: 'failed', fail_message: 'Video unavailable', video: null }]);

      const { grabs: [grab] } = await service.listRecentGrabs();

      expect(grab).toMatchObject({ videoTitle: null, channelName: null, state: 'failed', failMessage: 'Video unavailable' });
    });

    describe('while YouTube blocks downloads', () => {
      const BLOCKED = new Date('2025-06-10T10:02:00.000Z');
      const NEXT_TRY = new Date('2025-06-10T11:02:00.000Z');
      const waitingRow = { ...grabRow, status: 'pending', completed_at: null, removed_at: null };

      test('shows a grab whose download was blocked as blocked, with the next try', async () => {
        const { service, executor } = withRows([{ ...waitingRow, blocked_at: BLOCKED }]);
        executor.blockStatus.mockReturnValue({ active: true, nextTryAt: NEXT_TRY });

        const { grabs: [grab] } = await service.listRecentGrabs();

        expect(grab).toMatchObject({ state: 'blocked', blockedAt: BLOCKED, nextTryAt: NEXT_TRY, failMessage: null });
      });

      test('shows a grab that waits behind another grab\'s block as blocked, without a block of its own', async () => {
        const { service, executor } = withRows([{ ...waitingRow, blocked_at: null }]);
        executor.blockStatus.mockReturnValue({ active: true, nextTryAt: NEXT_TRY });

        const { grabs: [grab] } = await service.listRecentGrabs();

        expect(grab).toMatchObject({ state: 'blocked', blockedAt: null, nextTryAt: NEXT_TRY });
      });

      test('says which blocked grab has a "Try again" still to be carried out', async () => {
        const other = { ...waitingRow, id: '3c1d6a52-0d6c-4f0e-9a3b-5f2f7f1f0a11', blocked_at: BLOCKED };
        const { service, executor } = withRows([{ ...waitingRow, blocked_at: BLOCKED }, other]);
        executor.blockStatus.mockReturnValue({ active: true, nextTryAt: NEXT_TRY });
        executor.isRetryRequested.mockImplementation((id) => id === other.id);

        const { grabs } = await service.listRecentGrabs();

        expect(grabs.map((grab) => grab.retryRequested)).toEqual([false, true]);
      });

      test('says on blocked grabs that downloads are paused, and on no other grab', async () => {
        const { service, executor } = withRows([{ ...waitingRow, blocked_at: BLOCKED }, grabRow], 2, { paused: true });
        executor.blockStatus.mockReturnValue({ active: true, nextTryAt: NEXT_TRY });
        executor.isRetryRequested.mockReturnValue(true);

        const { grabs } = await service.listRecentGrabs();

        expect(grabs.map(({ downloadsPaused, retryRequested }) => ({ downloadsPaused, retryRequested }))).toEqual([
          { downloadsPaused: true, retryRequested: true },
          { downloadsPaused: false, retryRequested: false },
        ]);
      });

      test('gives the next try only to the grabs that wait for it', async () => {
        const { service, executor } = withRows([{ ...waitingRow, status: 'queued', blocked_at: BLOCKED }, grabRow]);
        executor.blockStatus.mockReturnValue({ active: true, nextTryAt: NEXT_TRY });

        const { grabs } = await service.listRecentGrabs();

        expect(grabs.map(({ state, blockedAt, nextTryAt }) => ({ state, blockedAt, nextTryAt }))).toEqual([
          { state: 'downloading', blockedAt: null, nextTryAt: null },
          { state: 'handed-off', blockedAt: null, nextTryAt: null },
        ]);
      });
    });

    test('says until when a failed grab\'s video stays hidden from searches', async () => {
      const failedAt = new Date(Date.now() - 60 * 60 * 1000);
      const { service } = withRows([{
        ...grabRow, status: 'failed', fail_message: 'Video unavailable', completed_at: failedAt, video: null,
      }]);

      const { grabs: [grab] } = await service.listRecentGrabs();

      expect(grab.hiddenUntil).toEqual(new Date(failedAt.getTime() + 7 * 24 * 60 * 60 * 1000));
    });

    test('lists nothing when nothing was grabbed', async () => {
      const { service } = withRows([]);

      expect(await service.listRecentGrabs()).toEqual({ grabs: [], total: 0, page: 1, pageSize: 10 });
    });
  });

  describe('listRecentSearches', () => {
    const ORIGIN = 'http://youtarr:3011';
    const episode = { t: 'tvsearch', cat: '5030,5040', title: 'Bluey', season: '1', ep: '1' };
    // Resolves once the stored writes that are under way have finished.
    const stored = () => new Promise((resolve) => {
      setImmediate(resolve);
    });
    const makeService = () => {
      const noRows = { findAll: jest.fn().mockResolvedValue([]) };
      const ArrBridgeSearch = {
        ...noRows,
        create: jest.fn().mockResolvedValue({}),
        destroy: jest.fn().mockResolvedValue(0),
        findAndCountAll: jest.fn().mockResolvedValue({ rows: [], count: 0 }),
      };
      const { service } = setup(
        { arrBridgeEnabled: true, arrBridgeApiKey: KEY, preferredResolution: '1080' },
        {
          searchVideos: jest.fn().mockResolvedValue([]),
          models: { ArrBridgeGrab: noRows, ArrBridgeSearch, Video: noRows, ChannelVideo: noRows, Job: {} },
        }
      );
      return { service, ArrBridgeSearch };
    };

    test('stores each search the indexer answered', async () => {
      const { service, ArrBridgeSearch } = makeService();

      await service.newznab.handleApi({ ...episode, apikey: KEY }, ORIGIN);
      await service.newznab.handleApi({ ...episode, title: 'Peppa', apikey: KEY }, ORIGIN);
      await stored();

      expect(ArrBridgeSearch.create.mock.calls.map(([row]) => row)).toEqual([
        expect.objectContaining({ shape: 'episode', outcome: 'nothing', search_text: 'Bluey S01E01' }),
        expect.objectContaining({ shape: 'episode', outcome: 'nothing', search_text: 'Peppa S01E01' }),
      ]);
    });

    test('a request with a wrong key, and a caps request, are not stored', async () => {
      const { service, ArrBridgeSearch } = makeService();

      await service.newznab.handleApi({ ...episode, apikey: 'wrong' }, ORIGIN);
      await service.newznab.handleApi({ t: 'caps', apikey: KEY }, ORIGIN);
      await stored();

      expect(ArrBridgeSearch.create).not.toHaveBeenCalled();
    });

    test('a search is answered even when it cannot be stored', async () => {
      const { service, ArrBridgeSearch } = makeService();
      ArrBridgeSearch.create.mockRejectedValue(new Error('db down'));

      const answer = await service.newznab.handleApi({ ...episode, apikey: KEY }, ORIGIN);
      await stored();

      expect(answer.status).toBe(200);
    });

    test('reads a page of the stored searches', async () => {
      const { service, ArrBridgeSearch } = makeService();

      expect(await service.listRecentSearches({ page: '2', q: 'bluey' })).toEqual({
        searches: [], total: 0, page: 2, pageSize: 10,
      });
      expect(ArrBridgeSearch.findAndCountAll.mock.calls[0][0]).toMatchObject({ limit: 10, offset: 10 });
    });
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

  describe('createLibraryResolutionLookup', () => {
    // Applies the query's id and removed conditions, as the database would.
    function lookup(rows) {
      const Video = {
        findAll: jest.fn(async ({ where }) => rows.filter((row) => (
          where.youtubeId[Op.in].includes(row.youtubeId)
          && (where.removed === undefined || row.removed === where.removed)
        ))),
      };
      return { libraryResolutions: createLibraryResolutionLookup({ Video }), Video };
    }
    const row = (youtubeId, videoResolution, removed = false) => ({
      youtubeId, video_resolution: videoResolution, removed,
    });

    test('reads each stored pixel size as the resolution Sonarr will see', async () => {
      const { libraryResolutions } = lookup([row('a', '1920x1080'), row('b', '640x360'), row('c', '1920x960')]);

      const tiers = await libraryResolutions(['a', 'b', 'c']);

      expect(tiers).toEqual(new Map([['a', 1080], ['b', 480], ['c', 1080]]));
    });

    test.each([
      ['a failed probe (0x0)', row('a', '0x0')],
      ['no stored size', row('a', null)],
      ['an unreadable size', row('a', '1080p')],
      ['a removed row', row('a', '1920x1080', true)],
    ])('treats %s as unknown, not as 480', async (_label, stored) => {
      const { libraryResolutions } = lookup([stored]);

      expect(await libraryResolutions(['a'])).toEqual(new Map());
    });

    test('asks nothing for an empty list', async () => {
      const { libraryResolutions, Video } = lookup([]);

      expect(await libraryResolutions([])).toEqual(new Map());
      expect(Video.findAll).not.toHaveBeenCalled();
    });
  });
});
