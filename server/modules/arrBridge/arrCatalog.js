// Ties a search request to the user's own Sonarr series, episode or Radarr
// movie, by name. Holds the lists it read for a few minutes, because one
// search in Sonarr is one request per series alias. Never rejects: without a
// connection, a single match or an answer from the app, it resolves to null
// and the search goes on without metadata.
const { ArrUnavailableError } = require('./arrClient');
const { tokenize } = require('./candidateFilter');

const CATALOG_TTL_MS = 10 * 60 * 1000;
// Sonarr searches a series the moment it is added, so a name the cached
// list lacks is worth one fresh read, but not one per unknown name.
const MISS_REFRESH_MIN_AGE_MS = 30 * 1000;
// After a failed read the alias requests of a search must not each wait
// for the timeout again.
const FAILURE_BACKOFF_MS = 60 * 1000;
const MAX_CACHED_SERIES_EPISODES = 50;
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

// Name -> the rows known by it.
function buildIndex(rows) {
  const index = new Map();
  for (const row of rows) {
    for (const key of nameKeys(row)) index.set(key, [...(index.get(key) ?? []), row]);
  }
  return index;
}

// The one row a name means, or null when it means none or several. A name
// that is one series' title and another's alias stays unresolved: Sonarr
// sends it for both, and reads a release under it as whichever it searches.
const pickRow = (rows) => (rows?.length === 1 ? rows[0] : null);

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

/**
 * @param {Object} deps
 * @param {Object} deps.client - arrClient
 * @param {Function} deps.getSettings - () => readSettings() result
 * @param {Object} deps.logger
 * @param {Function} [deps.now] - () => milliseconds
 */
function createArrCatalog({ client, getSettings, logger, now = Date.now }) {
  const emptyCache = () => ({
    identity: null, rows: [], index: null, fetchedAt: 0, inFlight: null, failedUntil: 0, episodes: new Map(),
  });
  const caches = { sonarr: emptyCache(), radarr: emptyCache() };

  function cacheFor(app, connection) {
    const identity = `${connection.url}\n${connection.apiKey}`;
    if (caches[app].identity !== identity) caches[app] = { ...emptyCache(), identity };
    return caches[app];
  }

  function reportFailure(app, cache, error) {
    cache.failedUntil = now() + FAILURE_BACKOFF_MS;
    const known = error instanceof ArrUnavailableError;
    logger.warn(
      {
        app,
        reason: known ? error.reason : 'error',
        status: known ? error.status : null,
        code: known ? error.code : null,
        detail: error?.message ?? null,
      },
      `Could not read from ${APPS[app].label}; searching without its ${APPS[app].data} data`
    );
  }

  // Runs a read unless the app failed moments ago. A failure is reported
  // once and answers null until the back-off has passed.
  async function guarded(app, cache, read) {
    if (cache.failedUntil > now()) return null;
    try {
      return await read();
    } catch (error) {
      if (cache.failedUntil <= now()) reportFailure(app, cache, error);
      return null;
    }
  }

  function loadIndex(app, connection, cache, { refresh = false } = {}) {
    const fresh = cache.index && now() - cache.fetchedAt < CATALOG_TTL_MS;
    if (fresh && !refresh) return Promise.resolve(cache.index);
    if (!cache.inFlight) {
      const fetchRows = app === 'sonarr' ? client.fetchSeries : client.fetchMovies;
      cache.inFlight = guarded(app, cache, async () => {
        cache.rows = await fetchRows(connection);
        cache.index = buildIndex(cache.rows);
        cache.fetchedAt = now();
        return cache.index;
      }).finally(() => {
        cache.inFlight = null;
      });
    }
    return cache.inFlight;
  }

  // The rows a name means, reading the list again once when the name is
  // unknown and the list is not brand new.
  async function lookUp(app, connection, cache, text) {
    const key = nameKey(text);
    if (!key) return null;
    let index = await loadIndex(app, connection, cache);
    if (!index) return null;
    if (!index.has(key) && now() - cache.fetchedAt > MISS_REFRESH_MIN_AGE_MS) {
      index = await loadIndex(app, connection, cache, { refresh: true });
    }
    return index?.get(key) ?? null;
  }

  function loadEpisodes(connection, cache, seriesId) {
    const cached = cache.episodes.get(seriesId);
    if (cached?.rows && now() - cached.fetchedAt < CATALOG_TTL_MS) return Promise.resolve(cached.rows);
    if (cached?.inFlight) return cached.inFlight;
    const entry = { rows: null, fetchedAt: 0, inFlight: null };
    entry.inFlight = guarded('sonarr', cache, async () => {
      entry.rows = await client.fetchEpisodes(connection, seriesId);
      entry.fetchedAt = now();
      return entry.rows;
    }).finally(() => {
      entry.inFlight = null;
      if (!entry.rows) cache.episodes.delete(seriesId);
    });
    cache.episodes.delete(seriesId);
    cache.episodes.set(seriesId, entry);
    while (cache.episodes.size > MAX_CACHED_SERIES_EPISODES) {
      cache.episodes.delete(cache.episodes.keys().next().value);
    }
    return entry.inFlight;
  }

  async function findSeries(text) {
    const connection = getSettings().sonarr;
    if (!connection) return null;
    const cache = cacheFor('sonarr', connection);
    const row = pickRow(await lookUp('sonarr', connection, cache, text));
    return row ? { row, connection, cache } : null;
  }

  /**
   * @param {{text: string}} request
   * @returns {Promise<{id: number, title: string, titles: string[], runtimeSeconds: number|null}|null>}
   */
  async function resolveSeries({ text }) {
    try {
      const found = await findSeries(text);
      if (!found) return null;
      const { row } = found;
      return { id: row.id, title: row.title, titles: allNames(row), runtimeSeconds: row.runtimeSeconds };
    } catch (error) {
      logger.warn({ detail: error?.message }, 'Could not resolve a Sonarr series');
      return null;
    }
  }

  /**
   * @param {{text: string, season: number, episode: number}} request
   * @returns {Promise<{seriesTitle: string, seriesTitles: string[], seriesYear: number|null,
   *   siblingTitles: string[], episodeTitle: string|null, otherEpisodeTitles: string[],
   *   runtimeSeconds: number|null, season: number, episode: number,
   *   absoluteNumber: number|null}|null>} episodeTitle is null when the title cannot identify
   *   the episode; the runtime is the episode's, else the series'.
   */
  async function resolveEpisode({ text, season, episode }) {
    try {
      const found = await findSeries(text);
      if (!found) return null;
      const { row, connection, cache } = found;
      // The numbers Sonarr sends for such a series may be scene numbers,
      // which would name another episode.
      const rows = row.sceneNumbering ? null : await loadEpisodes(connection, cache, row.id);
      const described = rows ? describeEpisode(row, rows, season, episode) : null;
      return {
        seriesTitle: row.title,
        seriesTitles: allNames(row),
        seriesYear: row.year ?? null,
        siblingTitles: siblingTitles(row, cache.rows),
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
      const cache = cacheFor('radarr', connection);
      const entries = await lookUp('radarr', connection, cache, text);
      const row = pickRow((entries ?? []).filter((candidate) => candidate.years.includes(year)));
      return row ? { title: row.title, titles: allNames(row), runtimeSeconds: row.runtimeSeconds } : null;
    } catch (error) {
      logger.warn({ detail: error?.message }, 'Could not resolve a Radarr movie');
      return null;
    }
  }

  return { resolveSeries, resolveEpisode, resolveMovie };
}

module.exports = { createArrCatalog, nameKey };
