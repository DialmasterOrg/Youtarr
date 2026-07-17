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
   * watch state (video libraries in v1), as seen by the account this adapter
   * is configured with (Plex: the admin token's account; Jellyfin/Emby: the
   * configured userId). Returns
   * Array<{ path, played, playCount, positionMs, percentWatched, lastWatchedAt }>.
   * Throws MediaServerUnavailableError when the server is unreachable.
   */
  async fetchWatchStates() { throw new Error('not implemented'); }
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
module.exports.REQUEST_TIMEOUT_MS = REQUEST_TIMEOUT_MS;
module.exports.MediaServerUnavailableError = MediaServerUnavailableError;
module.exports.WatchStateFetchError = WatchStateFetchError;
module.exports.isServerUnavailableError = isServerUnavailableError;
module.exports.describeHttpError = describeHttpError;
