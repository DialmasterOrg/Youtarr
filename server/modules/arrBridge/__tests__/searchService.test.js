/* eslint-env jest */
const { createSearchService, estimateBytes, decodeHtmlEntities } = require('../searchService');
const { createSearchQueue, SearchUnavailableError } = require('../searchQueue');
const { parseNewznabRequest } = require('../newznabRequest');
const { parseNzbLink } = require('../nzbFile');
const { renderSearch } = require('../newznabXml');
const { createVideoResolution, LOOKUP_BUDGET_MS } = require('../videoResolution');

const ORIGIN = 'http://youtarr:3011';
const KEY = 'k'.repeat(64);
const NOW = new Date('2025-06-01T00:00:00.000Z');
const SONARR_CATS = '5030,5040';
const NO_API = { needsApi: false };
const RADARR_CATS = '2000,2010,2020,2030,2040,2045,2050,2060';

let nextId = 0;
function video(title, overrides = {}) {
  nextId += 1;
  return {
    youtubeId: `vid${String(nextId).padStart(8, '0')}`,
    title,
    channelName: 'NBC',
    duration: 22 * 60,
    publishedAt: '2024-03-01T12:00:00.000Z',
    ...overrides,
  };
}

function request(query) {
  const parsed = parseNewznabRequest(query);
  expect(parsed.ok).toBe(true);
  return parsed.request;
}

function setup({
  results = [], config = {}, apiAvailable = true, failedIds = [], knownDates = new Map(), catalog, videoResolution,
  now = () => NOW,
} = {}) {
  // An array answers every query; an object answers by query text.
  const searchVideos = Array.isArray(results)
    ? jest.fn().mockResolvedValue(results)
    : jest.fn(async (query) => results[query] ?? []);
  const deps = {
    catalog,
    videoResolution,
    searchVideos,
    isYoutubeApiAvailable: jest.fn(() => apiAvailable),
    getConfig: () => ({ arrBridgeEnabled: true, arrBridgeApiKey: KEY, preferredResolution: '1080', ...config }),
    knownUploadDates: jest.fn().mockResolvedValue(knownDates),
    recentlyFailedIds: jest.fn().mockResolvedValue(new Set(failedIds)),
    queue: { run: (_key, work) => work() },
    now,
    logger: { info: jest.fn(), debug: jest.fn(), warn: jest.fn() },
  };
  return { service: createSearchService(deps), deps, searchVideos };
}

const episodeQuery = (overrides = {}) => ({
  t: 'tvsearch', cat: SONARR_CATS, title: 'The Office (US)', season: '1', ep: '2', ...overrides,
});

