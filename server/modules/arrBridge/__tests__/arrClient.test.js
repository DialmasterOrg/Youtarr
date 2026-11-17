/* eslint-env jest */
jest.mock('axios', () => ({ get: jest.fn() }));

const axios = require('axios');
const { createArrClient, ArrUnavailableError } = require('../arrClient');

const KEY = '5p1ke0000000000000000000000000ab';
const SONARR = { url: 'http://sonarr:8989', apiKey: KEY };
const RADARR = { url: 'http://radarr:7878/radarr', apiKey: KEY };

// Rows as Sonarr 4.0.20 and Radarr 6.4.4 return them, cut down to a few of
// the fields the client must ignore.
const OFFICE_ROW = {
  id: 12,
  title: 'The Office (US)',
  cleanTitle: 'theofficeus',
  alternateTitles: [{ title: 'The Office', seasonNumber: -1 }, { title: 'The Office US', seasonNumber: -1 }],
  runtime: 24,
  seriesType: 'standard',
  useSceneNumbering: false,
  path: '/data/tv/The Office (US)',
  overview: 'A mockumentary.',
};
const EPISODE_ROW = {
  id: 901,
  seriesId: 14,
  seasonNumber: 1,
  episodeNumber: 29,
  title: 'Play It Again, Dizzi!',
  airDate: '2001-07-23',
  runtime: 25,
  absoluteEpisodeNumber: 29,
  overview: 'Text.',
};

function axiosError({ status, code, message = 'Request failed' } = {}) {
  const error = new Error(message);
  error.isAxiosError = true;
  error.code = code;
  error.config = { headers: { 'X-Api-Key': KEY }, url: 'http://sonarr:8989/api/v3/series' };
  error.request = { headers: { 'X-Api-Key': KEY } };
  if (status) error.response = { status, data: 'body', config: error.config };
  return error;
}

