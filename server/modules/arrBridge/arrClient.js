// Read-only calls to the user's own Sonarr and Radarr: who the app is and
// where it runs, what it makes of a release name, one series with its aliases,
// a series' episodes, the series list, the folders it sees at a path, its
// Remote Path Mappings, the host it has for Youtarr as a download client, and
// whether a download was imported. It returns slim rows, because a full
// answer runs to tens of MB.
const axios = require('axios');
const { withTrailingSeparator } = require('./clientPaths');

const ARR_REQUEST_TIMEOUT_MS = 10000;
// The whole series list of a large library is slow to answer.
const ARR_LIST_TIMEOUT_MS = 60000;
const ARR_MAX_RESPONSE_BYTES = 64 * 1024 * 1024;
// A parse answer or one series is a single row.
const ARR_MAX_PARSE_BYTES = 4 * 1024 * 1024;
// The status answer is a small object; a larger body is not Sonarr or Radarr.
const ARR_MAX_STATUS_BYTES = 256 * 1024;
// The staging folder holds a folder per category and one per waiting grab.
const ARR_MAX_FOLDER_LIST_BYTES = 4 * 1024 * 1024;
// The app's download clients and Remote Path Mappings are short lists.
const ARR_MAX_SETTINGS_BYTES = 4 * 1024 * 1024;
// How the apps name the SABnzbd download client, and the URL Base the
// bridge is added under (routes/arrBridge.js serves /arr/sabnzbd).
const SABNZBD_IMPLEMENTATION = 'Sabnzbd';
const BRIDGE_URL_BASE = 'arr/sabnzbd';
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
  timeout: 'no answer in time',
  'too-large': 'the answer was larger than Youtarr reads',
  unreachable: 'no usable answer',
};

/**
 * Deliberately holds no reference to the axios error: its config and
 * request carry the API key, and a logged error would write it out.
 */
