/**
 * BaseAdapter — interface contract for media-server adapters.
 * Concrete adapters (plex, jellyfin, emby) extend this and implement all
 * methods. Each concrete adapter must also set `this.serverType` in its
 * constructor ('plex' | 'jellyfin' | 'emby'); orchestration and routes key on
 * that property, never on class names.
 */
class BaseAdapter {
  constructor(config) { this.config = config; }

  async testConnection() { throw new Error('not implemented'); }
  async listUsers() { throw new Error('not implemented'); }
  async triggerLibraryScan(/* subfolder, opts: { mediaType } */) { throw new Error('not implemented'); }
  async resolveItemIdByFilepath(/* filepath */) { throw new Error('not implemented'); }

  /**
   * Batch filepath resolution. Returns Map<filepath, itemId|null>. The default
   * resolves one file at a time; adapters with a cheaper bulk strategy override
   * this (Plex indexes each library section's full listing once per call).
   * Results are never cached across calls: callers polling for an in-flight
   * library scan re-call this per round and must observe fresh server state.
   */
  async resolveItemIdsByFilepaths(filepaths) {
    const results = new Map();
    for (const filepath of filepaths || []) {
      results.set(filepath, await this.resolveItemIdByFilepath(filepath));
    }
    return results;
  }
  async createPlaylist(/* name, itemIds, opts */) { throw new Error('not implemented'); }
  async replacePlaylistItems(/* id, itemIds */) { throw new Error('not implemented'); }

  /**
   * Watch state for file-backed items in the libraries the adapter tracks for
   * watch state (video libraries in v1), per server user. Returns
   *   { entries: Array<{ path, serverUserId, played, playCount, positionMs,
   *                      percentWatched, lastWatchedAt }>,
   *     users: Array<{ id, name }>,
   *     completeUserIds?: Array<string> }
   * where `users` lists the accounts the adapter observed (empty in
   * single-user mode so stored names are never clobbered), and
   * `completeUserIds` names the accounts whose entries include every watched
   * or in-progress item, so a stored watched/in-progress state missing from
   * them has been cleared on the server (Jellyfin/Emby list only such
   * items). Adapters accept an
   * opts object; `opts.since` is an incremental watermark only Plex uses (its
   * non-owner data comes from the server's play history), and
   * `opts.libraryIds` (a Set, or null for every library) limits Plex's section
   * listings to the libraries that hold Youtarr's folders. Throws
   * MediaServerUnavailableError when the server is unreachable.
   */
  async fetchWatchStates(/* opts: { since, libraryIds } */) { throw new Error('not implemented'); }

  /**
   * Items for files Youtarr moved: for each file, the item whose path shares
   * the most trailing segments with it, with that count (the score), or null.
   * The caller compares the scores of a video's new and old paths, because
   * until the server rescans, the stale item at the old path still shares the
   * file name (and, between two TV folders, the show and season folders too).
   * `opts.libraryIds` (a Set, or null for every library) limits the search to
   * the libraries that hold Youtarr's folders.
   * Returns Map<filepath, {id, score}|null>.
   */
  async resolveItemMatchesByPaths(/* filepaths, opts: { libraryIds } */) { throw new Error('not implemented'); }

  /**
   * One server user's current watch state of an item, read before a push so
   * a state at least as watched (or watched since) is left alone. Resolves to
   * { played, playCount, positionMs, percentWatched, lastWatchedAt }, or null
   * when it cannot be read (the push then proceeds).
   * @param {string} itemId
   * @param {string} serverUserId
   */
  async getWatchState(/* itemId, serverUserId */) { return null; }

  /**
   * Write one server user's watch state for an item: played, or a resume
   * position. Used to restore watch state after a reorganize moved the file.
   * @param {string} itemId
   * @param {string} serverUserId
   * @param {{played: boolean, positionMs: number|null}} state
   */
  async setWatchState(/* itemId, serverUserId, state */) { throw new Error('not implemented'); }

  /**
   * The server's libraries, for the library check and listing scopes:
   * Array<{ id, name, type, locations, agent?, scanner?, nfoSaver?, onlineFetchers? }>
   * where type is one of LIBRARY_TYPES, locations are the server's own paths,
   * agent/scanner are Plex's, and nfoSaver/onlineFetchers are Jellyfin's and
   * Emby's (true, false, or null when unknown). Throws on a request failure.
   */
  async listLibraries() { throw new Error('not implemented'); }

  /**
   * A few file paths from one library (the first items it lists), so the
   * caller can find which server path holds which of Youtarr's folders.
   * Resolves to [] when the library can't be read.
   * @param {Object} library - One of listLibraries()'s entries
   * @param {number} limit
   */
  async sampleItemPaths(/* library, limit */) { return []; }
}

// Library kinds, from each server's own type names.
const LIBRARY_TYPES = Object.freeze({
  VIDEOS: 'videos', // Plex Movies/Other Videos, Jellyfin/Emby Movies and Home Videos
  TV: 'tv',
  MIXED: 'mixed', // Jellyfin/Emby Mixed Movies and Shows
  MUSIC: 'music',
  OTHER: 'other',
});

