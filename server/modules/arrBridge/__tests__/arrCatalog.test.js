/* eslint-env jest */
const { createArrCatalog, nameKey } = require('../arrCatalog');
const { ArrUnavailableError } = require('../arrClient');

const SONARR = { url: 'http://sonarr:8989', apiKey: 'sonarr-key-0001' };
const RADARR = { url: 'http://radarr:7878', apiKey: 'radarr-key-0001' };
const MINUTE = 60 * 1000;

const series = (id, title, { titles = [], runtime = 1500, scene = false, year = null } = {}) => ({
  id, title, titles, year, runtimeSeconds: runtime, sceneNumbering: scene,
});
const episode = (season, number, title, { runtime = 1500, absolute = null } = {}) => ({
  season, episode: number, title, runtimeSeconds: runtime, absoluteNumber: absolute,
});
const movie = (id, title, years, { titles = [], runtime = 7200 } = {}) => ({
  id, title, titles, years, runtimeSeconds: runtime,
});

const SERIES = [
  series(4, 'Money Heist', { titles: ['Haus des Geldes', 'La Casa de Papel'], runtime: 3420 }),
  series(3, 'Bluey (2018)', { titles: ['Bluey'], runtime: 420 }),
  series(12, 'The Office (US)', { titles: ['The Office', 'The Office US'], runtime: 1440 }),
  series(14, 'Beyblade'),
];
const BEYBLADE_EPISODES = [
  episode(0, 1, 'Full Episode Special'),
  episode(1, 28, 'Bottom of the Ninth', { absolute: 28 }),
  episode(1, 29, 'Play It Again, Dizzi!', { absolute: 29 }),
  episode(1, 30, 'Cruising for a Bruising', { absolute: 30 }),
  episode(1, 31, 'Beyblade', { absolute: 31 }),
  episode(1, 32, 'TBA', { absolute: 32 }),
  episode(1, 33, 'Episode 33', { absolute: 33 }),
  episode(1, 34, 'Part 2', { absolute: 34 }),
  episode(1, 35, 'Showdown', { absolute: 35 }),
  episode(2, 1, 'Showdown!', { absolute: 52 }),
  episode(2, 2, 'The Fight', { runtime: null, absolute: 53 }),
  episode(2, 3, 'The Fight Part 2', { absolute: 54 }),
];
const MOVIES = [
  movie(11, 'The Matrix', [1999], { runtime: 8160 }),
  movie(3, 'Amélie', [2001], { titles: ['Le Fabuleux Destin d\'Amélie Poulain'], runtime: 7320 }),
  movie(12, 'Plan 9 from Outer Space', [1957, 1998], { runtime: 4680 }),
];

function makeCatalog({ seriesRows = SERIES, episodeRows = BEYBLADE_EPISODES, movieRows = MOVIES } = {}) {
  const settings = { sonarr: SONARR, radarr: RADARR };
  const client = {
    fetchSeries: jest.fn().mockResolvedValue(seriesRows),
    fetchEpisodes: jest.fn().mockResolvedValue(episodeRows),
    fetchMovies: jest.fn().mockResolvedValue(movieRows),
  };
  const logger = { info: jest.fn(), warn: jest.fn(), debug: jest.fn(), error: jest.fn() };
  const catalog = createArrCatalog({ client, getSettings: () => settings, logger });
  return { catalog, client, logger, settings };
}