describe('arrClient', () => {
  let client;

  beforeEach(() => {
    jest.clearAllMocks();
    client = createArrClient();
  });

  describe('fetchSeries', () => {
    test('asks Sonarr for the series list with the key in a header, never in the URL', async () => {
      axios.get.mockResolvedValue({ data: [] });

      await client.fetchSeries(SONARR);

      expect(axios.get).toHaveBeenCalledTimes(1);
      const [url, options] = axios.get.mock.calls[0];
      expect(url).toBe('http://sonarr:8989/api/v3/series');
      expect(url).not.toContain(KEY);
      expect(options).toEqual(expect.objectContaining({
        headers: { 'X-Api-Key': KEY },
        timeout: 60000,
        maxRedirects: 0,
        maxContentLength: 64 * 1024 * 1024,
      }));
      expect(options.params).toBeUndefined();
    });

    test('keeps only the fields matching needs', async () => {
      axios.get.mockResolvedValue({ data: [OFFICE_ROW] });

      await expect(client.fetchSeries(SONARR)).resolves.toEqual([{
        id: 12,
        title: 'The Office (US)',
        titles: ['The Office', 'The Office US'],
        year: null,
        runtimeSeconds: 1440,
        sceneNumbering: false,
      }]);
    });

    test('a runtime of 0 is an unknown runtime', async () => {
      axios.get.mockResolvedValue({ data: [{ id: 1, title: 'New Show', runtime: 0 }] });

      const [series] = await client.fetchSeries(SONARR);

      expect(series).toEqual({
        id: 1, title: 'New Show', titles: [], year: null, runtimeSeconds: null, sceneNumbering: false,
      });
    });

    test('flags a series that uses scene numbering', async () => {
      axios.get.mockResolvedValue({ data: [{ id: 2, title: 'Anime', runtime: 24, useSceneNumbering: true }] });

      const [series] = await client.fetchSeries(SONARR);

      expect(series.sceneNumbering).toBe(true);
    });

    test('leaves out an alias that Sonarr searches under scene season numbers', async () => {
      axios.get.mockResolvedValue({
        data: [{
          id: 60,
          title: 'Power Rangers',
          year: 1993,
          runtime: 22,
          useSceneNumbering: false,
          alternateTitles: [
            { title: 'Power Rangers Dino Fury', seasonNumber: 28, sceneSeasonNumber: 1 },
            { title: 'Mighty Morphin Power Rangers', seasonNumber: -1 },
            { title: 'Power Rangers Beast Morphers', seasonNumber: 26, sceneSeasonNumber: -1 },
          ],
        }],
      });

      const [series] = await client.fetchSeries(SONARR);

      expect(series.titles).toEqual(['Mighty Morphin Power Rangers', 'Power Rangers Beast Morphers']);
    });

    test('keeps the year the series started, when Sonarr knows it', async () => {
      axios.get.mockResolvedValue({ data: [{ id: 60, title: 'Power Rangers', year: 1993 }, { id: 61, title: 'Unknown Year', year: 0 }] });

      const series = await client.fetchSeries(SONARR);

      expect(series.map((row) => row.year)).toEqual([1993, null]);
    });

    test('skips a row without an id or a title instead of failing', async () => {
      axios.get.mockResolvedValue({ data: [{ title: 'No id' }, { id: 3 }, null, 'text', OFFICE_ROW] });

      const series = await client.fetchSeries(SONARR);

      expect(series.map((row) => row.id)).toEqual([12]);
    });
  });

  describe('fetchParsedEpisode', () => {
    const TITLE = 'Office.AKA.The.Office.S01E02.1080p.YT.WEB-DL-YOUTARR';
    const parsed = (extra) => ({
      title: TITLE,
      parsedEpisodeInfo: { seriesTitle: 'Office AKA The Office' },
      languages: [],
      customFormats: [],
      ...extra,
    });

    test('asks the app to parse the release name, with the title as a param and the caps set', async () => {
      axios.get.mockResolvedValue({ data: parsed({ series: { id: 12, title: 'The Office (US)' }, episodes: [] }) });

      await client.fetchParsedEpisode(SONARR, TITLE);

      const [url, options] = axios.get.mock.calls[0];
      expect(url).toBe('http://sonarr:8989/api/v3/parse');
      expect(url).not.toContain(KEY);
      expect(url).not.toContain('title');
      expect(options).toEqual(expect.objectContaining({
        headers: { 'X-Api-Key': KEY },
        params: { title: TITLE },
        timeout: 10000,
        maxRedirects: 0,
        maxContentLength: 4 * 1024 * 1024,
      }));
    });

    test('maps the series and the episodes', async () => {
      axios.get.mockResolvedValue({
        data: parsed({
          series: {
            id: 12, title: 'The Office (US)', year: 2005, runtime: 24, useSceneNumbering: false, tvdbId: 1,
          },
          episodes: [{ ...EPISODE_ROW, seasonNumber: 1, episodeNumber: 2 }, { title: 'no numbers' }],
        }),
      });

      await expect(client.fetchParsedEpisode(SONARR, TITLE)).resolves.toEqual({
        series: {
          id: 12, title: 'The Office (US)', titles: [], year: 2005, runtimeSeconds: 1440, sceneNumbering: false,
        },
        episodes: [{
          season: 1, episode: 2, title: 'Play It Again, Dizzi!', runtimeSeconds: 1500, absoluteNumber: 29,
        }],
      });
    });

    test('a name the app does not know has no series and no episodes', async () => {
      axios.get.mockResolvedValue({ data: parsed({ episodes: [] }) });

      await expect(client.fetchParsedEpisode(SONARR, TITLE)).resolves.toEqual({ series: null, episodes: [] });
    });

    test('a known series with an episode that does not exist has no episodes', async () => {
      axios.get.mockResolvedValue({ data: parsed({ series: { id: 12, title: 'The Office (US)' }, episodes: [] }) });

      const answer = await client.fetchParsedEpisode(SONARR, TITLE);

      expect(answer.series).toMatchObject({ id: 12 });
      expect(answer.episodes).toEqual([]);
    });

    test('a series row that is not usable counts as no series', async () => {
      axios.get.mockResolvedValue({ data: parsed({ series: { title: 'No id' }, episodes: 'text' }) });

      await expect(client.fetchParsedEpisode(SONARR, TITLE)).resolves.toEqual({ series: null, episodes: [] });
    });

    test.each([
      ['a login page', '<html><body>Sign in</body></html>'],
      ['a list', []],
      ['nothing', null],
    ])('%s is not an answer', async (_label, data) => {
      axios.get.mockResolvedValue({ data });

      await expect(client.fetchParsedEpisode(SONARR, TITLE)).rejects.toMatchObject({ reason: 'not-json' });
    });

    test('an aborted read is a timeout', async () => {
      axios.get.mockRejectedValue(axiosError({ code: 'ERR_CANCELED', message: 'canceled' }));

      const error = await client.fetchParsedEpisode(SONARR, TITLE).catch((caught) => caught);

      expect(error).toMatchObject({ reason: 'timeout' });
      expect(error.cause).toBeUndefined();
      expect(JSON.stringify({ ...error, message: error.message, stack: error.stack })).not.toContain(KEY);
    });

    test('an answer over the byte cap is too-large', async () => {
      axios.get.mockRejectedValue(axiosError({
        code: 'ERR_BAD_RESPONSE', message: 'maxContentLength size of 4194304 exceeded',
      }));

      await expect(client.fetchParsedEpisode(SONARR, TITLE)).rejects.toMatchObject({ reason: 'too-large' });
    });
  });

  describe('fetchParsedMovie', () => {
    const TITLE = 'Plan.9.from.Outer.Space.1957.1080p.YT.WEB-DL-YOUTARR';

    test('asks the app to parse the release name, keeping the URL Base path', async () => {
      axios.get.mockResolvedValue({ data: { title: TITLE, parsedMovieInfo: {} } });

      await client.fetchParsedMovie(RADARR, TITLE);

      const [url, options] = axios.get.mock.calls[0];
      expect(url).toBe('http://radarr:7878/radarr/api/v3/parse');
      expect(options).toEqual(expect.objectContaining({
        headers: { 'X-Api-Key': KEY },
        params: { title: TITLE },
        timeout: 10000,
        maxRedirects: 0,
        maxContentLength: 4 * 1024 * 1024,
      }));
    });

    test('maps the movie to its id, title, years and runtime', async () => {
      axios.get.mockResolvedValue({
        data: {
          title: TITLE,
          movie: {
            id: 12, title: 'Plan 9 from Outer Space', originalTitle: 'Plan 9', year: 1957, secondaryYear: 1998, runtime: 78,
          },
        },
      });

      await expect(client.fetchParsedMovie(RADARR, TITLE)).resolves.toEqual({
        id: 12, title: 'Plan 9 from Outer Space', years: [1957, 1998], runtimeSeconds: 4680,
      });
    });

    test('a name or year the app does not know is null', async () => {
      axios.get.mockResolvedValue({ data: { title: TITLE, parsedMovieInfo: {} } });

      await expect(client.fetchParsedMovie(RADARR, TITLE)).resolves.toBeNull();
    });

    test.each([
      ['a login page', '<html><body>Sign in</body></html>'],
      ['a list', []],
    ])('%s is not an answer', async (_label, data) => {
      axios.get.mockResolvedValue({ data });

      await expect(client.fetchParsedMovie(RADARR, TITLE)).rejects.toMatchObject({ reason: 'not-json' });
    });

    test('an aborted read is a timeout', async () => {
      axios.get.mockRejectedValue(axiosError({ code: 'ERR_CANCELED' }));

      await expect(client.fetchParsedMovie(RADARR, TITLE)).rejects.toMatchObject({ reason: 'timeout' });
    });
  });

  describe('fetchSeriesById', () => {
    test('asks for one series, with the caps set', async () => {
      axios.get.mockResolvedValue({ data: OFFICE_ROW });

      await client.fetchSeriesById({ url: 'http://sonarr:8989/sonarr', apiKey: KEY }, 12);

      const [url, options] = axios.get.mock.calls[0];
      expect(url).toBe('http://sonarr:8989/sonarr/api/v3/series/12');
      expect(options).toEqual(expect.objectContaining({
        headers: { 'X-Api-Key': KEY },
        timeout: 10000,
        maxRedirects: 0,
        maxContentLength: 4 * 1024 * 1024,
      }));
    });

    test('maps the row with its aliases and drops scene-season aliases', async () => {
      axios.get.mockResolvedValue({
        data: {
          ...OFFICE_ROW,
          alternateTitles: [
            { title: 'The Office', seasonNumber: -1 },
            { title: 'Dino Fury', seasonNumber: 28, sceneSeasonNumber: 1 },
          ],
        },
      });

      await expect(client.fetchSeriesById(SONARR, 12)).resolves.toEqual({
        id: 12,
        title: 'The Office (US)',
        titles: ['The Office'],
        year: null,
        runtimeSeconds: 1440,
        sceneNumbering: false,
      });
    });

    test.each([
      ['a login page', '<html><body>Sign in</body></html>'],
      ['a list', []],
      ['a row without an id', { title: 'No id' }],
    ])('%s is not an answer', async (_label, data) => {
      axios.get.mockResolvedValue({ data });

      await expect(client.fetchSeriesById(SONARR, 12)).rejects.toMatchObject({ reason: 'not-json' });
    });

    test('a 404 is unreachable and keeps its status', async () => {
      axios.get.mockRejectedValue(axiosError({ status: 404 }));

      await expect(client.fetchSeriesById(SONARR, 12)).rejects.toMatchObject({ reason: 'unreachable', status: 404 });
    });
  });

  describe('fetchEpisodes', () => {
    test('asks for one series and keeps the URL Base path', async () => {
      axios.get.mockResolvedValue({ data: [] });

      await client.fetchEpisodes({ url: 'http://sonarr:8989/sonarr', apiKey: KEY }, 14);

      const [url, options] = axios.get.mock.calls[0];
      expect(url).toBe('http://sonarr:8989/sonarr/api/v3/episode');
      expect(options.params).toEqual({ seriesId: 14 });
    });

    test('maps an episode to its numbers, title and runtime', async () => {
      axios.get.mockResolvedValue({ data: [EPISODE_ROW] });

      await expect(client.fetchEpisodes(SONARR, 14)).resolves.toEqual([{
        season: 1, episode: 29, title: 'Play It Again, Dizzi!', runtimeSeconds: 1500, absoluteNumber: 29,
      }]);
    });

    test('an episode without a runtime, title or absolute number still maps', async () => {
      axios.get.mockResolvedValue({ data: [{ seasonNumber: 13, episodeNumber: 30, runtime: 0 }] });

      await expect(client.fetchEpisodes(SONARR, 7)).resolves.toEqual([{
        season: 13, episode: 30, title: '', runtimeSeconds: null, absoluteNumber: null,
      }]);
    });
  });

  describe('fetchStatus', () => {
    test('asks the app who it is, with the key in a header and no redirect followed', async () => {
      axios.get.mockResolvedValue({ data: { appName: 'Sonarr', version: '4.0.20.3014', osName: 'alpine' } });

      const status = await client.fetchStatus(SONARR);

      expect(status).toEqual({ appName: 'Sonarr', version: '4.0.20.3014' });
      const [url, options] = axios.get.mock.calls[0];
      expect(url).toBe('http://sonarr:8989/api/v3/system/status');
      expect(url).not.toContain(KEY);
      expect(options).toEqual(expect.objectContaining({
        headers: { 'X-Api-Key': KEY },
        timeout: 10000,
        maxRedirects: 0,
        maxContentLength: 256 * 1024,
      }));
    });

    test('keeps the URL Base path', async () => {
      axios.get.mockResolvedValue({ data: { appName: 'Radarr', version: '6.4.4.10685' } });

      await client.fetchStatus(RADARR);

      expect(axios.get.mock.calls[0][0]).toBe('http://radarr:7878/radarr/api/v3/system/status');
    });

    test('a version that is missing or not text reads as empty', async () => {
      axios.get.mockResolvedValue({ data: { appName: 'Sonarr', version: 4 } });

      expect(await client.fetchStatus(SONARR)).toEqual({ appName: 'Sonarr', version: '' });
    });

    test.each([
      ['a list', []],
      ['a login page', '<html><body>Sign in</body></html>'],
      ['an object without an app name', {}],
      ['an app name that is not text', { appName: 7 }],
      ['nothing', null],
    ])('%s is not an answer', async (_label, data) => {
      axios.get.mockResolvedValue({ data });

      await expect(client.fetchStatus(SONARR)).rejects.toMatchObject({ reason: 'not-json' });
    });

    test('a 401 says the key was rejected', async () => {
      axios.get.mockRejectedValue(axiosError({ status: 401 }));

      await expect(client.fetchStatus(SONARR)).rejects.toMatchObject({ reason: 'unauthorized', status: 401 });
    });
  });

  describe('fetchImported', () => {
    const GRAB_ID = '9eef64cc-3f17-465d-857c-fa3c339a6e83';
    // As Sonarr 4.0.20 and Radarr 6.4.4 answer /api/v3/history.
    const history = (records) => ({ page: 1, pageSize: 10, totalRecords: records.length, records });
    const imported = { eventType: 'downloadFolderImported', downloadId: GRAB_ID, sourceTitle: 'Show.S01E01' };

    test('asks the app for the import events of one download', async () => {
      axios.get.mockResolvedValue({ data: history([imported]) });

      expect(await client.fetchImported(SONARR, GRAB_ID)).toBe(true);

      const [url, options] = axios.get.mock.calls[0];
      expect(url).toBe('http://sonarr:8989/api/v3/history');
      expect(options).toEqual(expect.objectContaining({
        headers: { 'X-Api-Key': KEY },
        params: { downloadId: GRAB_ID, eventType: 3, pageSize: 10 },
        maxRedirects: 0,
      }));
    });

    test('a download the app never imported is not imported', async () => {
      axios.get.mockResolvedValue({ data: history([]) });

      expect(await client.fetchImported(RADARR, GRAB_ID)).toBe(false);
    });

    test('ignores events of another download or another kind', async () => {
      axios.get.mockResolvedValue({
        data: history([
          { ...imported, downloadId: 'another-download' },
          { ...imported, eventType: 'grabbed' },
          null,
        ]),
      });

      expect(await client.fetchImported(SONARR, GRAB_ID)).toBe(false);
    });

    test('matches the download id whatever its letter case', async () => {
      axios.get.mockResolvedValue({ data: history([{ ...imported, downloadId: GRAB_ID.toUpperCase() }]) });

      expect(await client.fetchImported(SONARR, GRAB_ID)).toBe(true);
    });

    test.each([
      ['a login page', '<html><body>Sign in</body></html>'],
      ['a list', []],
      ['an object without records', { page: 1 }],
    ])('rejects %s as not the app', async (_name, data) => {
      axios.get.mockResolvedValue({ data });

      await expect(client.fetchImported(SONARR, GRAB_ID)).rejects.toMatchObject({ reason: 'not-json' });
    });

    test('an app that cannot be reached rejects without the key', async () => {
      axios.get.mockRejectedValue(axiosError({ code: 'ECONNREFUSED' }));

      const error = await client.fetchImported(SONARR, GRAB_ID).catch((caught) => caught);

      expect(error).toBeInstanceOf(ArrUnavailableError);
      expect(JSON.stringify(error)).not.toContain(KEY);
    });
  });

  describe('fetchFolderNames', () => {
    // As Sonarr 4.0.20 and Radarr 6.4.4 answer /api/v3/filesystem.
    const listing = (names) => ({
      parent: '/usr/src/app/data/',
      directories: names.map((name) => ({ type: 'folder', name, path: `/usr/src/app/data/.arr-staging/${name}/` })),
      files: [],
    });

    test('asks the app to list the folder, with a trailing slash so the folder itself is listed', async () => {
      axios.get.mockResolvedValue({ data: listing(['movies', 'tv']) });

      const names = await client.fetchFolderNames(SONARR, '/usr/src/app/data/.arr-staging');

      expect(names).toEqual(['movies', 'tv']);
      const [url, options] = axios.get.mock.calls[0];
      expect(url).toBe('http://sonarr:8989/api/v3/filesystem');
      expect(options).toEqual(expect.objectContaining({
        headers: { 'X-Api-Key': KEY },
        params: { path: '/usr/src/app/data/.arr-staging/', includeFiles: false },
        maxRedirects: 0,
      }));
    });

    test('does not double a trailing slash', async () => {
      axios.get.mockResolvedValue({ data: listing([]) });

      await client.fetchFolderNames(RADARR, '/downloads/staging/');

      expect(axios.get.mock.calls[0][1].params.path).toBe('/downloads/staging/');
    });

    test('a folder the app cannot see lists nothing', async () => {
      axios.get.mockResolvedValue({ data: { parent: '/nope/', directories: [], files: [] } });

      expect(await client.fetchFolderNames(SONARR, '/nope/not-mounted')).toEqual([]);
    });

    test('keeps only names that are text', async () => {
      axios.get.mockResolvedValue({ data: { directories: [{ name: 'tv' }, { name: 7 }, null, { path: '/x' }] } });

      expect(await client.fetchFolderNames(SONARR, '/data')).toEqual(['tv']);
    });

    test.each([
      ['a login page', '<html><body>Sign in</body></html>'],
      ['a list', []],
      ['an object without directories', { parent: '/' }],
      ['nothing', null],
    ])('%s is not an answer', async (_label, data) => {
      axios.get.mockResolvedValue({ data });

      await expect(client.fetchFolderNames(SONARR, '/data')).rejects.toMatchObject({ reason: 'not-json' });
    });
  });

  describe('failures', () => {
    test('a 401 says the key was rejected', async () => {
      axios.get.mockRejectedValue(axiosError({ status: 401 }));

      await expect(client.fetchSeries(SONARR)).rejects.toMatchObject({
        name: 'ArrUnavailableError', reason: 'unauthorized', status: 401,
      });
    });

    test('a redirect is refused and named', async () => {
      axios.get.mockRejectedValue(axiosError({ status: 302 }));

      await expect(client.fetchSeries(SONARR)).rejects.toMatchObject({ reason: 'redirect', status: 302 });
    });

    test('an HTML body is not an answer', async () => {
      axios.get.mockResolvedValue({ data: '<html><body>Sign in</body></html>' });

      await expect(client.fetchSeries(SONARR)).rejects.toMatchObject({ reason: 'not-json' });
    });

    test('a JSON object where a list belongs is not an answer', async () => {
      axios.get.mockResolvedValue({ data: { error: 'Unauthorized' } });

      await expect(client.fetchEpisodes(SONARR, 14)).rejects.toMatchObject({ reason: 'not-json' });
    });

    test.each(['ECONNABORTED', 'ETIMEDOUT', 'ERR_CANCELED'])('%s is a timeout', async (code) => {
      axios.get.mockRejectedValue(axiosError({ code, message: 'timeout of 10000ms exceeded' }));

      await expect(client.fetchSeries(SONARR)).rejects.toMatchObject({
        reason: 'timeout', code, status: null,
      });
    });

    test('axios\'s maxContentLength failure is too-large', async () => {
      axios.get.mockRejectedValue(axiosError({
        code: 'ERR_BAD_RESPONSE', message: 'maxContentLength size of 67108864 exceeded',
      }));

      await expect(client.fetchSeries(SONARR)).rejects.toMatchObject({
        reason: 'too-large', code: 'ERR_BAD_RESPONSE',
      });
    });

    test('another bad response is still unreachable', async () => {
      axios.get.mockRejectedValue(axiosError({ code: 'ERR_BAD_RESPONSE', message: 'Request failed with status code 500', status: 500 }));

      await expect(client.fetchSeries(SONARR)).rejects.toMatchObject({ reason: 'unreachable', status: 500 });
    });

    test('a timeout and a too-large answer carry nothing of the request', async () => {
      axios.get.mockRejectedValueOnce(axiosError({ code: 'ECONNABORTED' }));
      axios.get.mockRejectedValueOnce(axiosError({ code: 'ERR_BAD_RESPONSE', message: 'maxContentLength size of 1 exceeded' }));

      const timeout = await client.fetchSeries(SONARR).catch((caught) => caught);
      const tooLarge = await client.fetchSeries(SONARR).catch((caught) => caught);

      [timeout, tooLarge].forEach((error) => {
        expect(error).toBeInstanceOf(ArrUnavailableError);
        expect(error.cause).toBeUndefined();
        expect(JSON.stringify({ ...error, message: error.message, stack: error.stack })).not.toContain(KEY);
      });
    });

    test('a server error is unreachable and keeps its status', async () => {
      axios.get.mockRejectedValue(axiosError({ status: 503 }));

      await expect(client.fetchSeries(SONARR)).rejects.toMatchObject({ reason: 'unreachable', status: 503 });
    });

    test('the error carries nothing of the request', async () => {
      axios.get.mockRejectedValue(axiosError({ status: 401 }));

      const error = await client.fetchSeries(SONARR).catch((caught) => caught);

      expect(error).toBeInstanceOf(ArrUnavailableError);
      expect(error.cause).toBeUndefined();
      expect(JSON.stringify({ ...error, message: error.message, stack: error.stack })).not.toContain(KEY);
    });
  });

  // Against a real server with the real axios: these are properties of the
  // HTTP client's behavior, which a mocked get() cannot show.
  describe('against a real server', () => {
    const http = require('http');
    const realAxios = jest.requireActual('axios');
    let server;
    let connection;
    let handler;
    const openSockets = new Set();

    beforeEach(async () => {
      server = http.createServer((req, res) => handler(req, res));
      server.on('connection', (socket) => {
        openSockets.add(socket);
        socket.on('close', () => openSockets.delete(socket));
      });
      await new Promise((resolve) => { server.listen(0, '127.0.0.1', resolve); });
      connection = { url: `http://127.0.0.1:${server.address().port}`, apiKey: KEY };
    });

    afterEach(async () => {
      openSockets.forEach((socket) => socket.destroy());
      await new Promise((resolve) => { server.close(resolve); });
    });

    test('an answer that trickles in is given up on after the time limit, not read forever', async () => {
      const timers = [];
      handler = (_req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.write('[');
        timers.push(setInterval(() => res.write(' '), 20));
      };
      const realClient = createArrClient({ http: realAxios, timeoutMs: 150, listTimeoutMs: 150 });
      const startedAt = Date.now();

      const error = await realClient.fetchSeries(connection).catch((caught) => caught);
      timers.forEach(clearInterval);

      expect(error).toMatchObject({ name: 'ArrUnavailableError', reason: 'timeout' });
      expect(Date.now() - startedAt).toBeLessThan(2000);
    });

    test('a redirect is not followed, so the key never reaches its target', async () => {
      const seen = [];
      handler = (req, res) => {
        seen.push(req.url);
        if (req.url === '/api/v3/series') {
          res.writeHead(302, { Location: '/elsewhere' });
          res.end();
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('[]');
      };
      const realClient = createArrClient({ http: realAxios });

      await expect(realClient.fetchSeries(connection)).rejects.toMatchObject({ reason: 'redirect', status: 302 });
      expect(seen).toEqual(['/api/v3/series']);
    });
  });
});