/**
 * Pick, for each file path, the item whose path shares the most trailing
 * segments with it (at least the file name), with that count.
 *
 * @param {Array<{id: string, path: string}>} items
 * @param {string[]} filepaths
 * @returns {Map<string, {id: string, score: number}|null>}
 */
function bestItemMatchesByPath(items, filepaths) {
  const byBasename = new Map();
  for (const item of items) {
    if (!item.path) continue;
    const base = extractBasename(item.path);
    if (!byBasename.has(base)) byBasename.set(base, []);
    byBasename.get(base).push({ id: item.id, segments: pathSegments(item.path) });
  }
  const results = new Map();
  for (const filepath of filepaths) {
    const target = pathSegments(filepath);
    let best = null;
    for (const candidate of byBasename.get(extractBasename(filepath)) || []) {
      const score = trailingSegmentMatch(target, candidate.segments);
      if (!best || score > best.score) best = { id: candidate.id, score };
    }
    results.set(filepath, best);
  }
  return results;
}

/**
 * Cross-platform basename extraction. Node's `path.basename()` is OS-aware —
 * on a Linux container it doesn't treat `\` as a separator, which breaks
 * matching when the media server runs on Windows (Plex reports files as
 * `Q:\Media\Channel\file.mp4`). This helper splits on either separator.
 */
function extractBasename(p) {
  if (!p) return '';
  const match = String(p).match(/[^\\/]+$/);
  return match ? match[0] : '';
}

/**
 * Split a path into its non-empty segments, treating both `/` and `\` as
 * separators so Linux and Windows paths compare uniformly.
 */
function pathSegments(p) {
  return String(p || '').split(/[\\/]+/).filter(Boolean);
}

/**
 * Count how many trailing segments two segment lists share. Used to pick the
 * media-server item whose path best matches the real file location when the same
 * basename appears in multiple libraries (e.g. a stale item left behind after a
 * file moved between libraries). Mount-prefix differences (Q:\Media vs
 * /usr/src/app/data) simply don't match and are ignored; the meaningful tail
 * (subfolder/channel/video/file) is what disambiguates.
 */
function trailingSegmentMatch(aSegments, bSegments) {
  let i = aSegments.length - 1;
  let j = bSegments.length - 1;
  let matched = 0;
  while (i >= 0 && j >= 0 && aSegments[i] === bSegments[j]) {
    matched += 1;
    i -= 1;
    j -= 1;
  }
  return matched;
}

// Per-request HTTP timeout for adapter calls. Axios defaults to NO timeout,
// so a black-holed media server would hang a sync forever; section listings
// on large libraries are the slowest legitimate call, hence 30s.
const REQUEST_TIMEOUT_MS = 30000;

// Raised by an adapter when a media server can't be reached or isn't
// responding (connection refused, timeout, DNS failure, or a 5xx such as
// Jellyfin's "loading" 503). Lets the sync abort its resolve/backoff loop
// instead of retrying an unreachable server through every round.
class MediaServerUnavailableError extends Error {
  constructor(info = {}) {
    super(info.message || 'media server unavailable');
    this.name = 'MediaServerUnavailableError';
    this.status = info.status || null;
    this.code = info.code || null;
  }
}

// Raised by an adapter when a watch-state fetch failed with a message that is
// already user-presentable. watchStatusSync passes it through to the sync
// summary (and thus the UI) verbatim; other unexpected errors are reduced to
// a generic message there.
class WatchStateFetchError extends Error {
  constructor(message) {
    super(message);
    this.name = 'WatchStateFetchError';
  }
}

/**
 * Normalize a user-entered media server base URL: trim whitespace and strip
 * trailing slashes so `${url}/Users` never produces `//Users`.
 */
function normalizeBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

// True when an axios error means the server itself is unreachable or not
// responding, rather than a normal "queried fine, no such item" result. No
// response at all (ECONNREFUSED / ETIMEDOUT / ENOTFOUND / timeout) or any 5xx
// counts; a plain Error (e.g. a programming bug) does not.
function isServerUnavailableError(err) {
  if (!err || !err.isAxiosError) return false;
  return !err.response || err.response.status >= 500;
}

// Compact, log-safe view of an axios error. Deliberately omits config / request
// / response, which carry the request headers (and therefore the API token)
// that the default error serializer would otherwise dump into the logs.
function describeHttpError(err) {
  if (!err) return { message: 'unknown error' };
  return {
    status: err.response?.status || null,
    code: err.code || null,
    message: err.message || String(err),
  };
}

module.exports = BaseAdapter;
module.exports.extractBasename = extractBasename;
module.exports.pathSegments = pathSegments;
module.exports.trailingSegmentMatch = trailingSegmentMatch;
module.exports.bestItemMatchesByPath = bestItemMatchesByPath;
module.exports.LIBRARY_TYPES = LIBRARY_TYPES;
module.exports.normalizeBaseUrl = normalizeBaseUrl;
module.exports.REQUEST_TIMEOUT_MS = REQUEST_TIMEOUT_MS;
module.exports.MediaServerUnavailableError = MediaServerUnavailableError;
module.exports.WatchStateFetchError = WatchStateFetchError;
module.exports.isServerUnavailableError = isServerUnavailableError;
module.exports.describeHttpError = describeHttpError;
