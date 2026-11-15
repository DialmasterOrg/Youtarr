/* eslint-env jest */
const { createSearchService, estimateBytes } = require('../searchService');
const { createSearchQueue, SearchUnavailableError } = require('../searchQueue');
const { parseNewznabRequest } = require('../newznabRequest');
const { parseNzbLink } = require('../nzbFile');
const { renderSearch } = require('../newznabXml');

const ORIGIN = 'http://youtarr:3011';
const KEY = 'k'.repeat(64);
const NOW = new Date('2025-06-01T00:00:00.000Z');
const SONARR_CATS = '5030,5040';
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

function setup({ results = [], config = {}, apiAvailable = true, failedIds = [], knownDates = new Map() } = {}) {
  const searchVideos = jest.fn().mockResolvedValue(results);
  const deps = {
    searchVideos,
    isYoutubeApiAvailable: jest.fn(() => apiAvailable),
    getConfig: () => ({ arrBridgeEnabled: true, arrBridgeApiKey: KEY, preferredResolution: '1080', ...config }),
    knownUploadDates: jest.fn().mockResolvedValue(knownDates),
    recentlyFailedIds: jest.fn().mockResolvedValue(new Set(failedIds)),
    queue: { run: (_key, work) => work() },
    now: () => NOW,
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
        title: 'Youtarr.Bridge.Placeholder.S01E01.480p.WEB-DL-YOUTARR',
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
      expect(items[0]).toMatchObject({ title: 'Youtarr.Bridge.Placeholder.1900.480p.WEB-DL-YOUTARR', kind: 'movie' });
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
      expect(searchVideos).toHaveBeenCalledWith('The Office US S01E02', 25);
    });

    test('names matching candidates from the title Sonarr sent', async () => {
      const match = video('The Office S01E02 Diversity Day');
      const { service } = setup({ results: [match, video('The Office S01E03')] });

      const items = await service.search(request(episodeQuery()), ORIGIN);

      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({
        title: 'The.Office.US.S01E02.1080p.WEB-DL-NBC',
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
      expect(items[0].title).toBe('Office.AKA.The.Office.S01E02.1080p.WEB-DL-NBC');
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
      expect(items[0].title).toContain('.1080p.WEB-DL-');
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
        'The.Office.US.S01E02.1080p.WEB-DL-NBC',
        'The.Office.US.S01E02.1080p.WEB-DL-Peacock',
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

    expect(searchVideos).toHaveBeenCalledWith('Bluey 2018 season 3', 50);
    expect(items.map((item) => item.title)).toEqual([
      'Bluey.2018.S03E01.1080p.WEB-DL-NBC',
      'Bluey.2018.S03E07.1080p.WEB-DL-NBC',
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

    expect(searchVideos).toHaveBeenCalledWith('Last Week Tonight February 16 2025', 25);
    expect(items.map((item) => item.title)).toEqual(['Last.Week.Tonight.2025.02.16.1080p.WEB-DL-NBC']);
  });

  test('a movie request searches title and year and names the release from the request', async () => {
    const match = video('The Matrix (1999) Full Movie', { duration: 2 * 60 * 60, channelName: 'Warner Bros.' });
    const { service, searchVideos } = setup({ results: [match, video('The Matrix trailer 1999', { duration: 150 })] });

    const items = await service.search(request({ t: 'search', cat: RADARR_CATS, q: 'Matrix 1999' }), ORIGIN);

    expect(searchVideos).toHaveBeenCalledWith('Matrix 1999', 25);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      title: 'Matrix.1999.1080p.WEB-DL-WarnerBros',
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

  test('estimateBytes scales with length and resolution and is 0 for an unknown length', () => {
    expect(estimateBytes(60, 1080)).toBe(Math.round((60 * 4.5 * 1_000_000) / 8));
    expect(estimateBytes(60, 2160)).toBeGreaterThan(estimateBytes(60, 1080));
    expect(estimateBytes(null, 1080)).toBe(0);
  });
});