describe('arrCatalog', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-15T12:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('nameKey', () => {
    test.each([
      ['Penn & Teller: Fool Us', 'Penn and Teller Fool Us'],
      ['The Office (US)', 'Office US'],
      ['The 100', '100'],
      ['Shōgun', 'Shogun'],
      ['Marvel\'s Agents of S.H.I.E.L.D.', 'Marvels Agents of S H I E L D'],
      ['Kurzgesagt – In a Nutshell', 'Kurzgesagt In a Nutshell'],
      ['9-1-1', '9 1 1'],
    ])('the stored title %s and the cleaned %s are one name', (stored, cleaned) => {
      expect(nameKey(stored)).toBe(nameKey(cleaned));
    });

    test('a title that is only an article keeps it', () => {
      expect(nameKey('The')).toBe('the');
    });
  });

  describe('resolveEpisode', () => {
    test('resolves Beyblade S01E29 to its title, runtime and the other episodes\' titles', async () => {
      const { catalog, client } = makeCatalog();

      const result = await catalog.resolveEpisode({ text: 'Beyblade', season: 1, episode: 29 });

      expect(result).toEqual(expect.objectContaining({
        seriesTitle: 'Beyblade',
        seriesTitles: ['Beyblade'],
        episodeTitle: 'Play It Again, Dizzi!',
        runtimeSeconds: 1500,
        season: 1,
        episode: 29,
        absoluteNumber: 29,
      }));
      expect(result.otherEpisodeTitles).toEqual(expect.arrayContaining(['Cruising for a Bruising', 'Bottom of the Ninth']));
      expect(client.fetchEpisodes).toHaveBeenCalledWith(SONARR, 14);
    });

    test('the other titles leave out one-word, generic and special titles and the series\' own name', async () => {
      const { catalog } = makeCatalog();

      const result = await catalog.resolveEpisode({ text: 'Beyblade', season: 1, episode: 29 });

      expect(result.otherEpisodeTitles).toEqual([
        'Bottom of the Ninth', 'Cruising for a Bruising', 'The Fight', 'The Fight Part 2',
      ]);
    });

    test('the other titles leave out a title the wanted one contains', async () => {
      const { catalog } = makeCatalog();

      const result = await catalog.resolveEpisode({ text: 'Beyblade', season: 2, episode: 3 });

      expect(result.episodeTitle).toBe('The Fight Part 2');
      expect(result.otherEpisodeTitles).not.toContain('The Fight');
    });

    test('a longer title that starts with the wanted one stays among the others', async () => {
      const { catalog } = makeCatalog();

      const result = await catalog.resolveEpisode({ text: 'Beyblade', season: 2, episode: 2 });

      expect(result.episodeTitle).toBe('The Fight');
      expect(result.otherEpisodeTitles).toContain('The Fight Part 2');
    });

    test('names the library\'s other series whose name contains this one\'s, and the series\' year', async () => {
      const { catalog } = makeCatalog({
        seriesRows: [
          series(14, 'Beyblade', { year: 2001 }),
          series(15, 'Beyblade Burst', { titles: ['Beyblade Burst Evolution'], year: 2016 }),
          series(16, 'Beyblade: Metal Fusion', { year: 2009 }),
          series(17, 'Blade Runner', { year: 2020 }),
        ],
      });

      const result = await catalog.resolveEpisode({ text: 'Beyblade', season: 1, episode: 29 });

      expect(result.seriesYear).toBe(2001);
      expect(result.siblingTitles).toEqual(['Beyblade Burst', 'Beyblade Burst Evolution', 'Beyblade: Metal Fusion']);
    });

    test('a series under a shorter name of this one is not a sibling', async () => {
      const { catalog } = makeCatalog({
        seriesRows: [series(14, 'Beyblade'), series(15, 'Beyblade Burst')],
        episodeRows: [episode(1, 1, 'Let\'s Go Valtryek')],
      });

      const result = await catalog.resolveEpisode({ text: 'Beyblade Burst', season: 1, episode: 1 });

      expect(result.siblingTitles).toEqual([]);
      expect(result.seriesYear).toBeNull();
    });

    test('an episode without its own runtime takes the series runtime', async () => {
      const { catalog } = makeCatalog();

      const result = await catalog.resolveEpisode({ text: 'Beyblade', season: 2, episode: 2 });

      expect(result.runtimeSeconds).toBe(1500);
    });

    test('an alias resolves to the same series and lists every name', async () => {
      const { catalog, client } = makeCatalog({ episodeRows: [episode(1, 1, 'Do as Planned', { runtime: 2820 })] });

      const result = await catalog.resolveEpisode({ text: 'Haus des Geldes', season: 1, episode: 1 });

      expect(result.seriesTitle).toBe('Money Heist');
      expect(result.seriesTitles).toEqual(['Money Heist', 'Haus des Geldes', 'La Casa de Papel']);
      expect(result.runtimeSeconds).toBe(2820);
      expect(client.fetchEpisodes).toHaveBeenCalledWith(SONARR, 4);
    });

    test('the cleaned q that Prowlarr forwards resolves too', async () => {
      const { catalog, client } = makeCatalog({ episodeRows: [episode(1, 2, 'Diversity Day')] });

      const result = await catalog.resolveEpisode({ text: 'Office US', season: 1, episode: 2 });

      expect(result.seriesTitle).toBe('The Office (US)');
      expect(client.fetchEpisodes).toHaveBeenCalledWith(SONARR, 12);
    });

    test.each([
      ['TBA', 32],
      ['a generic "Episode 33"', 33],
      ['a generic "Part 2"', 34],
      ['the series\' own name', 31],
      ['a title two episodes share', 35],
    ])('episodeTitle is null for %s, and the runtime is still known', async (_label, number) => {
      const { catalog } = makeCatalog();

      const result = await catalog.resolveEpisode({ text: 'Beyblade', season: 1, episode: number });

      expect(result.episodeTitle).toBeNull();
      expect(result.otherEpisodeTitles).toEqual([]);
      expect(result.runtimeSeconds).toBe(1500);
    });

    test('an episode Sonarr does not list keeps the series runtime without a title', async () => {
      const { catalog } = makeCatalog();

      const result = await catalog.resolveEpisode({ text: 'Beyblade', season: 9, episode: 9 });

      expect(result).toEqual(expect.objectContaining({
        seriesTitle: 'Beyblade', episodeTitle: null, runtimeSeconds: 1500, absoluteNumber: null,
      }));
    });

    test('a series with scene numbering never gets an episode title, and its episodes are not read', async () => {
      const { catalog, client } = makeCatalog({ seriesRows: [series(20, 'Some Anime', { scene: true, runtime: 1440 })] });

      const result = await catalog.resolveEpisode({ text: 'Some Anime', season: 1, episode: 29 });

      expect(result).toEqual(expect.objectContaining({ episodeTitle: null, runtimeSeconds: 1440 }));
      expect(client.fetchEpisodes).not.toHaveBeenCalled();
    });

    test('an unknown series is no resolution', async () => {
      const { catalog } = makeCatalog();

      await expect(catalog.resolveEpisode({ text: 'Unknown Show', season: 1, episode: 1 })).resolves.toBeNull();
    });

    test('episodes that cannot be read leave the series runtime', async () => {
      const { catalog, client } = makeCatalog();
      client.fetchEpisodes.mockRejectedValue(new ArrUnavailableError('unreachable', { status: 500 }));

      const result = await catalog.resolveEpisode({ text: 'Beyblade', season: 1, episode: 29 });

      expect(result).toEqual(expect.objectContaining({ episodeTitle: null, runtimeSeconds: 1500 }));
    });
  });

  describe('resolveSeries', () => {
    test('the title without its tag resolves', async () => {
      const { catalog } = makeCatalog();

      await expect(catalog.resolveSeries({ text: 'Bluey' })).resolves.toEqual({
        id: 3, title: 'Bluey (2018)', titles: ['Bluey (2018)', 'Bluey'], runtimeSeconds: 420,
      });
    });

    // Sonarr sends "The Office" both for the UK series and as the US series'
    // alias, and reads the release name back as whichever it is searching.
    test('a name that is one series\' title and another\'s alias is no resolution', async () => {
      const { catalog } = makeCatalog({
        seriesRows: [series(12, 'The Office (US)', { titles: ['The Office'] }), series(30, 'The Office')],
      });

      await expect(catalog.resolveSeries({ text: 'The Office' })).resolves.toBeNull();
      await expect(catalog.resolveSeries({ text: 'The Office (US)' })).resolves.toEqual(expect.objectContaining({ id: 12 }));
    });

    test('two series left means no resolution', async () => {
      const { catalog } = makeCatalog({
        seriesRows: [series(40, 'Doctor Who (2005)'), series(41, 'Doctor Who (1963)')],
      });

      await expect(catalog.resolveSeries({ text: 'Doctor Who' })).resolves.toBeNull();
    });

    test('text with nothing usable is no resolution', async () => {
      const { catalog } = makeCatalog();

      await expect(catalog.resolveSeries({ text: '!!!' })).resolves.toBeNull();
    });
  });

  describe('resolveMovie', () => {
    test('resolves a movie by the cleaned title Radarr sends and its year', async () => {
      const { catalog, client } = makeCatalog();

      await expect(catalog.resolveMovie({ text: 'Matrix', year: 1999 })).resolves.toEqual({
        title: 'The Matrix', titles: ['The Matrix'], runtimeSeconds: 8160,
      });
      expect(client.fetchMovies).toHaveBeenCalledWith(RADARR);
    });

    test('resolves by the original title', async () => {
      const { catalog } = makeCatalog();

      const result = await catalog.resolveMovie({ text: 'Le Fabuleux Destin dAmelie Poulain', year: 2001 });

      expect(result.title).toBe('Amélie');
      expect(result.titles).toEqual(['Amélie', 'Le Fabuleux Destin d\'Amélie Poulain']);
    });

    test('resolves by the secondary year', async () => {
      const { catalog } = makeCatalog();

      const result = await catalog.resolveMovie({ text: 'Plan 9 from Outer Space', year: 1998 });

      expect(result.runtimeSeconds).toBe(4680);
    });

    test('the right title with another year is no resolution', async () => {
      const { catalog } = makeCatalog();

      await expect(catalog.resolveMovie({ text: 'Matrix', year: 2003 })).resolves.toBeNull();
    });
  });

  describe('caching', () => {
    test('one Sonarr search reads the series list and the episodes once', async () => {
      const { catalog, client } = makeCatalog({ episodeRows: [episode(1, 1, 'Do as Planned')] });

      await Promise.all([
        catalog.resolveEpisode({ text: 'Haus des Geldes', season: 1, episode: 1 }),
        catalog.resolveEpisode({ text: 'La Casa de Papel', season: 1, episode: 1 }),
      ]);
      await catalog.resolveEpisode({ text: 'Money Heist', season: 1, episode: 1 });

      expect(client.fetchSeries).toHaveBeenCalledTimes(1);
      expect(client.fetchEpisodes).toHaveBeenCalledTimes(1);
    });

    test('lists are read again after 10 minutes', async () => {
      const { catalog, client } = makeCatalog();
      await catalog.resolveEpisode({ text: 'Beyblade', season: 1, episode: 29 });
      await catalog.resolveMovie({ text: 'Matrix', year: 1999 });

      jest.advanceTimersByTime(10 * MINUTE + 1);
      await catalog.resolveEpisode({ text: 'Beyblade', season: 1, episode: 29 });
      await catalog.resolveMovie({ text: 'Matrix', year: 1999 });

      expect(client.fetchSeries).toHaveBeenCalledTimes(2);
      expect(client.fetchEpisodes).toHaveBeenCalledTimes(2);
      expect(client.fetchMovies).toHaveBeenCalledTimes(2);
    });

    test('a series added a moment ago is found by one refresh', async () => {
      const { catalog, client } = makeCatalog();
      await catalog.resolveSeries({ text: 'Beyblade' });
      client.fetchSeries.mockResolvedValue([...SERIES, series(50, 'Brand New Show', { runtime: 2700 })]);

      jest.advanceTimersByTime(31 * 1000);
      const result = await catalog.resolveSeries({ text: 'Brand New Show' });

      expect(result.id).toBe(50);
      expect(client.fetchSeries).toHaveBeenCalledTimes(2);
    });

    test('a name that matches nothing does not refresh a list read seconds ago', async () => {
      const { catalog, client } = makeCatalog();
      await catalog.resolveSeries({ text: 'Beyblade' });

      jest.advanceTimersByTime(31 * 1000);
      await catalog.resolveSeries({ text: 'Unknown Show' });
      await catalog.resolveSeries({ text: 'Unknown Show' });
      await catalog.resolveSeries({ text: 'Another Unknown' });

      expect(client.fetchSeries).toHaveBeenCalledTimes(2);
    });

    test('a changed URL or key drops what was cached', async () => {
      const { catalog, client, settings } = makeCatalog();
      await catalog.resolveSeries({ text: 'Beyblade' });

      settings.sonarr = { ...SONARR, apiKey: 'sonarr-key-0002' };
      await catalog.resolveSeries({ text: 'Beyblade' });

      expect(client.fetchSeries).toHaveBeenCalledTimes(2);
      expect(client.fetchSeries).toHaveBeenLastCalledWith(settings.sonarr);
    });
  });

  describe('when an app cannot be read', () => {
    test('answers null, logs one warning without the error object, and waits 60 seconds', async () => {
      const { catalog, client, logger } = makeCatalog();
      client.fetchSeries.mockRejectedValue(new ArrUnavailableError('unauthorized', { status: 401 }));

      await expect(catalog.resolveEpisode({ text: 'Beyblade', season: 1, episode: 29 })).resolves.toBeNull();
      await expect(catalog.resolveSeries({ text: 'Beyblade' })).resolves.toBeNull();

      expect(client.fetchSeries).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledTimes(1);
      const [context, message] = logger.warn.mock.calls[0];
      expect(context).toEqual({ app: 'sonarr', reason: 'unauthorized', status: 401, code: null, detail: 'the API key was rejected' });
      expect(message).toBe('Could not read from Sonarr; searching without its episode data');
    });

    test('asks again once the 60 seconds have passed', async () => {
      const { catalog, client } = makeCatalog();
      client.fetchSeries.mockRejectedValueOnce(new ArrUnavailableError('unreachable', { code: 'ECONNREFUSED' }));
      await catalog.resolveSeries({ text: 'Beyblade' });

      jest.advanceTimersByTime(MINUTE + 1);
      const result = await catalog.resolveSeries({ text: 'Beyblade' });

      expect(result.id).toBe(14);
      expect(client.fetchSeries).toHaveBeenCalledTimes(2);
    });

    test('an unreadable Radarr is reported as Radarr and does not stop Sonarr', async () => {
      const { catalog, client, logger } = makeCatalog();
      client.fetchMovies.mockRejectedValue(new ArrUnavailableError('not-json'));

      await expect(catalog.resolveMovie({ text: 'Matrix', year: 1999 })).resolves.toBeNull();
      const result = await catalog.resolveSeries({ text: 'Beyblade' });

      expect(result.id).toBe(14);
      expect(logger.warn.mock.calls[0][0].app).toBe('radarr');
      expect(logger.warn.mock.calls[0][1]).toBe('Could not read from Radarr; searching without its movie data');
    });

    test('an unexpected error never escapes', async () => {
      const { catalog, client } = makeCatalog();
      client.fetchSeries.mockRejectedValue(new TypeError('boom'));

      await expect(catalog.resolveSeries({ text: 'Beyblade' })).resolves.toBeNull();
    });
  });

  test('no connection configured never calls the client', async () => {
    const { catalog, client, settings } = makeCatalog();
    settings.sonarr = null;
    settings.radarr = null;

    await expect(catalog.resolveEpisode({ text: 'Beyblade', season: 1, episode: 29 })).resolves.toBeNull();
    await expect(catalog.resolveSeries({ text: 'Beyblade' })).resolves.toBeNull();
    await expect(catalog.resolveMovie({ text: 'Matrix', year: 1999 })).resolves.toBeNull();

    expect(client.fetchSeries).not.toHaveBeenCalled();
    expect(client.fetchMovies).not.toHaveBeenCalled();
  });
});
