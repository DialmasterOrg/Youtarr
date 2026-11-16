/* eslint-env jest */
const { createArrCatalog, nameKey } = require('../arrCatalog');
const { ArrUnavailableError } = require('../arrClient');

const SONARR = { url: 'http://sonarr:8989', apiKey: 'sonarr-key-0001' };
const RADARR = { url: 'http://radarr:7878', apiKey: 'radarr-key-0001' };
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const SONARR_WARNING = 'Could not read from Sonarr; searching without its episode data';

// A series as Sonarr holds it. Sonarr's parser also knows the scene-season
// aliases, which arrClient drops from every row it returns.
const series = (id, title, {
  titles = [], sceneAliases = [], runtime = 1500, scene = false, year = null,
} = {}) => ({
  id, title, titles, sceneAliases, year, runtimeSeconds: runtime, sceneNumbering: scene,
});
const asRow = ({ id, title, titles, year, runtimeSeconds, sceneNumbering }) => ({
  id, title, titles, year, runtimeSeconds, sceneNumbering,
});
const episode = (season, number, title, { runtime = 1500, absolute = null } = {}) => ({
  season, episode: number, title, runtimeSeconds: runtime, absoluteNumber: absolute,
});
const movie = (id, title, years, { runtime = 7200 } = {}) => ({ id, title, years, runtimeSeconds: runtime });
const tv = (text, season, number, textSource = 'title') => ({ text, textSource, season, episode: number });

const LIBRARY = [
  series(4, 'Money Heist', { titles: ['Haus des Geldes', 'La Casa de Papel'], runtime: 3420 }),
  series(3, 'Bluey (2018)', { titles: ['Bluey'], runtime: 420 }),
  series(12, 'The Office (US)', { titles: ['The Office', 'The Office US'], runtime: 1440 }),
  series(14, 'Beyblade'),
  series(60, 'Power Rangers', { sceneAliases: ['Power Rangers Dino Fury'], year: 1993 }),
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
  movie(12, 'Plan 9 from Outer Space', [1957, 1998], { runtime: 4680 }),
];

// Reads a release name as Sonarr does: the part before the episode code,
// either half of an AKA name, against every name of every series. The first
// series that matches is the one it picks.
function sonarrParse(library) {
  return async (_connection, releaseTitle) => {
    const halves = releaseTitle.replace(/\.S\d+E\d+\..*$/, '').split('.AKA.').map(nameKey);
    const found = library.find((row) => {
      const names = [row.title, row.title.replace(/\s*\([^()]*\)$/, ''), ...row.titles, ...row.sceneAliases];
      return names.some((name) => halves.includes(nameKey(name)));
    });
    // Sonarr's parse answer carries no aliases.
    return { series: found ? { ...asRow(found), titles: [] } : null, episodes: [] };
  };
}

// Matches the title only, so that the catalog's own year check is what
// turns away another year.
function radarrParse(movies) {
  return async (_connection, releaseTitle) => {
    const key = nameKey(releaseTitle.replace(/\.\d{4}\.\d+p\..*$/, ''));
    return movies.find((row) => nameKey(row.title) === key) ?? null;
  };
}