class ArrUnavailableError extends Error {
  /**
   * @param {'unauthorized'|'redirect'|'not-json'|'timeout'|'too-large'|'unreachable'} reason
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

const TIMEOUT_CODES = new Set(['ERR_CANCELED', 'ECONNABORTED', 'ETIMEDOUT']);

// axios 1.x reports a body over maxContentLength as ERR_BAD_RESPONSE with
// this text in the message; nothing else marks it.
function isTooLarge(error) {
  return error?.code === 'ERR_BAD_RESPONSE'
    && typeof error.message === 'string'
    && error.message.includes('maxContentLength');
}

function toUnavailable(error) {
  const status = error?.response?.status ?? null;
  const code = typeof error?.code === 'string' ? error.code : null;
  if (status === 401 || status === 403) return new ArrUnavailableError('unauthorized', { status, code });
  if (status >= 300 && status < 400) return new ArrUnavailableError('redirect', { status, code });
  if (TIMEOUT_CODES.has(code)) return new ArrUnavailableError('timeout', { status, code });
  if (isTooLarge(error)) return new ArrUnavailableError('too-large', { status, code });
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
 * @param {number} [deps.listTimeoutMs] - The most the series list may take
 */
function createArrClient({
  http = axios, timeoutMs = ARR_REQUEST_TIMEOUT_MS, listTimeoutMs = ARR_LIST_TIMEOUT_MS,
} = {}) {
  // Every failure becomes an ArrUnavailableError. Redirects are not
  // followed: the key header would be sent on to wherever they point.
  async function get(connection, path, {
    params, maxBytes = ARR_MAX_RESPONSE_BYTES, timeoutMs: limitMs = timeoutMs,
  } = {}) {
    try {
      const response = await http.get(`${connection.url}${path}`, {
        headers: { 'X-Api-Key': connection.apiKey },
        params,
        // axios's timeout only limits the wait between bytes; the signal
        // ends an answer that keeps trickling in.
        timeout: limitMs,
        signal: AbortSignal.timeout(limitMs),
        maxRedirects: 0,
        maxContentLength: maxBytes,
      });
      return response?.data;
    } catch (error) {
      throw toUnavailable(error);
    }
  }

  async function getList(connection, path, params, options) {
    const data = await get(connection, path, { params, ...options });
    if (!Array.isArray(data)) throw new ArrUnavailableError('not-json');
    return data;
  }

  /**
   * Who answers at this address, and where it runs. Used by the Settings
   * page's connection test and its shared folder check.
   * @param {{url: string, apiKey: string}} connection
   * @returns {Promise<{appName: string, version: string, isDocker: boolean, isWindows: boolean}>}
   */
  async function fetchStatus(connection) {
    const data = await get(connection, '/api/v3/system/status', { maxBytes: ARR_MAX_STATUS_BYTES });
    if (!isRow(data) || typeof data.appName !== 'string') throw new ArrUnavailableError('not-json');
    return {
      appName: data.appName,
      version: typeof data.version === 'string' ? data.version : '',
      isDocker: data.isDocker === true,
      isWindows: data.isWindows === true,
    };
  }

  /**
   * The folders the app itself sees inside a folder. A path it cannot see
   * lists nothing. Used to check that it can reach the staging folder.
   * @param {{url: string, apiKey: string}} connection
   * @param {string} folderPath - An absolute path, as the app knows it
   * @returns {Promise<string[]>} Folder names
   */
  async function fetchFolderNames(connection, folderPath) {
    // Without the trailing separator the app lists the parent, filtered by name.
    const data = await get(connection, '/api/v3/filesystem', {
      params: { path: withTrailingSeparator(folderPath), includeFiles: false },
      maxBytes: ARR_MAX_FOLDER_LIST_BYTES,
    });
    if (!isRow(data) || !Array.isArray(data.directories)) throw new ArrUnavailableError('not-json');
    return data.directories.map((entry) => entry?.name).filter((name) => typeof name === 'string');
  }

  /**
   * The Remote Path Mappings set up in the app: how it translates a path a
   * download client reports into one it can open.
   * @param {{url: string, apiKey: string}} connection
   * @returns {Promise<Array<{host: string, remotePath: string, localPath: string}>>}
   */
  async function fetchRemotePathMappings(connection) {
    const rows = await getList(connection, '/api/v3/remotepathmapping', undefined, { maxBytes: ARR_MAX_SETTINGS_BYTES });
    return rows
      .filter((row) => isRow(row)
        && typeof row.host === 'string' && typeof row.remotePath === 'string' && typeof row.localPath === 'string')
      .map(({ host, remotePath, localPath }) => ({ host, remotePath, localPath }));
  }

  /**
   * The Host the app has for Youtarr as a download client: a Remote Path
   * Mapping only applies to the download client whose Host it names.
   * @param {{url: string, apiKey: string}} connection
   * @returns {Promise<string[]>} One host per SABnzbd client that points at the bridge
   */
  async function fetchBridgeClientHosts(connection) {
    const rows = await getList(connection, '/api/v3/downloadclient', undefined, { maxBytes: ARR_MAX_SETTINGS_BYTES });
    const fieldOf = (row, name) => (Array.isArray(row.fields) ? row.fields : [])
      .find((field) => isRow(field) && field.name === name)?.value;
    return rows
      .filter((row) => isRow(row) && row.implementation === SABNZBD_IMPLEMENTATION)
      .filter((row) => {
        const urlBase = fieldOf(row, 'urlBase');
        return typeof urlBase === 'string' && urlBase.replace(/^\/+|\/+$/g, '').toLowerCase() === BRIDGE_URL_BASE;
      })
      .map((row) => fieldOf(row, 'host'))
      .filter((host) => typeof host === 'string' && host.trim() !== '')
      .map((host) => host.trim());
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
    const list = await getList(connection, '/api/v3/series', undefined, { timeoutMs: listTimeoutMs });
    return list.map(toSeries).filter(Boolean);
  }

  /**
   * One series with its aliases, as the series list would return it.
   * @param {{url: string, apiKey: string}} connection
   * @param {number} seriesId
   * @returns {Promise<{id: number, title: string, titles: string[], year: number|null,
   *   runtimeSeconds: number|null, sceneNumbering: boolean}>}
   */
  async function fetchSeriesById(connection, seriesId) {
    const data = await get(connection, `/api/v3/series/${encodeURIComponent(seriesId)}`, {
      maxBytes: ARR_MAX_PARSE_BYTES,
    });
    const series = Array.isArray(data) ? null : toSeries(data);
    if (!series) throw new ArrUnavailableError('not-json');
    return series;
  }

  async function parseRelease(connection, releaseTitle) {
    const data = await get(connection, '/api/v3/parse', {
      params: { title: releaseTitle },
      maxBytes: ARR_MAX_PARSE_BYTES,
    });
    if (!isRow(data) || Array.isArray(data)) throw new ArrUnavailableError('not-json');
    return data;
  }

  /**
   * What Sonarr reads a release name as. A name it does not know answers
   * without a series.
   * @param {{url: string, apiKey: string}} connection
   * @param {string} releaseTitle
   * @returns {Promise<{series: {id: number, title: string, titles: string[], year: number|null,
   *   runtimeSeconds: number|null, sceneNumbering: boolean}|null, episodes: Array<{season: number,
   *   episode: number, title: string, runtimeSeconds: number|null, absoluteNumber: number|null}>}>}
   */
  async function fetchParsedEpisode(connection, releaseTitle) {
    const data = await parseRelease(connection, releaseTitle);
    return {
      series: toSeries(data.series),
      episodes: (Array.isArray(data.episodes) ? data.episodes : []).map(toEpisode).filter(Boolean),
    };
  }

  /**
   * What Radarr reads a release name as, or null when it does not know it.
   * @param {{url: string, apiKey: string}} connection
   * @param {string} releaseTitle
   * @returns {Promise<{id: number, title: string, years: number[], runtimeSeconds: number|null}|null>}
   */
  async function fetchParsedMovie(connection, releaseTitle) {
    const movie = toMovie((await parseRelease(connection, releaseTitle)).movie);
    if (!movie) return null;
    return {
      id: movie.id, title: movie.title, years: movie.years, runtimeSeconds: movie.runtimeSeconds,
    };
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

  return {
    fetchSeries,
    fetchSeriesById,
    fetchParsedEpisode,
    fetchParsedMovie,
    fetchEpisodes,
    fetchStatus,
    fetchFolderNames,
    fetchRemotePathMappings,
    fetchBridgeClientHosts,
    fetchImported,
  };
}

module.exports = {
  createArrClient,
  ArrUnavailableError,
  ARR_REQUEST_TIMEOUT_MS,
  ARR_LIST_TIMEOUT_MS,
  ARR_MAX_PARSE_BYTES,
};
