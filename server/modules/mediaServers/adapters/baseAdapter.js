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

module.exports = BaseAdapter;
module.exports.extractBasename = extractBasename;
