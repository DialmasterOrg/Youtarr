// Reads from the user's own Sonarr and Radarr: the series list, one series'
// episodes, the movie list, who the app is, and the folders it sees at a
// path. Read-only, and it returns slim rows, because a large library's full
// answer runs to tens of megabytes.
const axios = require('axios');

const ARR_REQUEST_TIMEOUT_MS = 10000;
const ARR_MAX_RESPONSE_BYTES = 64 * 1024 * 1024;
// The status answer is a small object; a larger body is not Sonarr or Radarr.
const ARR_MAX_STATUS_BYTES = 256 * 1024;
// The staging folder holds a folder per category and one per waiting grab.
const ARR_MAX_FOLDER_LIST_BYTES = 4 * 1024 * 1024;
// "The download folder was imported", as a history filter and as a record
// reads it, in Sonarr and in Radarr.
const IMPORTED_EVENT_TYPE = 3;
const IMPORTED_EVENT_NAME = 'downloadFolderImported';
const HISTORY_PAGE_SIZE = 10;
const ARR_MAX_HISTORY_BYTES = 4 * 1024 * 1024;
const SECONDS_PER_MINUTE = 60;

const MESSAGES = {
  unauthorized: 'the API key was rejected',
  redirect: 'the URL answers with a redirect; use the address it redirects to',
  'not-json': 'the answer was not a list; the URL may point at a login page or another app',
  unreachable: 'no usable answer',
};

/**
 * Deliberately holds no reference to the axios error: its config and
 * request carry the API key, and a logged error would write it out.
 */
class ArrUnavailableError extends Error {
  /**
   * @param {'unauthorized'|'redirect'|'not-json'|'unreachable'} reason
   * @param {{status?: number|null, code?: string|null}} [details]
   */
  constructor(reason, { status = null, code = null } = {}) {
    super(MESSAGES[reason]);
    this.name = 'ArrUnavailableError';
    this.reason = reason;
    this.status = status;
    this.code = code;
  }
}

function toUnavailable(error) {
  const status = error?.response?.status ?? null;
  const code = typeof error?.code === 'string' ? error.code : null;
  if (status === 401 || status === 403) return new ArrUnavailableError('unauthorized', { status, code });
  if (status >= 300 && status < 400) return new ArrUnavailableError('redirect', { status, code });
  return new ArrUnavailableError('unreachable', { status, code });
}

const isRow = (row) => Boolean(row) && typeof row === 'object';
const runtimeSeconds = (minutes) => (
  typeof minutes === 'number' && minutes > 0 ? Math.round(minutes * SECONDS_PER_MINUTE) : null
);
const titlesOf = (entries) => (Array.isArray(entries) ? entries : [])
  .map((entry) => entry?.title)
  .filter((title) => typeof title === 'string' && title.trim() !== '');
const isYear = (value) => Number.isInteger(value) && value > 0;

// Sonarr searches an alias that has a scene season under that season's
// number ("Power Rangers Dino Fury" season 1 is season 28 of the series), so
// the request's numbers would be looked up as another episode's.
const hasSceneSeason = (entry) => Number.isInteger(entry?.sceneSeasonNumber) && entry.sceneSeasonNumber >= 0;

function toSeries(row) {
  if (!isRow(row) || !Number.isInteger(row.id) || typeof row.title !== 'string' || !row.title.trim()) return null;
  const aliases = (Array.isArray(row.alternateTitles) ? row.alternateTitles : [])
    .filter((entry) => !hasSceneSeason(entry));
  return {
    id: row.id,
    title: row.title,
    titles: titlesOf(aliases),
    year: isYear(row.year) ? row.year : null,
    runtimeSeconds: runtimeSeconds(row.runtime),
    sceneNumbering: row.useSceneNumbering === true,
  };
}

function toEpisode(row) {
  if (!isRow(row) || !Number.isInteger(row.seasonNumber) || !Number.isInteger(row.episodeNumber)) return null;
  return {
    season: row.seasonNumber,
    episode: row.episodeNumber,
    title: typeof row.title === 'string' ? row.title : '',
    runtimeSeconds: runtimeSeconds(row.runtime),
    absoluteNumber: Number.isInteger(row.absoluteEpisodeNumber) ? row.absoluteEpisodeNumber : null,
  };
}

function toMovie(row) {
  if (!isRow(row) || !Number.isInteger(row.id) || typeof row.title !== 'string' || !row.title.trim()) return null;
  const others = [row.originalTitle, ...titlesOf(row.alternateTitles)]
    .filter((title) => typeof title === 'string' && title.trim() !== '' && title !== row.title);
  return {
    id: row.id,
    title: row.title,
    titles: [...new Set(others)],
    years: [row.year, row.secondaryYear].filter(isYear),
    runtimeSeconds: runtimeSeconds(row.runtime),
  };
}