function makeCatalog({
  library = LIBRARY, episodeRows = BEYBLADE_EPISODES, movies = MOVIES, now,
} = {}) {
  const settings = { sonarr: SONARR, radarr: RADARR };
  const client = {
    fetchParsedEpisode: jest.fn(sonarrParse(library)),
    fetchSeriesById: jest.fn(async (_connection, id) => {
      const found = library.find((row) => row.id === id);
      if (!found) throw new ArrUnavailableError('unreachable', { status: 404 });
      return asRow(found);
    }),
    fetchEpisodes: jest.fn().mockResolvedValue(episodeRows),
    fetchSeries: jest.fn().mockResolvedValue(library.map(asRow)),
    fetchParsedMovie: jest.fn(radarrParse(movies)),
    // Radarr's whole movie list is never read; this proves it.
    fetchMovies: jest.fn(),
  };
  const logger = { info: jest.fn(), warn: jest.fn(), debug: jest.fn(), error: jest.fn() };
  const catalog = createArrCatalog({ client, getSettings: () => settings, logger, ...(now && { now }) });
  return { catalog, client, logger, settings };
}

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
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
    test('asks Sonarr to parse the release name it would offer and resolves the episode', async () => {
      const { catalog, client } = makeCatalog();

      const result = await catalog.resolveEpisode(tv('Beyblade', 1, 29));

      expect(client.fetchParsedEpisode).toHaveBeenCalledWith(SONARR, 'Beyblade.S01E29.480p.YT.WEB-DL-YOUTARR');
      expect(client.fetchSeriesById).toHaveBeenCalledWith(SONARR, 14);
      expect(client.fetchEpisodes).toHaveBeenCalledWith(SONARR, 14);
      expect(result).toEqual(expect.objectContaining({
        seriesTitle: 'Beyblade',
        seriesTitles: ['Beyblade'],
        seriesYear: null,
        episodeTitle: 'Play It Again, Dizzi!',
        runtimeSeconds: 1500,
        season: 1,
        episode: 29,
        absoluteNumber: 29,
      }));
      expect(result.otherEpisodeTitles).toEqual(expect.arrayContaining(['Cruising for a Bruising', 'Bottom of the Ninth']));
    });

    test('a q request asks under the AKA name and resolves the series', async () => {
      const { catalog, client } = makeCatalog({ episodeRows: [episode(1, 2, 'Diversity Day', { runtime: 1320 })] });

      const result = await catalog.resolveEpisode(tv('Office US', 1, 2, 'q'));

      expect(client.fetchParsedEpisode).toHaveBeenCalledWith(
        SONARR, 'Office.US.AKA.The.Office.US.S01E02.480p.YT.WEB-DL-YOUTARR'
      );
      expect(result).toEqual(expect.objectContaining({
        seriesTitle: 'The Office (US)',
        seriesTitles: ['The Office (US)', 'The Office', 'The Office US'],
        episodeTitle: 'Diversity Day',
        runtimeSeconds: 1320,
      }));
    });

    test('an alias resolves to the same series and lists every name from the series row', async () => {
      const { catalog, client } = makeCatalog({ episodeRows: [episode(1, 1, 'Do as Planned', { runtime: 2820 })] });

      const result = await catalog.resolveEpisode(tv('Haus des Geldes', 1, 1));

      expect(result.seriesTitle).toBe('Money Heist');
      expect(result.seriesTitles).toEqual(['Money Heist', 'Haus des Geldes', 'La Casa de Papel']);
      expect(result.runtimeSeconds).toBe(2820);
      expect(client.fetchEpisodes).toHaveBeenCalledWith(SONARR, 4);
    });

    test('the other titles leave out one-word, generic and special titles and the series\' own name', async () => {
      const { catalog } = makeCatalog();

      const result = await catalog.resolveEpisode(tv('Beyblade', 1, 29));

      expect(result.otherEpisodeTitles).toEqual([
        'Bottom of the Ninth', 'Cruising for a Bruising', 'The Fight', 'The Fight Part 2',
      ]);
    });

    test('the other titles leave out a title the wanted one contains', async () => {
      const { catalog } = makeCatalog();

      const result = await catalog.resolveEpisode(tv('Beyblade', 2, 3));

      expect(result.episodeTitle).toBe('The Fight Part 2');
      expect(result.otherEpisodeTitles).not.toContain('The Fight');
    });

    test('a longer title that starts with the wanted one stays among the others', async () => {
      const { catalog } = makeCatalog();

      const result = await catalog.resolveEpisode(tv('Beyblade', 2, 2));

      expect(result.episodeTitle).toBe('The Fight');
      expect(result.otherEpisodeTitles).toContain('The Fight Part 2');
    });

    test('an episode without its own runtime takes the series runtime', async () => {
      const { catalog } = makeCatalog();

      const result = await catalog.resolveEpisode(tv('Beyblade', 2, 2));

      expect(result.runtimeSeconds).toBe(1500);
    });

    test.each([
      ['TBA', 32],
      ['a generic "Episode 33"', 33],
      ['a generic "Part 2"', 34],
      ['the series\' own name', 31],
      ['a title two episodes share', 35],
    ])('episodeTitle is null for %s, and the runtime is still known', async (_label, number) => {
      const { catalog } = makeCatalog();

      const result = await catalog.resolveEpisode(tv('Beyblade', 1, number));

      expect(result.episodeTitle).toBeNull();
      expect(result.otherEpisodeTitles).toEqual([]);
      expect(result.runtimeSeconds).toBe(1500);
    });

    test('an episode Sonarr does not list keeps the series runtime without a title', async () => {
      const { catalog } = makeCatalog();

      const result = await catalog.resolveEpisode(tv('Beyblade', 9, 9));

      expect(result).toEqual(expect.objectContaining({
        seriesTitle: 'Beyblade', episodeTitle: null, runtimeSeconds: 1500, absoluteNumber: null,
      }));
    });

    test('a series with scene numbering never gets an episode title, and its episodes are not read', async () => {
      const { catalog, client } = makeCatalog({ library: [series(20, 'Some Anime', { scene: true, runtime: 1440 })] });

      const result = await catalog.resolveEpisode(tv('Some Anime', 1, 29));

      expect(result).toEqual(expect.objectContaining({ seriesTitle: 'Some Anime', episodeTitle: null, runtimeSeconds: 1440 }));
      expect(client.fetchEpisodes).not.toHaveBeenCalled();
    });

    // Sonarr sends such an alias with the scene season's numbers, which would
    // look up another episode.
    test('an alias with a scene season is no resolution, though Sonarr reads it as the series', async () => {
      const { catalog, client } = makeCatalog();

      await expect(catalog.resolveEpisode(tv('Power Rangers Dino Fury', 1, 1))).resolves.toBeNull();

      expect(client.fetchSeriesById).toHaveBeenCalledWith(SONARR, 60);
      expect(client.fetchEpisodes).not.toHaveBeenCalled();
    });

    test('a name two series share resolves to the series Sonarr reads it as', async () => {
      const { catalog } = makeCatalog({
        library: [series(30, 'The Office', { runtime: 1800 }), series(12, 'The Office (US)', { titles: ['The Office'] })],
        episodeRows: [episode(1, 1, 'Downsize')],
      });

      const result = await catalog.resolveEpisode(tv('The Office', 1, 1));

      expect(result.seriesTitle).toBe('The Office');
      expect(result.seriesTitles).toEqual(['The Office']);
    });

    test('a series row whose id is not the one asked for is no row, and is not kept as known', async () => {
      const { catalog, client } = makeCatalog();
      client.fetchSeriesById.mockResolvedValueOnce(asRow(series(99, 'Beyblade')));

      await expect(catalog.resolveEpisode(tv('Beyblade', 1, 29))).resolves.toBeNull();
      expect(client.fetchEpisodes).not.toHaveBeenCalled();
      expect(client.fetchSeries).not.toHaveBeenCalled();

      jest.advanceTimersByTime(MINUTE + 1);
      const result = await catalog.resolveEpisode(tv('Beyblade', 1, 29));

      expect(result.seriesTitle).toBe('Beyblade');
      expect(client.fetchSeriesById).toHaveBeenCalledTimes(2);
      expect(client.fetchSeriesById).toHaveBeenLastCalledWith(SONARR, 14);
    });

    test('episodes that cannot be read leave the series runtime', async () => {
      const { catalog, client } = makeCatalog();
      client.fetchEpisodes.mockRejectedValue(new ArrUnavailableError('unreachable', { status: 500 }));

      const result = await catalog.resolveEpisode(tv('Beyblade', 1, 29));

      expect(result).toEqual(expect.objectContaining({ episodeTitle: null, runtimeSeconds: 1500 }));
    });

    // Review Focus 5: a second instance or Prowlarr sends names this Sonarr
    // does not have.
    test('a name Sonarr does not know is one parse call, with no other read and no wait', async () => {
      const { catalog, client } = makeCatalog();
      client.fetchSeries.mockReturnValue(new Promise(() => {}));

      await expect(catalog.resolveEpisode(tv('Unknown Show', 1, 1))).resolves.toBeNull();

      expect(client.fetchParsedEpisode).toHaveBeenCalledTimes(1);
      expect(client.fetchSeriesById).not.toHaveBeenCalled();
      expect(client.fetchEpisodes).not.toHaveBeenCalled();
      expect(client.fetchSeries).not.toHaveBeenCalled();
    });

    test('text with nothing usable is no resolution and asks nothing', async () => {
      const { catalog, client } = makeCatalog();

      await expect(catalog.resolveEpisode(tv('!!!', 1, 1))).resolves.toBeNull();

      expect(client.fetchParsedEpisode).not.toHaveBeenCalled();
    });
  });

  describe('related series from the series list', () => {
    const BEYBLADE_LIBRARY = [
      series(14, 'Beyblade', { year: 2001 }),
      series(15, 'Beyblade Burst', { titles: ['Beyblade Burst Evolution'], year: 2016 }),
      series(16, 'Beyblade: Metal Fusion', { year: 2009 }),
      series(17, 'Blade Runner', { year: 2020 }),
    ];
    const BEYBLADE_SIBLINGS = ['Beyblade Burst', 'Beyblade Burst Evolution', 'Beyblade: Metal Fusion'];

    test('names the library\'s other series whose name contains this one\'s, and the series\' year', async () => {
      const { catalog, client } = makeCatalog({ library: BEYBLADE_LIBRARY });

      const result = await catalog.resolveEpisode(tv('Beyblade', 1, 29));

      expect(result.seriesYear).toBe(2001);
      expect(result.siblingTitles).toEqual(BEYBLADE_SIBLINGS);
      expect(client.fetchSeries).toHaveBeenCalledWith(SONARR);
      // The wait for the first list ended with the read, and took its timer along.
      expect(jest.getTimerCount()).toBe(0);
    });

    test('a series under a shorter name of this one is not a sibling', async () => {
      const { catalog } = makeCatalog({
        library: [series(14, 'Beyblade'), series(15, 'Beyblade Burst')],
        episodeRows: [episode(1, 1, 'Let\'s Go Valtryek')],
      });

      const result = await catalog.resolveEpisode(tv('Beyblade Burst', 1, 1));

      expect(result.siblingTitles).toEqual([]);
    });

    test('the series\' own row in an older list is not its sibling', async () => {
      const { catalog, client } = makeCatalog({ library: BEYBLADE_LIBRARY });
      client.fetchSeries.mockResolvedValue([
        { ...asRow(BEYBLADE_LIBRARY[0]), titles: ['Beyblade Classic'] },
        asRow(BEYBLADE_LIBRARY[1]),
      ]);

      const result = await catalog.resolveEpisode(tv('Beyblade', 1, 29));

      expect(result.siblingTitles).toEqual(['Beyblade Burst', 'Beyblade Burst Evolution']);
    });

    test('resolving a series alone never reads the list', async () => {
      const { catalog, client } = makeCatalog({ library: BEYBLADE_LIBRARY });

      await catalog.resolveSeries({ text: 'Beyblade', textSource: 'title' });

      expect(client.fetchSeries).not.toHaveBeenCalled();
    });

    test('a first read slower than 3 s leaves the episode without siblings, and fills the list for later', async () => {
      const { catalog, client } = makeCatalog({ library: BEYBLADE_LIBRARY });
      const list = deferred();
      client.fetchSeries.mockReturnValue(list.promise);
      let settled = false;

      const pending = catalog.resolveEpisode(tv('Beyblade', 1, 29));
      pending.then(() => { settled = true; });
      await jest.advanceTimersByTimeAsync(2999);
      expect(settled).toBe(false);
      await jest.advanceTimersByTimeAsync(1);
      const first = await pending;

      expect(first).toEqual(expect.objectContaining({ episodeTitle: 'Play It Again, Dizzi!', siblingTitles: [] }));

      list.resolve(BEYBLADE_LIBRARY.map(asRow));
      await jest.advanceTimersByTimeAsync(0);
      const later = await catalog.resolveEpisode(tv('Beyblade', 1, 29));

      expect(later.siblingTitles).toEqual(BEYBLADE_SIBLINGS);
      expect(client.fetchSeries).toHaveBeenCalledTimes(1);
    });

    test('requests during a slow first read wait only until 3 s after it started', async () => {
      const { catalog, client } = makeCatalog({ library: BEYBLADE_LIBRARY });
      client.fetchSeries.mockReturnValue(new Promise(() => {}));
      const first = catalog.resolveEpisode(tv('Beyblade', 1, 29));
      await jest.advanceTimersByTimeAsync(3000);
      await first;

      let settled = false;
      catalog.resolveEpisode(tv('Beyblade', 1, 30)).then(() => { settled = true; });
      await jest.advanceTimersByTimeAsync(0);

      expect(settled).toBe(true);
      expect(client.fetchSeries).toHaveBeenCalledTimes(1);
      expect(jest.getTimerCount()).toBe(0);
    });

    test('a stale list is used at once while a refresh runs', async () => {
      const { catalog, client } = makeCatalog({ library: BEYBLADE_LIBRARY });
      await catalog.resolveEpisode(tv('Beyblade', 1, 29));
      client.fetchSeries.mockReturnValue(new Promise(() => {}));

      jest.advanceTimersByTime(10 * MINUTE + 1);
      const result = await catalog.resolveEpisode(tv('Beyblade', 1, 29));

      expect(result.siblingTitles).toEqual(BEYBLADE_SIBLINGS);
      expect(client.fetchSeries).toHaveBeenCalledTimes(2);
      expect(jest.getTimerCount()).toBe(0);
    });

    test('a list read that fails warns once with its reason and is not tried again for an hour', async () => {
      const { catalog, client, logger } = makeCatalog({ library: BEYBLADE_LIBRARY });
      client.fetchSeries.mockRejectedValue(new ArrUnavailableError('too-large', { code: 'ERR_BAD_RESPONSE' }));

      const first = await catalog.resolveEpisode(tv('Beyblade', 1, 29));
      jest.advanceTimersByTime(59 * MINUTE);
      const second = await catalog.resolveEpisode(tv('Beyblade', 1, 29));

      expect(first).toEqual(expect.objectContaining({ episodeTitle: 'Play It Again, Dizzi!', siblingTitles: [] }));
      expect(second).toEqual(expect.objectContaining({ episodeTitle: 'Play It Again, Dizzi!', siblingTitles: [] }));
      expect(client.fetchSeries).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledTimes(1);
      const [context, message] = logger.warn.mock.calls[0];
      expect(context).toEqual(expect.objectContaining({
        app: 'sonarr', reason: 'too-large', status: null, code: 'ERR_BAD_RESPONSE',
      }));
      expect(message).toContain('series list');

      client.fetchSeries.mockResolvedValue(BEYBLADE_LIBRARY.map(asRow));
      jest.advanceTimersByTime(HOUR - 59 * MINUTE + 1);
      const third = await catalog.resolveEpisode(tv('Beyblade', 1, 29));

      expect(client.fetchSeries).toHaveBeenCalledTimes(2);
      expect(third.siblingTitles).toEqual(BEYBLADE_SIBLINGS);
    });

    test('a failed list read does not hold back the lookups', async () => {
      const { catalog, client } = makeCatalog();
      client.fetchSeries.mockRejectedValue(new ArrUnavailableError('timeout', { code: 'ERR_CANCELED' }));

      await catalog.resolveEpisode(tv('Beyblade', 1, 29));
      const result = await catalog.resolveSeries({ text: 'Money Heist', textSource: 'title' });

      expect(result).toEqual(expect.objectContaining({ id: 4 }));
      expect(client.fetchParsedEpisode).toHaveBeenCalledTimes(2);
    });
  });

  describe('resolveSeries', () => {
    test('asks about episode 1 of season 1 and resolves the title without its tag', async () => {
      const { catalog, client } = makeCatalog();

      await expect(catalog.resolveSeries({ text: 'Bluey', textSource: 'title' })).resolves.toEqual({
        id: 3, title: 'Bluey (2018)', titles: ['Bluey (2018)', 'Bluey'], runtimeSeconds: 420,
      });
      expect(client.fetchParsedEpisode).toHaveBeenCalledWith(SONARR, 'Bluey.S01E01.480p.YT.WEB-DL-YOUTARR');
      expect(client.fetchEpisodes).not.toHaveBeenCalled();
    });

    test('an alias with a scene season is no resolution', async () => {
      const { catalog } = makeCatalog();

      await expect(catalog.resolveSeries({ text: 'Power Rangers Dino Fury', textSource: 'title' })).resolves.toBeNull();
    });

    test('text with nothing usable is no resolution', async () => {
      const { catalog, client } = makeCatalog();

      await expect(catalog.resolveSeries({ text: '!!!', textSource: 'title' })).resolves.toBeNull();
      expect(client.fetchParsedEpisode).not.toHaveBeenCalled();
    });
  });

  describe('resolveMovie', () => {
    test('asks Radarr to parse the release name it would offer and resolves the movie', async () => {
      const { catalog, client } = makeCatalog();

      await expect(catalog.resolveMovie({ text: 'Matrix', year: 1999 })).resolves.toEqual({
        title: 'The Matrix', titles: ['The Matrix'], runtimeSeconds: 8160,
      });
      expect(client.fetchParsedMovie).toHaveBeenCalledWith(RADARR, 'Matrix.1999.480p.YT.WEB-DL-YOUTARR');
      expect(client.fetchMovies).not.toHaveBeenCalled();
    });

    test('resolves by the secondary year', async () => {
      const { catalog } = makeCatalog();

      const result = await catalog.resolveMovie({ text: 'Plan 9 from Outer Space', year: 1998 });

      expect(result.runtimeSeconds).toBe(4680);
    });

    test('a movie Radarr reads with a year it does not have is no resolution', async () => {
      const { catalog, client } = makeCatalog();

      await expect(catalog.resolveMovie({ text: 'Matrix', year: 2003 })).resolves.toBeNull();
      expect(client.fetchParsedMovie).toHaveBeenCalledTimes(1);
    });

    test('a name Radarr does not know is no resolution', async () => {
      const { catalog } = makeCatalog();

      await expect(catalog.resolveMovie({ text: 'Unknown Movie', year: 2001 })).resolves.toBeNull();
    });
  });

  describe('caching', () => {
    test('the same name twice inside 10 minutes is one parse, one series read and one episode read', async () => {
      const { catalog, client } = makeCatalog();

      await catalog.resolveEpisode(tv('Beyblade', 1, 29));
      jest.advanceTimersByTime(9 * MINUTE);
      const result = await catalog.resolveEpisode(tv('Beyblade', 1, 30));

      expect(result.episodeTitle).toBe('Cruising for a Bruising');
      expect(client.fetchParsedEpisode).toHaveBeenCalledTimes(1);
      expect(client.fetchSeriesById).toHaveBeenCalledTimes(1);
      expect(client.fetchEpisodes).toHaveBeenCalledTimes(1);
    });

    test('five concurrent requests share every read', async () => {
      const { catalog, client } = makeCatalog();

      const results = await Promise.all(Array.from({ length: 5 }, () => catalog.resolveEpisode(tv('Beyblade', 1, 29))));

      expect(results.map((result) => result.episodeTitle)).toEqual(Array(5).fill('Play It Again, Dizzi!'));
      expect(client.fetchParsedEpisode).toHaveBeenCalledTimes(1);
      expect(client.fetchSeriesById).toHaveBeenCalledTimes(1);
      expect(client.fetchEpisodes).toHaveBeenCalledTimes(1);
      expect(client.fetchSeries).toHaveBeenCalledTimes(1);
    });

    test('the alias requests of one search share the series row and its episodes', async () => {
      const { catalog, client } = makeCatalog({ episodeRows: [episode(1, 1, 'Do as Planned')] });

      await Promise.all([
        catalog.resolveEpisode(tv('Haus des Geldes', 1, 1)),
        catalog.resolveEpisode(tv('La Casa de Papel', 1, 1)),
      ]);
      await catalog.resolveEpisode(tv('Money Heist', 1, 1));

      expect(client.fetchParsedEpisode).toHaveBeenCalledTimes(3);
      expect(client.fetchSeriesById).toHaveBeenCalledTimes(1);
      expect(client.fetchEpisodes).toHaveBeenCalledTimes(1);
    });

    // Two names nameKey folds together are two release names, which Sonarr
    // reads as two series.
    test('names that differ by a leading "The" are asked about separately', async () => {
      const batman = series(1, 'Batman', { year: 1966 });
      const theBatman = series(2, 'The Batman', { year: 2004 });
      const { catalog, client } = makeCatalog({ library: [batman, theBatman], episodeRows: [episode(1, 1, 'Pilot')] });
      const answers = {
        'Batman.S01E01.480p.YT.WEB-DL-YOUTARR': batman,
        'The.Batman.S01E01.480p.YT.WEB-DL-YOUTARR': theBatman,
      };
      client.fetchParsedEpisode.mockImplementation(async (_connection, title) => ({
        series: answers[title] ? asRow(answers[title]) : null, episodes: [],
      }));

      const first = await catalog.resolveEpisode(tv('Batman', 1, 1));
      const second = await catalog.resolveEpisode(tv('The Batman', 1, 1));

      expect(first.seriesTitle).toBe('Batman');
      expect(second.seriesTitle).toBe('The Batman');
      expect(client.fetchParsedEpisode.mock.calls.map(([, title]) => title)).toEqual(Object.keys(answers));
    });

    test('a q request and a title request for one series are each asked once, and both resolve', async () => {
      const { catalog, client } = makeCatalog();

      const fromQ = await catalog.resolveEpisode(tv('Beyblade', 1, 29, 'q'));
      const fromTitle = await catalog.resolveEpisode(tv('Beyblade', 1, 29));
      await catalog.resolveEpisode(tv('Beyblade', 1, 30, 'q'));
      await catalog.resolveEpisode(tv('Beyblade', 1, 30));

      expect(fromQ.seriesTitle).toBe('Beyblade');
      expect(fromTitle.seriesTitle).toBe('Beyblade');
      expect(client.fetchParsedEpisode).toHaveBeenCalledTimes(2);
      expect(client.fetchSeriesById).toHaveBeenCalledTimes(1);
    });

    test('a name Sonarr does not know is asked again after a minute, a known one keeps 10 minutes', async () => {
      let clock = Date.parse('2026-11-15T12:00:00Z');
      const { catalog, client } = makeCatalog({ now: () => clock });
      await catalog.resolveSeries({ text: 'Unknown Show', textSource: 'title' });
      await catalog.resolveSeries({ text: 'Beyblade', textSource: 'title' });

      clock += 59 * 1000;
      await catalog.resolveSeries({ text: 'Unknown Show', textSource: 'title' });
      expect(client.fetchParsedEpisode).toHaveBeenCalledTimes(2);

      clock += 2 * 1000;
      await catalog.resolveSeries({ text: 'Unknown Show', textSource: 'title' });
      await catalog.resolveSeries({ text: 'Beyblade', textSource: 'title' });
      expect(client.fetchParsedEpisode).toHaveBeenCalledTimes(3);
      expect(client.fetchParsedEpisode).toHaveBeenLastCalledWith(SONARR, 'Unknown.Show.S01E01.480p.YT.WEB-DL-YOUTARR');
    });

    test('a name Sonarr does not know is remembered too', async () => {
      const { catalog, client } = makeCatalog();

      await catalog.resolveEpisode(tv('Unknown Show', 1, 1));
      await catalog.resolveSeries({ text: 'Unknown Show', textSource: 'title' });

      expect(client.fetchParsedEpisode).toHaveBeenCalledTimes(1);
    });

    test('everything is asked again after 10 minutes', async () => {
      const { catalog, client } = makeCatalog();
      await catalog.resolveEpisode(tv('Beyblade', 1, 29));
      await catalog.resolveMovie({ text: 'Matrix', year: 1999 });

      jest.advanceTimersByTime(10 * MINUTE + 1);
      await catalog.resolveEpisode(tv('Beyblade', 1, 29));
      await catalog.resolveMovie({ text: 'Matrix', year: 1999 });

      expect(client.fetchParsedEpisode).toHaveBeenCalledTimes(2);
      expect(client.fetchSeriesById).toHaveBeenCalledTimes(2);
      expect(client.fetchEpisodes).toHaveBeenCalledTimes(2);
      expect(client.fetchSeries).toHaveBeenCalledTimes(2);
      expect(client.fetchParsedMovie).toHaveBeenCalledTimes(2);
    });

    test('a movie is remembered by its name and year', async () => {
      const { catalog, client } = makeCatalog();

      await catalog.resolveMovie({ text: 'Matrix', year: 1999 });
      await catalog.resolveMovie({ text: 'Matrix', year: 1999 });
      await catalog.resolveMovie({ text: 'Matrix', year: 2003 });

      expect(client.fetchParsedMovie).toHaveBeenCalledTimes(2);
      expect(client.fetchParsedMovie).toHaveBeenLastCalledWith(RADARR, 'Matrix.2003.480p.YT.WEB-DL-YOUTARR');
    });

    test('at most 500 names are remembered, the oldest dropped first', async () => {
      const { catalog, client } = makeCatalog();
      for (let index = 0; index <= 500; index += 1) {
        await catalog.resolveSeries({ text: `Unknown Show ${index}`, textSource: 'title' });
      }

      await catalog.resolveSeries({ text: 'Unknown Show 1', textSource: 'title' });
      expect(client.fetchParsedEpisode).toHaveBeenCalledTimes(501);
      await catalog.resolveSeries({ text: 'Unknown Show 0', textSource: 'title' });
      expect(client.fetchParsedEpisode).toHaveBeenCalledTimes(502);
    });

    test('a changed URL or key drops what was cached', async () => {
      const { catalog, client, settings } = makeCatalog();
      await catalog.resolveSeries({ text: 'Beyblade', textSource: 'title' });

      settings.sonarr = { ...SONARR, apiKey: 'sonarr-key-0002' };
      await catalog.resolveSeries({ text: 'Beyblade', textSource: 'title' });

      expect(client.fetchParsedEpisode).toHaveBeenCalledTimes(2);
      expect(client.fetchParsedEpisode).toHaveBeenLastCalledWith(settings.sonarr, expect.any(String));
    });
  });

  describe('when an app cannot be read', () => {
    // Review Focus 3: HTML or garbage, a redirect, or a 404 from a version
    // without /parse.
    test.each([
      ['not-json', {}],
      ['redirect', { status: 302 }],
      ['unreachable', { status: 404 }],
    ])('a parse that fails as %s answers null, warns once and asks nothing for 60 s', async (reason, details) => {
      const { catalog, client, logger } = makeCatalog();
      client.fetchParsedEpisode.mockRejectedValueOnce(new ArrUnavailableError(reason, details));

      await expect(catalog.resolveEpisode(tv('Beyblade', 1, 29))).resolves.toBeNull();
      await expect(catalog.resolveEpisode(tv('Money Heist', 1, 1))).resolves.toBeNull();
      await expect(catalog.resolveSeries({ text: 'Bluey', textSource: 'title' })).resolves.toBeNull();

      expect(client.fetchParsedEpisode).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledWith(
        {
          app: 'sonarr',
          reason,
          status: details.status ?? null,
          code: null,
          detail: new ArrUnavailableError(reason).message,
        },
        SONARR_WARNING
      );
    });

    test('during the back-off a cached name still resolves fully, and an uncached one is null, with no call', async () => {
      const { catalog, client } = makeCatalog();
      await catalog.resolveEpisode(tv('Beyblade', 1, 29));
      client.fetchParsedEpisode.mockRejectedValueOnce(new ArrUnavailableError('unreachable', { status: 503 }));
      await expect(catalog.resolveEpisode(tv('Money Heist', 1, 1))).resolves.toBeNull();
      Object.values(client).forEach((fn) => fn.mockClear());

      const cached = await catalog.resolveEpisode(tv('Beyblade', 1, 30));
      await expect(catalog.resolveEpisode(tv('Money Heist', 1, 1))).resolves.toBeNull();
      await expect(catalog.resolveSeries({ text: 'Bluey', textSource: 'title' })).resolves.toBeNull();

      expect(cached).toEqual(expect.objectContaining({
        seriesTitle: 'Beyblade', episodeTitle: 'Cruising for a Bruising', runtimeSeconds: 1500, absoluteNumber: 30,
      }));
      Object.values(client).forEach((fn) => expect(fn).not.toHaveBeenCalled());
    });

    test('asks again once the 60 seconds have passed', async () => {
      const { catalog, client } = makeCatalog();
      client.fetchParsedEpisode.mockRejectedValueOnce(new ArrUnavailableError('unreachable', { code: 'ECONNREFUSED' }));
      await catalog.resolveEpisode(tv('Beyblade', 1, 29));

      jest.advanceTimersByTime(MINUTE - 1);
      await expect(catalog.resolveEpisode(tv('Beyblade', 1, 29))).resolves.toBeNull();
      jest.advanceTimersByTime(2);
      const result = await catalog.resolveEpisode(tv('Beyblade', 1, 29));

      expect(result.episodeTitle).toBe('Play It Again, Dizzi!');
      expect(client.fetchParsedEpisode).toHaveBeenCalledTimes(2);
    });

    test('a series read that fails answers null and holds back the lookups too', async () => {
      const { catalog, client, logger } = makeCatalog();
      client.fetchSeriesById.mockRejectedValueOnce(new ArrUnavailableError('timeout', { code: 'ERR_CANCELED' }));

      await expect(catalog.resolveEpisode(tv('Beyblade', 1, 29))).resolves.toBeNull();
      await expect(catalog.resolveSeries({ text: 'Money Heist', textSource: 'title' })).resolves.toBeNull();

      expect(client.fetchParsedEpisode).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(logger.warn.mock.calls[0][0]).toEqual(expect.objectContaining({ reason: 'timeout', code: 'ERR_CANCELED' }));
    });

    test('an episode read that fails holds back the lookups too', async () => {
      const { catalog, client, logger } = makeCatalog();
      client.fetchEpisodes.mockRejectedValueOnce(new ArrUnavailableError('unreachable', { status: 500 }));

      await catalog.resolveEpisode(tv('Beyblade', 1, 29));
      await expect(catalog.resolveSeries({ text: 'Money Heist', textSource: 'title' })).resolves.toBeNull();

      expect(client.fetchParsedEpisode).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledTimes(1);
    });

    test('concurrent requests sharing a failed call report it once', async () => {
      const { catalog, client, logger } = makeCatalog();
      client.fetchParsedEpisode.mockRejectedValueOnce(new ArrUnavailableError('unreachable', { status: 503 }));

      const results = await Promise.all(Array.from({ length: 3 }, () => catalog.resolveEpisode(tv('Beyblade', 1, 29))));

      expect(results).toEqual([null, null, null]);
      expect(client.fetchParsedEpisode).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledTimes(1);
    });

    test('an unreadable Radarr is reported as Radarr and does not stop Sonarr', async () => {
      const { catalog, client, logger } = makeCatalog();
      client.fetchParsedMovie.mockRejectedValue(new ArrUnavailableError('not-json'));

      await expect(catalog.resolveMovie({ text: 'Matrix', year: 1999 })).resolves.toBeNull();
      const result = await catalog.resolveSeries({ text: 'Beyblade', textSource: 'title' });

      expect(result.id).toBe(14);
      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(logger.warn.mock.calls[0][0].app).toBe('radarr');
      expect(logger.warn.mock.calls[0][1]).toBe('Could not read from Radarr; searching without its movie data');
    });

    test('an unexpected error never escapes', async () => {
      const { catalog, client } = makeCatalog();
      client.fetchParsedEpisode.mockRejectedValue(new TypeError('boom'));
      client.fetchParsedMovie.mockRejectedValue(new TypeError('boom'));

      await expect(catalog.resolveSeries({ text: 'Beyblade', textSource: 'title' })).resolves.toBeNull();
      await expect(catalog.resolveEpisode(tv('Money Heist', 1, 1))).resolves.toBeNull();
      await expect(catalog.resolveMovie({ text: 'Matrix', year: 1999 })).resolves.toBeNull();
    });
  });

  test('no connection configured never calls the client', async () => {
    const { catalog, client, settings } = makeCatalog();
    settings.sonarr = null;
    settings.radarr = null;

    await expect(catalog.resolveEpisode(tv('Beyblade', 1, 29))).resolves.toBeNull();
    await expect(catalog.resolveSeries({ text: 'Beyblade', textSource: 'title' })).resolves.toBeNull();
    await expect(catalog.resolveMovie({ text: 'Matrix', year: 1999 })).resolves.toBeNull();

    Object.values(client).forEach((fn) => expect(fn).not.toHaveBeenCalled());
  });
});
