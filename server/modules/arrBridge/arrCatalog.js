// Ties a search request to the user's own Sonarr series, episode or Radarr
// movie. It builds the release name it would offer and asks the app what
// that name is (/api/v3/parse), so a request resolves to what the app will
// read the release as. Holds the answers for a few minutes, because one
// search in Sonarr is one request per series alias. Never rejects: without a
// connection, a match or an answer from the app, it resolves to null and the
// search goes on without metadata.
const { ArrUnavailableError } = require('./arrClient');
const { tokenize } = require('./candidateFilter');
const { DEFAULT_GROUP, buildTvTitle, buildMovieTitle } = require('./releaseNaming');

const CATALOG_TTL_MS = 10 * 60 * 1000;
// A name the app does not know is asked again soon: the series may be added
// in a moment, and the call costs milliseconds.
const UNKNOWN_NAME_TTL_MS = 60 * 1000;
// After a failed read the alias requests of a search must not each wait
// for the timeout again.
const FAILURE_BACKOFF_MS = 60 * 1000;
// The series list only adds the names of related series, and a large
// library's list is slow: no request waits long for it.
const SIBLING_FIRST_WAIT_MS = 3000;
const SIBLING_RETRY_MS = 60 * 60 * 1000;
const MAX_CACHED_NAMES = 500;
const MAX_CACHED_SERIES_EPISODES = 50;
// The quality in the name asked about does not change what the app reads.
const LOOKUP_RESOLUTION = 480;
// A series request has no episode to ask about.
const ANY_EPISODE = { season: 1, episode: 1 };
// What a read answers when it failed, or was not made during the back-off.
const UNAVAILABLE = Symbol('unavailable');
const TRAILING_TAG = /\s*\([^()]*\)\s*$/;
const UNTITLED_KEYS = new Set(['tba', 'tbd']);
const GENERIC_EPISODE_KEY = /^(?:episode|ep|part|pt|chapter|volume|vol) \d+$/;
const APPS = {
  sonarr: { label: 'Sonarr', data: 'episode' },
  radarr: { label: 'Radarr', data: 'movie' },
};

const phraseKey = (text) => tokenize(String(text ?? '').replace(/&/g, ' and ')).join(' ');

/**
 * One form for a stored title ("Penn & Teller: Fool Us", "The Office (US)")
 * and the cleaned text Sonarr and Radarr put in q ("Penn and Teller Fool
 * Us", "Office US"): they drop a leading "The" there.
 * @param {string} text
 * @returns {string}
 */
function nameKey(text) {
  const key = phraseKey(text);
  return key.startsWith('the ') ? key.slice(4) : key;
}

const containsPhrase = (text, phrase) => ` ${text} `.includes(` ${phrase} `);

const allNames = (row) => [...new Set([row.title, ...row.titles])];
// Every name a row is searched under: its titles, and its own title without
// a trailing tag ("Bluey" for "Bluey (2018)").
const nameKeys = (row) => new Set(
  [...allNames(row), row.title.replace(TRAILING_TAG, '')].map(nameKey).filter(Boolean)
);

// Names of the library's other series that contain this series' name:
// "Beyblade Burst" for "Beyblade". A video naming one is not this series.
function siblingTitles(series, rows) {
  const own = nameKeys(series);
  const siblings = new Set();
  for (const row of rows) {
    if (row === series) continue;
    for (const name of allNames(row)) {
      const key = nameKey(name);
      if (!own.has(key) && [...own].some((ownKey) => containsPhrase(key, ownKey))) siblings.add(name);
    }
  }
  return [...siblings];
}

function isUntitled(key) {
  return key === '' || UNTITLED_KEYS.has(key) || GENERIC_EPISODE_KEY.test(key);
}

// What the episode-title matcher needs to know about one episode: its title
// when that title can identify it, and the titles that mean another episode.
function describeEpisode(series, rows, season, episode) {
  const wanted = rows.find((row) => row.season === season && row.episode === episode);
  if (!wanted) return null;
  const wantedKey = phraseKey(wanted.title);
  const seriesWords = new Set(allNames(series).flatMap((name) => tokenize(name)));
  const sharesTitle = rows.some((row) => row !== wanted && phraseKey(row.title) === wantedKey);
  const identifies = !isUntitled(wantedKey)
    && !sharesTitle
    && !wantedKey.split(' ').every((word) => seriesWords.has(word));

  const others = new Map();
  if (identifies) {
    for (const row of rows) {
      // Specials are not searched, and their titles ("Recap") are not episodes'.
      if (row === wanted || row.season === 0) continue;
      const key = phraseKey(row.title);
      const words = key.split(' ');
      if (isUntitled(key) || words.length < 2 || words.every((word) => seriesWords.has(word))) continue;
      // "The Fight" inside the wanted "The Fight Part 2" is not another episode.
      if (containsPhrase(wantedKey, key)) continue;
      if (!others.has(key)) others.set(key, row.title);
    }
  }
  return {
    episodeTitle: identifies ? wanted.title : null,
    otherEpisodeTitles: [...others.values()],
    runtimeSeconds: wanted.runtimeSeconds,
    absoluteNumber: wanted.absoluteNumber,
  };
}