/**
 * @param {Object} [deps]
 * @param {Object} [deps.http] - axios, or a stand-in with the same get()
 * @param {number} [deps.timeoutMs] - The most one read may take
 */
function createArrClient({ http = axios, timeoutMs = ARR_REQUEST_TIMEOUT_MS } = {}) {
  // Every failure becomes an ArrUnavailableError. Redirects are not
  // followed: the key header would be sent on to wherever they point.
  async function get(connection, path, { params, maxBytes = ARR_MAX_RESPONSE_BYTES } = {}) {
    try {
      const response = await http.get(`${connection.url}${path}`, {
        headers: { 'X-Api-Key': connection.apiKey },
        params,
        // axios's timeout only limits the wait between bytes; the signal
        // ends an answer that keeps trickling in.
        timeout: timeoutMs,
        signal: AbortSignal.timeout(timeoutMs),
        maxRedirects: 0,
        maxContentLength: maxBytes,
      });
      return response?.data;
    } catch (error) {
      throw toUnavailable(error);
    }
  }

  async function getList(connection, path, params) {
    const data = await get(connection, path, { params });
    if (!Array.isArray(data)) throw new ArrUnavailableError('not-json');
    return data;
  }

  /**
   * Who answers at this address. Used by the Settings page's connection test.
   * @param {{url: string, apiKey: string}} connection
   * @returns {Promise<{appName: string, version: string}>}
   */
  async function fetchStatus(connection) {
    const data = await get(connection, '/api/v3/system/status', { maxBytes: ARR_MAX_STATUS_BYTES });
    if (!isRow(data) || typeof data.appName !== 'string') throw new ArrUnavailableError('not-json');
    return { appName: data.appName, version: typeof data.version === 'string' ? data.version : '' };
  }

  /**
   * The folders the app itself sees inside a folder. A path it cannot see
   * lists nothing. Used to check that it can reach the staging folder.
   * @param {{url: string, apiKey: string}} connection
   * @param {string} folderPath - An absolute path, as the app knows it
   * @returns {Promise<string[]>} Folder names
   */
  async function fetchFolderNames(connection, folderPath) {
    // Without the trailing slash the app lists the parent, filtered by name.
    const data = await get(connection, '/api/v3/filesystem', {
      params: { path: `${String(folderPath).replace(/\/+$/, '')}/`, includeFiles: false },
      maxBytes: ARR_MAX_FOLDER_LIST_BYTES,
    });
    if (!isRow(data) || !Array.isArray(data.directories)) throw new ArrUnavailableError('not-json');
    return data.directories.map((entry) => entry?.name).filter((name) => typeof name === 'string');
  }

  /**
   * Whether the app's history holds an import of this download. The app
   * records the download client's item id as the download id.
   * @param {{url: string, apiKey: string}} connection
   * @param {string} downloadId - The grab id
   * @returns {Promise<boolean>}
   */
  async function fetchImported(connection, downloadId) {
    const data = await get(connection, '/api/v3/history', {
      params: { downloadId, eventType: IMPORTED_EVENT_TYPE, pageSize: HISTORY_PAGE_SIZE },
      maxBytes: ARR_MAX_HISTORY_BYTES,
    });
    if (!isRow(data) || !Array.isArray(data.records)) throw new ArrUnavailableError('not-json');
    const wanted = String(downloadId).toLowerCase();
    return data.records.some((record) => isRow(record)
      && record.eventType === IMPORTED_EVENT_NAME
      && typeof record.downloadId === 'string'
      && record.downloadId.toLowerCase() === wanted);
  }

  /**
   * @param {{url: string, apiKey: string}} connection
   * @returns {Promise<Array<{id: number, title: string, titles: string[], year: number|null,
   *   runtimeSeconds: number|null, sceneNumbering: boolean}>>}
   */
  async function fetchSeries(connection) {
    return (await getList(connection, '/api/v3/series')).map(toSeries).filter(Boolean);
  }

  /**
   * @param {{url: string, apiKey: string}} connection
   * @param {number} seriesId
   * @returns {Promise<Array<{season: number, episode: number, title: string,
   *   runtimeSeconds: number|null, absoluteNumber: number|null}>>}
   */
  async function fetchEpisodes(connection, seriesId) {
    return (await getList(connection, '/api/v3/episode', { seriesId })).map(toEpisode).filter(Boolean);
  }

  /**
   * @param {{url: string, apiKey: string}} connection
   * @returns {Promise<Array<{id: number, title: string, titles: string[],
   *   years: number[], runtimeSeconds: number|null}>>}
   */
  async function fetchMovies(connection) {
    return (await getList(connection, '/api/v3/movie')).map(toMovie).filter(Boolean);
  }

  return { fetchSeries, fetchEpisodes, fetchMovies, fetchStatus, fetchFolderNames, fetchImported };
}

module.exports = { createArrClient, ArrUnavailableError, ARR_REQUEST_TIMEOUT_MS };
