/**
 * BaseAdapter — interface contract for media-server adapters.
 * Concrete adapters (plex, jellyfin, emby) extend this and implement all methods.
 */
class BaseAdapter {
  constructor(config) { this.config = config; }

  async testConnection() { throw new Error('not implemented'); }
  async listUsers() { throw new Error('not implemented'); }
  async triggerLibraryScan(/* subfolder */) { throw new Error('not implemented'); }
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
  async getPlaylistByName(/* name */) { throw new Error('not implemented'); }
  async createPlaylist(/* name, itemIds, opts */) { throw new Error('not implemented'); }
  async replacePlaylistItems(/* id, itemIds */) { throw new Error('not implemented'); }
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

module.exports = BaseAdapter;
module.exports.extractBasename = extractBasename;
module.exports.pathSegments = pathSegments;
module.exports.trailingSegmentMatch = trailingSegmentMatch;
module.exports.REQUEST_TIMEOUT_MS = REQUEST_TIMEOUT_MS;