// What a log line may say about a failure: never the error object.
function failureContext(error) {
  const known = error instanceof ArrUnavailableError;
  return {
    reason: known ? error.reason : 'error',
    status: known ? error.status : null,
    code: known ? error.code : null,
    detail: error?.message ?? null,
  };
}

// Waits for a promise that never rejects, for at most ms.
function waitAtMost(promise, ms) {
  if (ms <= 0) return Promise.resolve();
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(resolve, ms);
    timer.unref();
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * @param {Object} deps
 * @param {Object} deps.client - arrClient
 * @param {Function} deps.getSettings - () => readSettings() result
 * @param {Object} deps.logger
 * @param {Function} [deps.now] - () => milliseconds
 */
function createArrCatalog({ client, getSettings, logger, now = Date.now }) {
  const emptyCache = (identity) => ({
    identity,
    failedUntil: 0,
    // Release name asked about -> series id, movie, or null for a name the
    // app does not know.
    names: new Map(),
    series: new Map(),
    episodes: new Map(),
    siblings: { rows: null, fetchedAt: 0, startedAt: 0, inFlight: null, retryAt: 0 },
  });
  const caches = { sonarr: emptyCache(null), radarr: emptyCache(null) };

  function cacheFor(app, connection) {
    const identity = `${connection.url}\n${connection.apiKey}`;
    if (caches[app].identity !== identity) caches[app] = emptyCache(identity);
    return caches[app];
  }

  const backedOff = (cache) => cache.failedUntil > now();

  // Starts the back-off. Reported once, however many requests shared the call.
  function reportFailure(app, cache, error) {
    if (backedOff(cache)) return;
    cache.failedUntil = now() + FAILURE_BACKOFF_MS;
    logger.warn(
      { app, ...failureContext(error) },
      `Could not read from ${APPS[app].label}; searching without its ${APPS[app].data} data`
    );
  }

  // One call per key while its answer is fresh, shared by the requests that
  // ask meanwhile. A null answer (unknown) stays fresh for a shorter time.
  // During the back-off a fresh answer is still served, but no call starts;
  // a failed one starts it and is not kept. Never rejects.
  function cachedRead(app, cache, map, key, maxEntries, read) {
    const cached = map.get(key);
    if (cached?.inFlight) return cached.inFlight;
    if (cached && now() < cached.expiresAt) return Promise.resolve(cached.value);
    if (backedOff(cache)) return Promise.resolve(UNAVAILABLE);
    const entry = { value: null, expiresAt: 0, inFlight: null };
    entry.inFlight = Promise.resolve().then(read).then(
      (value) => {
        const ttl = value === null ? UNKNOWN_NAME_TTL_MS : CATALOG_TTL_MS;
        Object.assign(entry, { value, expiresAt: now() + ttl, inFlight: null });
        return value;
      },
      (error) => {
        if (map.get(key) === entry) map.delete(key);
        reportFailure(app, cache, error);
        return UNAVAILABLE;
      }
    );
    map.delete(key);
    map.set(key, entry);
    while (map.size > maxEntries) map.delete(map.keys().next().value);
    return entry.inFlight;
  }

  function startSiblingRead(connection, state) {
    state.startedAt = now();
    state.inFlight = Promise.resolve()
      .then(() => client.fetchSeries(connection))
      .then(
        (rows) => {
          state.rows = rows;
          state.fetchedAt = now();
        },
        (error) => {
          state.retryAt = now() + SIBLING_RETRY_MS;
          logger.warn(
            { app: 'sonarr', ...failureContext(error) },
            'Could not read the Sonarr series list; matching without the names of related series for an hour'
          );
        }
      )
      .finally(() => {
        state.inFlight = null;
      });
  }

  // The whole series list, only for the names of related series. A side
  // read that never shares the lookups' back-off: an old list serves while
  // a new one loads, and the first load is waited for at most 3 s after it
  // started, then left to finish for later requests.
  async function siblingRows(connection, cache) {
    const state = cache.siblings;
    const fresh = state.rows && now() - state.fetchedAt < CATALOG_TTL_MS;
    if (!fresh && !state.inFlight && now() >= state.retryAt) startSiblingRead(connection, state);
    if (state.rows) return state.rows;
    if (state.inFlight) await waitAtMost(state.inFlight, state.startedAt + SIBLING_FIRST_WAIT_MS - now());
    return state.rows ?? [];
  }

  // The series a request names, with its aliases: the one Sonarr reads the
  // release name as, when the name is one of that series' own. Sonarr also
  // reads an alias with a scene season as the series, under other numbers.
  async function findSeries({ text, textSource, season, episode }) {
    const connection = getSettings().sonarr;
    if (!connection) return null;
    const key = nameKey(text);
    const naming = { text, textSource, resolution: LOOKUP_RESOLUTION, group: DEFAULT_GROUP };
    const releaseTitle = key && buildTvTitle({ ...naming, season, episode });
    // Keyed by the name as a release name, not by key: "Batman" and "The
    // Batman" are one key but two names, which Sonarr reads as two series.
    const nameTitle = key && buildTvTitle({ ...naming, ...ANY_EPISODE });
    if (!releaseTitle || !nameTitle) return null;
    const cache = cacheFor('sonarr', connection);
    const seriesId = await cachedRead('sonarr', cache, cache.names, nameTitle, MAX_CACHED_NAMES,
      async () => (await client.fetchParsedEpisode(connection, releaseTitle)).series?.id ?? null);
    if (!Number.isInteger(seriesId)) return null;
    // The app is a host the user chose: a row for another id is no row.
    const row = await cachedRead('sonarr', cache, cache.series, seriesId, MAX_CACHED_NAMES, async () => {
      const answer = await client.fetchSeriesById(connection, seriesId);
      return answer?.id === seriesId ? answer : null;
    });
    if (!row || row === UNAVAILABLE || !nameKeys(row).has(key)) return null;
    return { row, connection, cache };
  }

  /**
   * @param {{text: string, textSource: 'title'|'q'|null}} request
   * @returns {Promise<{id: number, title: string, titles: string[], runtimeSeconds: number|null}|null>}
   */
  async function resolveSeries({ text, textSource }) {
    try {
      const found = await findSeries({ text, textSource, ...ANY_EPISODE });
      if (!found) return null;
      const { row } = found;
      return { id: row.id, title: row.title, titles: allNames(row), runtimeSeconds: row.runtimeSeconds };
    } catch (error) {
      logger.warn({ detail: error?.message }, 'Could not resolve a Sonarr series');
      return null;
    }
  }

  /**
   * @param {{text: string, textSource: 'title'|'q'|null, season: number, episode: number}} request
   * @returns {Promise<{seriesTitle: string, seriesTitles: string[], seriesYear: number|null,
   *   siblingTitles: string[], episodeTitle: string|null, otherEpisodeTitles: string[],
   *   runtimeSeconds: number|null, season: number, episode: number,
   *   absoluteNumber: number|null}|null>} episodeTitle is null when the title cannot identify
   *   the episode; the runtime is the episode's, else the series'.
   */
  async function resolveEpisode({ text, textSource, season, episode }) {
    try {
      const found = await findSeries({ text, textSource, season, episode });
      if (!found) return null;
      const { row, connection, cache } = found;
      const [rows, library] = await Promise.all([
        // The numbers Sonarr sends for such a series may be scene numbers,
        // which would name another episode.
        row.sceneNumbering ? null : cachedRead('sonarr', cache, cache.episodes, row.id, MAX_CACHED_SERIES_EPISODES,
          () => client.fetchEpisodes(connection, row.id)),
        siblingRows(connection, cache),
      ]);
      const described = Array.isArray(rows) ? describeEpisode(row, rows, season, episode) : null;
      return {
        seriesTitle: row.title,
        seriesTitles: allNames(row),
        seriesYear: row.year ?? null,
        // The list holds its own, possibly older, row of this series.
        siblingTitles: siblingTitles(row, library.filter((other) => other.id !== row.id)),
        episodeTitle: described?.episodeTitle ?? null,
        otherEpisodeTitles: described?.otherEpisodeTitles ?? [],
        runtimeSeconds: described?.runtimeSeconds ?? row.runtimeSeconds,
        season,
        episode,
        absoluteNumber: described?.absoluteNumber ?? null,
      };
    } catch (error) {
      logger.warn({ detail: error?.message }, 'Could not resolve a Sonarr episode');
      return null;
    }
  }

  /**
   * @param {{text: string, year: number}} request - The title without its year, and the year
   * @returns {Promise<{title: string, titles: string[], runtimeSeconds: number|null}|null>}
   */
  async function resolveMovie({ text, year }) {
    try {
      const connection = getSettings().radarr;
      if (!connection) return null;
      const key = nameKey(text);
      const releaseTitle = key && buildMovieTitle({
        title: text, year, resolution: LOOKUP_RESOLUTION, group: DEFAULT_GROUP,
      });
      if (!releaseTitle) return null;
      const cache = cacheFor('radarr', connection);
      const movie = await cachedRead('radarr', cache, cache.names, releaseTitle, MAX_CACHED_NAMES,
        () => client.fetchParsedMovie(connection, releaseTitle));
      if (!movie || movie === UNAVAILABLE || !movie.years.includes(year)) return null;
      return { title: movie.title, titles: [movie.title], runtimeSeconds: movie.runtimeSeconds };
    } catch (error) {
      logger.warn({ detail: error?.message }, 'Could not resolve a Radarr movie');
      return null;
    }
  }

  return { resolveSeries, resolveEpisode, resolveMovie };
}

module.exports = { createArrCatalog, nameKey };
