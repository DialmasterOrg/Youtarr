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

module.exports = BaseAdapter;