describe('searchService', () => {
  beforeEach(() => {
    nextId = 0;
  });

  describe('requests answered without a search', () => {
    test('RSS returns the TV placeholder, which keeps the indexer Test passing', async () => {
      const { service, searchVideos } = setup();

      const items = await service.search(request({ t: 'tvsearch', cat: SONARR_CATS }), ORIGIN);

      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({
        title: 'Youtarr.Bridge.Placeholder.S01E01.480p.YT.WEB-DL-YOUTARR',
        kind: 'tv',
        pubDate: new Date('2020-01-01T00:00:00.000Z'),
      });
      expect(items[0].link).toContain('id=placeholder');
      expect(items[0].link).not.toContain(KEY);
      expect(searchVideos).not.toHaveBeenCalled();
    });

    test('RSS for movie categories returns the movie placeholder', async () => {
      const { service } = setup();
      const items = await service.search(request({ t: 'movie', cat: RADARR_CATS }), ORIGIN);
      expect(items[0]).toMatchObject({ title: 'Youtarr.Bridge.Placeholder.1900.480p.YT.WEB-DL-YOUTARR', kind: 'movie' });
    });

    test('RSS without categories returns the TV placeholder (Prowlarr Test)', async () => {
      const { service } = setup();
      const items = await service.search(request({ t: 'search' }), ORIGIN);
      expect(items[0].kind).toBe('tv');
    });

    test('an empty-shaped request returns nothing', async () => {
      const { service, searchVideos } = setup({ results: [video('The Office S01E02')] });
      expect(await service.search(request({ t: 'tvsearch', cat: SONARR_CATS, q: 'Bluey' }), ORIGIN)).toEqual([]);
      expect(searchVideos).not.toHaveBeenCalled();
    });

    test('a daily request without a YouTube API key returns nothing', async () => {
      const { service, searchVideos } = setup({ apiAvailable: false });
      const daily = request({ t: 'tvsearch', cat: SONARR_CATS, title: 'Last Week Tonight', season: '2025', ep: '02/16' });
      expect(await service.search(daily, ORIGIN)).toEqual([]);
      expect(searchVideos).not.toHaveBeenCalled();
    });

    test('a daily request without a YouTube API key logs one info line, not a warning', async () => {
      const { service, deps } = setup({ apiAvailable: false });
      const daily = request({ t: 'tvsearch', cat: SONARR_CATS, title: 'Last Week Tonight', season: '2025', ep: '02/16' });
      await service.search(daily, ORIGIN);
      expect(deps.logger.warn).not.toHaveBeenCalled();
      expect(deps.logger.info).toHaveBeenCalledTimes(1);
      expect(deps.logger.info).toHaveBeenCalledWith(
        { shape: 'daily' },
        'Sonarr/Radarr daily search skipped: the YouTube API is not available'
      );
    });

    test('a daily request with empty text while the API is available stays silent', async () => {
      const { service, deps } = setup({ apiAvailable: true });
      const daily = request({ t: 'tvsearch', cat: SONARR_CATS, title: '!!!', season: '2025', ep: '02/16' });
      expect(await service.search(daily, ORIGIN)).toEqual([]);
      expect(deps.logger.warn).not.toHaveBeenCalled();
    });

    test('other unsearchable requests stay silent', async () => {
      const { service, deps } = setup();
      await service.search(request({ t: 'tvsearch', cat: SONARR_CATS, q: 'Bluey' }), ORIGIN);
      expect(deps.logger.warn).not.toHaveBeenCalled();
    });

    test('text with nothing usable returns nothing', async () => {
      const { service, searchVideos } = setup({ results: [video('S01E02')] });
      expect(await service.search(request(episodeQuery({ title: '!!!' })), ORIGIN)).toEqual([]);
      expect(searchVideos).not.toHaveBeenCalled();
    });
  });

  describe('episode requests', () => {
    test('searches YouTube for the series and episode code', async () => {
      const { service, searchVideos } = setup();
      await service.search(request(episodeQuery()), ORIGIN);
      expect(searchVideos).toHaveBeenCalledWith('The Office US S01E02', 25, NO_API);
    });

    test('names matching candidates from the title Sonarr sent', async () => {
      const match = video('The Office S01E02 Diversity Day');
      const { service } = setup({ results: [match, video('The Office S01E03')] });

      const items = await service.search(request(episodeQuery()), ORIGIN);

      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({
        title: 'The.Office.US.S01E02.1080p.YT.WEB-DL-NBC',
        guid: `youtarr-${match.youtubeId}-tv`,
        comments: `https://www.youtube.com/watch?v=${match.youtubeId}`,
        pubDate: new Date('2024-03-01T12:00:00.000Z'),
        kind: 'tv',
        youtubeId: match.youtubeId,
      });
    });

    test('uses the AKA name when only a cleaned q was sent', async () => {
      const { service } = setup({ results: [video('The Office S01E02')] });
      const items = await service.search(request(episodeQuery({ title: undefined, q: 'Office' })), ORIGIN);
      expect(items[0].title).toBe('Office.AKA.The.Office.S01E02.1080p.YT.WEB-DL-NBC');
    });

    test('the link carries what the grab needs and parses back', async () => {
      const match = video('The Office S01E02');
      const { service } = setup({ results: [match] });

      const [item] = await service.search(request(episodeQuery()), ORIGIN);

      const url = new URL(item.link);
      expect(url.origin).toBe(ORIGIN);
      expect(url.searchParams.get('apikey')).toBe(KEY);
      const fields = parseNzbLink(decodeURIComponent(url.pathname.split('/').pop()), Object.fromEntries(url.searchParams));
      expect(fields).toEqual({
        youtubeId: match.youtubeId,
        kind: 'tv',
        releaseTitle: item.title,
        uploadDate: new Date('2024-03-01T12:00:00.000Z'),
        estimatedBytes: estimateBytes(22 * 60, 1080),
      });
    });

    test('the feed still reports size 0 although the link carries an estimate', async () => {
      const { service } = setup({ results: [video('The Office S01E02')] });
      const items = await service.search(request(episodeQuery()), ORIGIN);
      expect(renderSearch(items)).toContain('<newznab:attr name="size" value="0"/>');
    });

    test('labels the release with the configured resolution', async () => {
      const { service } = setup({ results: [video('The Office S01E02')], config: { preferredResolution: '1440' } });
      const items = await service.search(request(episodeQuery()), ORIGIN);
      expect(items[0].title).toContain('.1080p.YT.WEB-DL-');
    });

    test('the bridge\'s own resolution replaces the preferred resolution in the label', async () => {
      const { service } = setup({
        results: [video('The Office S01E02')], config: { preferredResolution: '480', arrBridgeResolution: '2160' },
      });
      const items = await service.search(request(episodeQuery()), ORIGIN);
      expect(items[0].title).toContain('.2160p.YT.WEB-DL-');
    });

    test('tells two candidates apart by group and gives each its own guid', async () => {
      const { service } = setup({
        results: [
          video('The Office S01E02', { channelName: 'NBC' }),
          video('The Office S01E02', { channelName: 'Peacock' }),
        ],
      });
      const items = await service.search(request(episodeQuery()), ORIGIN);
      expect(items.map((item) => item.title)).toEqual([
        'The.Office.US.S01E02.1080p.YT.WEB-DL-NBC',
        'The.Office.US.S01E02.1080p.YT.WEB-DL-Peacock',
      ]);
      expect(new Set(items.map((item) => item.guid)).size).toBe(2);
    });

    test('offers only the first of two candidates that would share a release title', async () => {
      const first = video('The Office S01E02 part one');
      const { service } = setup({ results: [first, video('The Office S01E02 part two')] });
      const items = await service.search(request(episodeQuery()), ORIGIN);
      expect(items.map((item) => item.youtubeId)).toEqual([first.youtubeId]);
    });

    test('the same video keeps its guid under another alias', async () => {
      const match = video('The Office S01E02');
      const { service } = setup({ results: [match] });
      const [byTitle] = await service.search(request(episodeQuery()), ORIGIN);
      const [byAlias] = await service.search(request(episodeQuery({ title: 'The Office' })), ORIGIN);
      expect(byAlias.guid).toBe(byTitle.guid);
      expect(byAlias.title).not.toBe(byTitle.title);
    });

    test('drops a video whose grab failed recently', async () => {
      const failed = video('The Office S01E02', { channelName: 'NBC' });
      const other = video('The Office S01E02', { channelName: 'Peacock' });
      const { service, deps } = setup({ results: [failed, other], failedIds: [failed.youtubeId] });

      const items = await service.search(request(episodeQuery()), ORIGIN);

      expect(items.map((item) => item.youtubeId)).toEqual([other.youtubeId]);
      expect(deps.recentlyFailedIds).toHaveBeenCalledWith([failed.youtubeId, other.youtubeId]);
    });

    test('prefers the upload date Youtarr already knows', async () => {
      const match = video('The Office S01E02');
      const known = new Date('2019-05-05T00:00:00.000Z');
      const { service } = setup({ results: [match], knownDates: new Map([[match.youtubeId, known]]) });
      const [item] = await service.search(request(episodeQuery()), ORIGIN);
      expect(item.pubDate).toEqual(known);
    });

    test('falls back to the current time when no date is known', async () => {
      const { service } = setup({ results: [video('The Office S01E02', { publishedAt: null })] });
      const [item] = await service.search(request(episodeQuery()), ORIGIN);
      expect(item.pubDate).toEqual(NOW);
    });

    test('keeps the source order and honors the limit', async () => {
      const results = ['A', 'B', 'C'].map((name) => video('The Office S01E02', { channelName: name }));
      const { service } = setup({ results });
      const items = await service.search(request(episodeQuery({ limit: '2' })), ORIGIN);
      expect(items.map((item) => item.youtubeId)).toEqual([results[0].youtubeId, results[1].youtubeId]);
    });
  });

  test('a season request names each candidate from its own marker', async () => {
    const { service, searchVideos } = setup({
      results: [video('Bluey S03E01 Obstacle Course'), video('Bluey Season 3 Episode 7'), video('Bluey S02E01')],
    });

    const items = await service.search(
      request({ t: 'tvsearch', cat: SONARR_CATS, title: 'Bluey (2018)', season: '3' }),
      ORIGIN
    );

    expect(searchVideos).toHaveBeenCalledWith('Bluey 2018 season 3', 50, NO_API);
    expect(items.map((item) => item.title)).toEqual([
      'Bluey.2018.S03E01.1080p.YT.WEB-DL-NBC',
      'Bluey.2018.S03E07.1080p.YT.WEB-DL-NBC',
    ]);
  });

  test('a daily request searches by date and keeps videos published that day', async () => {
    const onDay = video('Last Week Tonight: Tariffs', { publishedAt: '2025-02-16T23:30:00.000Z', duration: 30 * 60 });
    const { service, searchVideos } = setup({
      results: [onDay, video('Last Week Tonight: Older', { publishedAt: '2025-02-09T23:30:00.000Z', duration: 30 * 60 })],
    });

    const items = await service.search(
      request({ t: 'tvsearch', cat: SONARR_CATS, title: 'Last Week Tonight', season: '2025', ep: '02/16' }),
      ORIGIN
    );

    expect(searchVideos).toHaveBeenCalledWith('Last Week Tonight February 16 2025', 25, { needsApi: true });
    expect(items.map((item) => item.title)).toEqual(['Last.Week.Tonight.2025.02.16.1080p.YT.WEB-DL-NBC']);
  });

  test('a movie request searches title and year and names the release from the request', async () => {
    const match = video('The Matrix (1999) Full Movie', { duration: 2 * 60 * 60, channelName: 'Warner Bros.' });
    const { service, searchVideos } = setup({ results: [match, video('The Matrix trailer 1999', { duration: 150 })] });

    const items = await service.search(request({ t: 'search', cat: RADARR_CATS, q: 'Matrix 1999' }), ORIGIN);

    expect(searchVideos).toHaveBeenCalledWith('Matrix 1999', 25, NO_API);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      title: 'Matrix.1999.1080p.YT.WEB-DL-WarnerBros',
      guid: `youtarr-${match.youtubeId}-movie`,
      kind: 'movie',
    });
  });

  test('a search that cannot run is an error, never an empty answer', async () => {
    const { service, deps } = setup();
    deps.searchVideos.mockRejectedValue(new Error('yt-dlp timed out'));
    const real = createSearchService({ ...deps, queue: createSearchQueue() });

    await expect(real.search(request(episodeQuery()), ORIGIN)).rejects.toBeInstanceOf(SearchUnavailableError);
    expect(await service.search(request({ t: 'tvsearch', cat: SONARR_CATS }), ORIGIN)).toHaveLength(1);
  });

  test('two alias requests for the same text reuse one YouTube search', async () => {
    const { deps, searchVideos } = setup({ results: [video('The Office S01E02')] });
    const service = createSearchService({ ...deps, queue: createSearchQueue() });

    await service.search(request(episodeQuery()), ORIGIN);
    await service.search(request(episodeQuery()), ORIGIN);

    expect(searchVideos).toHaveBeenCalledTimes(1);
  });

  describe('titles from the YouTube Data API', () => {
    test.each([
      ['It&#39;s All Relative', 'It\'s All Relative'],
      ['Tom &amp; Jerry', 'Tom & Jerry'],
      ['&quot;Quoted&quot;', '"Quoted"'],
      ['It&#x27;s', 'It\'s'],
      ['&lt;b&gt;', '<b>'],
      ['Fish &foo; Chips', 'Fish &foo; Chips'],
      ['&amp;#39;', '&#39;'],
      ['plain', 'plain'],
    ])('decodeHtmlEntities turns %s into %s', (encoded, decoded) => {
      expect(decodeHtmlEntities(encoded)).toBe(decoded);
    });

    test('are decoded before matching', async () => {
      const { service } = setup({ results: [video('Marvel&#39;s Agents of S.H.I.E.L.D. S01E01 Pilot')] });

      const items = await service.search(
        request(episodeQuery({ title: 'Marvel\'s Agents of S.H.I.E.L.D.', ep: '1' })),
        ORIGIN
      );

      expect(items.map((item) => item.title)).toEqual(['Marvels.Agents.of.S.H.I.E.L.D.S01E01.1080p.YT.WEB-DL-NBC']);
    });

    test('channel names are decoded before they become the release group', async () => {
      const { service } = setup({ results: [video('The Office S01E02', { channelName: 'Tom &amp; Jerry' })] });

      const items = await service.search(request(episodeQuery()), ORIGIN);

      expect(items[0].title).toBe('The.Office.US.S01E02.1080p.YT.WEB-DL-TomJerry');
    });
  });

  describe('the resolution in the label', () => {
    const lookupAnswering = (tiers) => ({ lookup: jest.fn().mockResolvedValue(new Map(tiers)) });
    const twoUploads = () => [
      video('The Office S01E02', { youtubeId: 'aaaaaaaaaaa', channelName: 'A' }),
      video('The Office S01E02', { youtubeId: 'bbbbbbbbbbb', channelName: 'B' }),
    ];

    test('is the video\'s real resolution where it is known, else the download resolution', async () => {
      const { service } = setup({ results: twoUploads(), videoResolution: lookupAnswering([['aaaaaaaaaaa', 480]]) });

      const items = await service.search(request(episodeQuery()), ORIGIN);

      expect(items.map((item) => item.title)).toEqual([
        'The.Office.US.S01E02.480p.YT.WEB-DL-A',
        'The.Office.US.S01E02.1080p.YT.WEB-DL-B',
      ]);
    });

    test('never goes above the label limit', async () => {
      const { service } = setup({
        results: twoUploads(),
        config: { arrBridgeLabelLimit: '480' },
        videoResolution: lookupAnswering([['aaaaaaaaaaa', 480]]),
      });

      const items = await service.search(request(episodeQuery()), ORIGIN);

      expect(items.map((item) => item.title)).toEqual([
        'The.Office.US.S01E02.480p.YT.WEB-DL-A',
        'The.Office.US.S01E02.480p.YT.WEB-DL-B',
      ]);
    });

    test('is looked up once, with the label ceiling, for what can be offered', async () => {
      const videoResolution = lookupAnswering([]);
      const results = ['A', 'B', 'C'].map((name) => video('The Office S01E02', { channelName: name, definition: 'sd' }));
      const { service } = setup({ results, videoResolution, failedIds: [results[0].youtubeId] });

      await service.search(request(episodeQuery({ limit: '1' })), ORIGIN);

      expect(videoResolution.lookup).toHaveBeenCalledTimes(1);
      const [candidates, options] = videoResolution.lookup.mock.calls[0];
      expect(candidates).toEqual([expect.objectContaining({ youtubeId: results[1].youtubeId, definition: 'sd' })]);
      expect(options).toEqual({ ceiling: 1080, budgetMs: LOOKUP_BUDGET_MS });
    });

    test('is looked up only for the closest channel\'s upload when only that one is offered', async () => {
      const videoResolution = lookupAnswering([]);
      const catalog = {
        resolveEpisode: jest.fn().mockResolvedValue({
          seriesTitle: 'MrBeast',
          seriesTitles: ['MrBeast'],
          episodeTitle: 'I Granted 100 Kids Their Biggest Wish!',
          otherEpisodeTitles: [],
          runtimeSeconds: 840,
          season: 2026,
          episode: 14,
          absoluteNumber: null,
        }),
        resolveSeries: jest.fn(),
        resolveMovie: jest.fn(),
      };
      const { service } = setup({
        results: [
          video('I Granted 100 Kids Their Biggest Wish! #mrbeast', { youtubeId: 'SaHE3nRRX0w', channelName: 'Rsk', duration: 850 }),
          video('I Granted 100 Kids Their Biggest Wish!', { youtubeId: 'lVylRtlPOIE', channelName: 'MrBeast', duration: 875 }),
        ],
        catalog,
        videoResolution,
      });

      await service.search(request({ t: 'tvsearch', cat: SONARR_CATS, title: 'MrBeast', season: '2026', ep: '14' }), ORIGIN);

      expect(videoResolution.lookup.mock.calls[0][0].map((candidate) => candidate.youtubeId)).toEqual(['lVylRtlPOIE']);
    });

    test('follows the bridge\'s own download resolution', async () => {
      const videoResolution = lookupAnswering([]);
      const { service } = setup({
        results: [video('The Office S01E02')], config: { arrBridgeResolution: '720' }, videoResolution,
      });

      const [item] = await service.search(request(episodeQuery()), ORIGIN);

      expect(videoResolution.lookup.mock.calls[0][1]).toEqual({ ceiling: 720, budgetMs: LOOKUP_BUDGET_MS });
      expect(item.title).toContain('.720p.YT.WEB-DL-');
    });

    test('a request already 70 s old gives the lookup the 10 s left', async () => {
      let clock = NOW.getTime();
      const videoResolution = lookupAnswering([]);
      const { service, searchVideos } = setup({ videoResolution, now: () => new Date(clock) });
      searchVideos.mockImplementation(async () => {
        clock += 70 * 1000;
        return [video('The Office S01E02')];
      });

      await service.search(request(episodeQuery()), ORIGIN);

      expect(videoResolution.lookup.mock.calls[0][1]).toEqual({ ceiling: 1080, budgetMs: 10 * 1000 });
    });

    test('a request 80 s old makes no lookup and labels every release with the ceiling', async () => {
      let clock = NOW.getTime();
      const videoResolution = lookupAnswering([]);
      const { service, searchVideos } = setup({
        videoResolution, config: { arrBridgeLabelLimit: '720' }, now: () => new Date(clock),
      });
      searchVideos.mockImplementation(async () => {
        clock += 80 * 1000;
        return [video('The Office S01E02')];
      });

      const [item] = await service.search(request(episodeQuery()), ORIGIN);

      expect(videoResolution.lookup).not.toHaveBeenCalled();
      expect(item.title).toBe('The.Office.US.S01E02.720p.YT.WEB-DL-NBC');
    });

    describe('with the real lookup', () => {
      function realLookup() {
        const libraryResolutions = jest.fn().mockResolvedValue(new Map());
        const probe = jest.fn().mockResolvedValue(1080);
        const videoResolution = createVideoResolution({
          libraryResolutions, probe, logger: { info: jest.fn(), warn: jest.fn() },
        });
        return { videoResolution, libraryResolutions, probe };
      }

      test.each([
        ['a label limit of 480', { arrBridgeLabelLimit: '480' }],
        ['a download resolution of 480', { preferredResolution: '480' }],
      ])('%s reads no library row and starts no probe', async (_label, config) => {
        const { videoResolution, libraryResolutions, probe } = realLookup();
        const { service } = setup({ results: twoUploads(), config, videoResolution });

        const items = await service.search(request(episodeQuery()), ORIGIN);

        expect(items.map((item) => item.title)).toEqual([
          'The.Office.US.S01E02.480p.YT.WEB-DL-A',
          'The.Office.US.S01E02.480p.YT.WEB-DL-B',
        ]);
        expect(libraryResolutions).not.toHaveBeenCalled();
        expect(probe).not.toHaveBeenCalled();
      });

      test('a label limit of 720 lets an hd definition settle the label without a probe', async () => {
        const { videoResolution, probe } = realLookup();
        const { service } = setup({
          results: [video('The Office S01E02', { definition: 'hd' })],
          config: { arrBridgeLabelLimit: '720' },
          videoResolution,
        });

        const [item] = await service.search(request(episodeQuery()), ORIGIN);

        expect(item.title).toBe('The.Office.US.S01E02.720p.YT.WEB-DL-NBC');
        expect(probe).not.toHaveBeenCalled();
      });
    });

    test('falls back to the download resolution when the lookup fails', async () => {
      const failure = new Error('lookup broke');
      const { service, deps } = setup({
        results: twoUploads(), videoResolution: { lookup: jest.fn().mockRejectedValue(failure) },
      });

      const items = await service.search(request(episodeQuery()), ORIGIN);

      expect(items.map((item) => item.title)).toEqual([
        'The.Office.US.S01E02.1080p.YT.WEB-DL-A',
        'The.Office.US.S01E02.1080p.YT.WEB-DL-B',
      ]);
      expect(deps.logger.warn).toHaveBeenCalledWith(expect.objectContaining({ err: failure }), expect.any(String));
    });

    test('sets the size estimate the link carries', async () => {
      const { service } = setup({ results: twoUploads(), videoResolution: lookupAnswering([['aaaaaaaaaaa', 480]]) });

      const [item] = await service.search(request(episodeQuery()), ORIGIN);

      const url = new URL(item.link);
      const fields = parseNzbLink(decodeURIComponent(url.pathname.split('/').pop()), Object.fromEntries(url.searchParams));
      expect(fields.estimatedBytes).toBe(estimateBytes(22 * 60, 480));
    });
  });

  describe('with a Sonarr or Radarr connection', () => {
    const TITLE_QUERY = 'Beyblade Play It Again Dizzi';
    const CODE_QUERY = 'Beyblade S01E29';
    const beybladeQuery = (overrides = {}) => ({
      t: 'tvsearch', cat: SONARR_CATS, title: 'Beyblade', season: '1', ep: '29', ...overrides,
    });
    const beybladeEpisode = (overrides = {}) => ({
      seriesTitle: 'Beyblade',
      seriesTitles: ['Beyblade'],
      episodeTitle: 'Play It Again, Dizzi!',
      otherEpisodeTitles: ['Bottom of the Ninth', 'Cruising for a Bruising'],
      runtimeSeconds: 1500,
      season: 1,
      episode: 29,
      absoluteNumber: 29,
      ...overrides,
    });
    // What YouTube returned for the title query on 2026-11-15.
    const official = () => video('BEYBLADE EN Episode 29: Play it Again Dizzi!', {
      youtubeId: 'g7VYYfoNaf0', channelName: 'BEYBLADE Official', duration: 1318,
    });
    const classic = () => video('Play it Again Dizzi', {
      youtubeId: 'avUFb3DESfw', channelName: 'Beyblade: The Classic First Season', duration: 1321,
    });
    const double = () => video('BEYBLADE | Ep.29 Play it Again Dizzi! | Ep.30 Cruising for a Bruising', {
      youtubeId: 'b9Xi2xAKqi4', channelName: 'BEYBLADE English - Official Channel', duration: 2635,
    });
    const clip = () => video('Episode 29: Play It Again Dizzi!', {
      youtubeId: 'Ema1nx3zz4g', channelName: 'justin fielding', duration: 6,
    });

    function makeCatalog({ episode = null, series = null, movie = null } = {}) {
      return {
        resolveEpisode: jest.fn().mockResolvedValue(episode),
        resolveSeries: jest.fn().mockResolvedValue(series),
        resolveMovie: jest.fn().mockResolvedValue(movie),
      };
    }

    test('Beyblade S01E29 finds the 22 minute uploads and never the double episode', async () => {
      const catalog = makeCatalog({ episode: beybladeEpisode() });
      const { service, searchVideos } = setup({ results: [official(), clip(), classic(), double()], catalog });

      const items = await service.search(request(beybladeQuery()), ORIGIN);

      expect(catalog.resolveEpisode).toHaveBeenCalledWith({
        text: 'Beyblade', textSource: 'title', season: 1, episode: 29,
      });
      expect(searchVideos).toHaveBeenCalledTimes(1);
      expect(searchVideos).toHaveBeenCalledWith(TITLE_QUERY, 25, NO_API);
      expect(items.map((item) => item.title)).toEqual([
        'Beyblade.S01E29.1080p.YT.WEB-DL-BEYBLADEOfficial',
        'Beyblade.S01E29.1080p.YT.WEB-DL-BeybladeTheClassicFirstSeason',
      ]);
      expect(items.map((item) => item.youtubeId)).toEqual(['g7VYYfoNaf0', 'avUFb3DESfw']);
    });

    // The catalog asks Sonarr about the release name it would offer, which
    // is an AKA name for a q-only request (Prowlarr).
    test('tells the catalog the text came from q', async () => {
      const catalog = makeCatalog();
      const { service } = setup({ catalog });

      await service.search(request({ t: 'tvsearch', cat: SONARR_CATS, q: 'Beyblade', season: '1', ep: '29' }), ORIGIN);
      await service.search(request({ t: 'tvsearch', cat: SONARR_CATS, q: 'Beyblade', season: '1' }), ORIGIN);

      expect(catalog.resolveEpisode).toHaveBeenCalledWith({ text: 'Beyblade', textSource: 'q', season: 1, episode: 29 });
      expect(catalog.resolveSeries).toHaveBeenCalledWith({ text: 'Beyblade', textSource: 'q' });
    });

    test('every alias request of one search shares one YouTube search and keeps its own name', async () => {
      const moneyHeist = {
        seriesTitle: 'Money Heist',
        seriesTitles: ['Money Heist', 'Haus des Geldes'],
        episodeTitle: 'Do as Planned',
        otherEpisodeTitles: [],
        runtimeSeconds: 2820,
        season: 1,
        episode: 1,
        absoluteNumber: null,
      };
      const upload = video('Money Heist - Do as Planned', { duration: 47 * 60, channelName: 'Netflix' });
      const { deps, searchVideos } = setup({ results: [upload], catalog: makeCatalog({ episode: moneyHeist }) });
      const service = createSearchService({ ...deps, queue: createSearchQueue() });
      const aliasQuery = (title) => request({ t: 'tvsearch', cat: SONARR_CATS, title, season: '1', ep: '1' });

      const first = await service.search(aliasQuery('Haus des Geldes'), ORIGIN);
      const second = await service.search(aliasQuery('Money Heist'), ORIGIN);

      expect(searchVideos).toHaveBeenCalledTimes(1);
      expect(searchVideos).toHaveBeenCalledWith('Money Heist Do as Planned', 25, NO_API);
      expect(first[0].title).toBe('Haus.des.Geldes.S01E01.1080p.YT.WEB-DL-Netflix');
      expect(second[0].title).toBe('Money.Heist.S01E01.1080p.YT.WEB-DL-Netflix');
      expect(second[0].guid).toBe(first[0].guid);
    });

    test('leaves a year tag out of the title query', async () => {
      const episode = beybladeEpisode({
        seriesTitle: 'Bluey (2018)', seriesTitles: ['Bluey (2018)', 'Bluey'], episodeTitle: 'Magic Xylophone', runtimeSeconds: 420,
      });
      const { service, searchVideos } = setup({ catalog: makeCatalog({ episode }) });

      await service.search(request(beybladeQuery({ title: 'Bluey (2018)', season: '1', ep: '1' })), ORIGIN);

      expect(searchVideos).toHaveBeenNthCalledWith(1, 'Bluey Magic Xylophone', 25, NO_API);
    });

    test('falls back to the episode code when the title stage offers nothing', async () => {
      const reupload = video('Beyblade S01E29', { duration: 1300, channelName: 'Fan' });
      const { service, searchVideos } = setup({
        results: { [TITLE_QUERY]: [double(), clip()], [CODE_QUERY]: [reupload] },
        catalog: makeCatalog({ episode: beybladeEpisode() }),
      });

      const items = await service.search(request(beybladeQuery()), ORIGIN);

      expect(searchVideos.mock.calls).toEqual([[TITLE_QUERY, 25, NO_API], [CODE_QUERY, 25, NO_API]]);
      expect(items.map((item) => item.youtubeId)).toEqual([reupload.youtubeId]);
    });

    test('falls back when the only title match failed a grab recently', async () => {
      const reupload = video('Beyblade S01E29', { duration: 1300, channelName: 'Fan' });
      const { service } = setup({
        results: { [TITLE_QUERY]: [official()], [CODE_QUERY]: [reupload] },
        failedIds: ['g7VYYfoNaf0'],
        catalog: makeCatalog({ episode: beybladeEpisode() }),
      });

      const items = await service.search(request(beybladeQuery()), ORIGIN);

      expect(items.map((item) => item.youtubeId)).toEqual([reupload.youtubeId]);
    });

    describe('re-uploads beside the series\' own channel (MrBeast S2026E14, 2026-11-15)', () => {
      const mrBeastQuery = () => request({ t: 'tvsearch', cat: SONARR_CATS, title: 'MrBeast', season: '2026', ep: '14' });
      const mrBeastEpisode = () => beybladeEpisode({
        seriesTitle: 'MrBeast',
        seriesTitles: ['MrBeast'],
        episodeTitle: 'I Granted 100 Kids Their Biggest Wish!',
        otherEpisodeTitles: [],
        runtimeSeconds: 840,
        season: 2026,
        episode: 14,
        absoluteNumber: null,
      });
      // In YouTube's order: a re-upload ranks above the show's own video.
      const results = () => [
        video('I Granted 100 Kids Their Biggest Wish! #mrbeast', { youtubeId: 'SaHE3nRRX0w', channelName: 'Rsk', duration: 850 }),
        video('I Granted 100 Kids Their Biggest Wish!', { youtubeId: 'lVylRtlPOIE', channelName: 'MrBeast', duration: 875 }),
        video('I Granted 100 Kids Their Biggest Wish!@MrBeast', { youtubeId: 'y5DX6n_dVAI', channelName: 'Badol', duration: 871 }),
      ];
      const impostor = () => video('I Granted 100 Kids Their Biggest Wish!', {
        youtubeId: 'aLNBbQUcpXI', channelName: 'MrBeast 103M view 6 hours ago', duration: 870,
      });

      test('only the upload from the channel named after the series is offered', async () => {
        const { service } = setup({ results: results(), catalog: makeCatalog({ episode: mrBeastEpisode() }) });

        const items = await service.search(mrBeastQuery(), ORIGIN);

        expect(items.map((item) => item.youtubeId)).toEqual(['lVylRtlPOIE']);
      });

      test('a channel that only contains the series name is not offered beside one that has exactly it', async () => {
        const { service } = setup({
          results: [impostor(), ...results()], catalog: makeCatalog({ episode: mrBeastEpisode() }),
        });

        const items = await service.search(mrBeastQuery(), ORIGIN);

        expect(items.map((item) => item.youtubeId)).toEqual(['lVylRtlPOIE']);
      });

      test('a channel that contains the series name still hides plain re-uploads when none has exactly it', async () => {
        const { service } = setup({
          results: [impostor(), ...results().filter((result) => result.channelName !== 'MrBeast')],
          catalog: makeCatalog({ episode: mrBeastEpisode() }),
        });

        const items = await service.search(mrBeastQuery(), ORIGIN);

        expect(items.map((item) => item.youtubeId)).toEqual(['aLNBbQUcpXI']);
      });

      test('the re-uploads are offered once that upload failed a grab', async () => {
        const { service } = setup({
          results: results(), failedIds: ['lVylRtlPOIE'], catalog: makeCatalog({ episode: mrBeastEpisode() }),
        });

        const items = await service.search(mrBeastQuery(), ORIGIN);

        expect(items.map((item) => item.youtubeId)).toEqual(['SaHE3nRRX0w', 'y5DX6n_dVAI']);
      });

      test('loose matching offers all of them, the series\' channel first', async () => {
        const { service } = setup({
          results: results(),
          config: { arrBridgeLooseMatching: true },
          catalog: makeCatalog({ episode: mrBeastEpisode() }),
        });

        const items = await service.search(mrBeastQuery(), ORIGIN);

        expect(items.map((item) => item.youtubeId)).toEqual(['lVylRtlPOIE', 'SaHE3nRRX0w', 'y5DX6n_dVAI']);
      });
    });

    // Mission: Impossible (1988) S01E10 on 2026-11-16: the review channel's
    // video was the only release offered and the episode itself was hidden.
    test('a review channel named after the series does not hide the episode\'s real upload', async () => {
      const episode = beybladeEpisode({
        seriesTitle: 'Mission: Impossible (1988)',
        seriesTitles: ['Mission: Impossible (1988)'],
        episodeTitle: 'The Lions',
        otherEpisodeTitles: [],
        runtimeSeconds: 2700,
        season: 1,
        episode: 10,
        absoluteNumber: 10,
      });
      const review = video('Mission Impossible S01E10: The Lions', {
        youtubeId: 'qQmJpJ-ChgI', channelName: 'Mission Impossible Reviews', duration: 1773,
      });
      const upload = video('Mission: Impossible (1988) S01E10 The Lions', {
        youtubeId: 'qHAsaUolgws', channelName: 'Alisha H', duration: 2823,
      });
      const { service } = setup({ results: [review, upload], catalog: makeCatalog({ episode }) });

      const items = await service.search(
        request({ t: 'tvsearch', cat: SONARR_CATS, title: 'Mission: Impossible (1988)', season: '1', ep: '10' }),
        ORIGIN
      );

      expect(items.map((item) => item.youtubeId)).toEqual(['qQmJpJ-ChgI', 'qHAsaUolgws']);
    });

    test('the episode-code fallback uses the runtime: a double-length upload is not offered', async () => {
      const { service } = setup({
        results: { [CODE_QUERY]: [video('Beyblade S01E29', { duration: 2635 })] },
        catalog: makeCatalog({ episode: beybladeEpisode() }),
      });

      expect(await service.search(request(beybladeQuery()), ORIGIN)).toEqual([]);
    });

    test('an episode title that cannot carry the match goes straight to the episode code', async () => {
      const episode = beybladeEpisode({
        seriesTitle: 'Bluey (2018)', seriesTitles: ['Bluey (2018)', 'Bluey'], episodeTitle: null, runtimeSeconds: 420,
      });
      const short = video('Bluey S01E01 Magic Xylophone', { duration: 7 * 60 });
      const { service, searchVideos } = setup({ results: [short], catalog: makeCatalog({ episode }) });

      const items = await service.search(request(beybladeQuery({ title: 'Bluey (2018)', season: '1', ep: '1' })), ORIGIN);

      expect(searchVideos.mock.calls).toEqual([['Bluey 2018 S01E01', 25, NO_API]]);
      expect(items).toHaveLength(1);
    });

    test('an episode whose runtime Sonarr does not know is searched by code only', async () => {
      const catalog = makeCatalog({ episode: beybladeEpisode({ runtimeSeconds: null }) });
      const { service, searchVideos } = setup({ results: [official()], catalog });

      const items = await service.search(request(beybladeQuery()), ORIGIN);

      expect(searchVideos.mock.calls).toEqual([[CODE_QUERY, 25, NO_API]]);
      expect(items).toEqual([]);
    });

    test('with loose matching on, that episode is still searched by title', async () => {
      const catalog = makeCatalog({ episode: beybladeEpisode({ runtimeSeconds: null }) });
      const { service, searchVideos } = setup({
        results: [official()], catalog, config: { arrBridgeLooseMatching: true },
      });

      const items = await service.search(request(beybladeQuery()), ORIGIN);

      expect(searchVideos.mock.calls).toEqual([[TITLE_QUERY, 25, NO_API]]);
      expect(items.map((item) => item.youtubeId)).toEqual(['g7VYYfoNaf0']);
    });

    test('a request Sonarr cannot place is the plain episode-code search', async () => {
      const { service, searchVideos } = setup({
        results: [video('Beyblade S01E29', { duration: 44 * 60 })],
        catalog: makeCatalog(),
      });

      const items = await service.search(request(beybladeQuery()), ORIGIN);

      expect(searchVideos.mock.calls).toEqual([[CODE_QUERY, 25, NO_API]]);
      expect(items).toHaveLength(1);
    });

    test('a season request uses the series runtime', async () => {
      const catalog = makeCatalog({ series: { id: 3, title: 'Bluey (2018)', titles: ['Bluey (2018)', 'Bluey'], runtimeSeconds: 420 } });
      const { service } = setup({
        results: [video('Bluey S03E01', { duration: 7 * 60 }), video('Bluey S03E02', { duration: 45 * 60 })],
        catalog,
      });

      const items = await service.search(
        request({ t: 'tvsearch', cat: SONARR_CATS, title: 'Bluey (2018)', season: '3' }),
        ORIGIN
      );

      expect(catalog.resolveSeries).toHaveBeenCalledWith({ text: 'Bluey (2018)', textSource: 'title' });
      expect(items.map((item) => item.title)).toEqual(['Bluey.2018.S03E01.1080p.YT.WEB-DL-NBC']);
    });

    test('a daily request uses the series runtime', async () => {
      const catalog = makeCatalog({ series: { id: 7, title: 'Last Week Tonight', titles: ['Last Week Tonight'], runtimeSeconds: 1980 } });
      const publishedAt = '2025-02-16T23:30:00.000Z';
      const { service } = setup({
        results: [
          video('Last Week Tonight: Web Exclusive', { publishedAt, duration: 10 * 60, channelName: 'Clips' }),
          video('Last Week Tonight: Tariffs', { publishedAt, duration: 30 * 60 }),
        ],
        catalog,
      });

      const items = await service.search(
        request({ t: 'tvsearch', cat: SONARR_CATS, title: 'Last Week Tonight', season: '2025', ep: '02/16' }),
        ORIGIN
      );

      expect(items.map((item) => item.title)).toEqual(['Last.Week.Tonight.2025.02.16.1080p.YT.WEB-DL-NBC']);
    });

    test('a movie request uses the movie runtime', async () => {
      const catalog = makeCatalog({ movie: { title: 'Plan 9 from Outer Space', titles: ['Plan 9 from Outer Space'], runtimeSeconds: 4680 } });
      const fullLength = video('Plan 9 from Outer Space (1957)', { duration: 79 * 60, channelName: 'Classics' });
      const { service } = setup({
        results: [video('Plan 9 from Outer Space (1957) in 60 minutes', { duration: 61 * 60 }), fullLength],
        catalog,
      });

      const items = await service.search(
        request({ t: 'search', cat: RADARR_CATS, q: 'Plan 9 from Outer Space 1957' }),
        ORIGIN
      );

      expect(catalog.resolveMovie).toHaveBeenCalledWith({ text: 'Plan 9 from Outer Space', year: 1957 });
      expect(items.map((item) => item.youtubeId)).toEqual([fullLength.youtubeId]);
    });

    test('requests answered without a search never ask Sonarr or Radarr', async () => {
      const catalog = makeCatalog({ episode: beybladeEpisode() });
      const { service } = setup({ catalog });

      await service.search(request({ t: 'tvsearch', cat: SONARR_CATS }), ORIGIN);
      await service.search(request({ t: 'tvsearch', cat: SONARR_CATS, q: 'Bluey' }), ORIGIN);
      await service.search(request(episodeQuery({ title: '!!!' })), ORIGIN);

      expect(catalog.resolveEpisode).not.toHaveBeenCalled();
      expect(catalog.resolveSeries).not.toHaveBeenCalled();
      expect(catalog.resolveMovie).not.toHaveBeenCalled();
    });

    test('the no-match line counts the results without a known length', async () => {
      const { service, deps } = setup({
        results: [video('Other show'), video('Another show', { duration: null }), video('Third show')],
        catalog: makeCatalog(),
      });

      expect(await service.search(request(beybladeQuery()), ORIGIN)).toEqual([]);

      expect(deps.logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ results: 3, withoutDuration: 1 }),
        'Sonarr/Radarr search found no match'
      );
    });

    test('logs which matcher answered', async () => {
      const titleRun = setup({ results: [official()], catalog: makeCatalog({ episode: beybladeEpisode() }) });
      await titleRun.service.search(request(beybladeQuery()), ORIGIN);
      const codeRun = setup({ results: [video('Beyblade S01E29')], catalog: makeCatalog() });
      await codeRun.service.search(request(beybladeQuery()), ORIGIN);

      expect(titleRun.deps.logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ matcher: 'episode-title', offered: 1 }),
        'Sonarr/Radarr search answered'
      );
      expect(codeRun.deps.logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ matcher: 'episode-code', offered: 1 }),
        'Sonarr/Radarr search answered'
      );
    });
  });

  test('estimateBytes scales with length and resolution and is 0 for an unknown length', () => {
    expect(estimateBytes(60, 1080)).toBe(Math.round((60 * 4.5 * 1_000_000) / 8));
    expect(estimateBytes(60, 2160)).toBeGreaterThan(estimateBytes(60, 1080));
    expect(estimateBytes(null, 1080)).toBe(0);
  });
});
