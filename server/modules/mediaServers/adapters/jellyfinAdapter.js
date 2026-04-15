const axios = require('axios');
const BaseAdapter = require('./baseAdapter');
const { extractBasename } = require('./baseAdapter');
const logger = require('../../../logger');

class JellyfinAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
    this.url = config.jellyfinUrl;
    this.apiKey = config.jellyfinApiKey;
    this.userId = config.jellyfinUserId;
  }

  _headers() { return { 'X-Emby-Token': this.apiKey }; }

  async testConnection() {
    try {
      const res = await axios.get(`${this.url}/System/Info/Public`, { headers: this._headers() });
      return { ok: true, version: res.data?.Version };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  async listUsers() {
    try {
      const res = await axios.get(`${this.url}/Users`, { headers: this._headers() });
      return (res.data || []).map((u) => ({ id: u.Id, name: u.Name }));
    } catch (err) {
      logger.error({ err }, 'jellyfin listUsers failed');
      return [];
    }
  }

  async triggerLibraryScan() {
    try {
      await axios.post(`${this.url}/Library/Refresh`, null, { headers: this._headers() });
    } catch (err) {
      logger.error({ err }, 'jellyfin triggerLibraryScan failed');
    }
  }

  async resolveItemIdByFilepath(filepath) {
    // Match by filename across different mount views (supports Windows paths
    // via extractBasename which splits on both / and \).
    const target = extractBasename(filepath);
    try {
      const params = {
        userId: this.userId,
        includeItemTypes: 'Video,Movie,Episode',
        recursive: true,
        fields: 'Path',
      };
      const res = await axios.get(`${this.url}/Items`, { headers: this._headers(), params });
      const items = res.data?.Items || [];
      const match = items.find((i) => i.Path && extractBasename(i.Path) === target);
      return match ? match.Id : null;
    } catch (err) {
      logger.error({ err, filepath }, 'jellyfin resolveItemIdByFilepath failed');
      return null;
    }
  }

  async getPlaylistByName(name) {
    try {
      const params = { userId: this.userId, includeItemTypes: 'Playlist', recursive: true };
      const res = await axios.get(`${this.url}/Items`, { headers: this._headers(), params });
      const items = res.data?.Items || [];
      const found = items.find((i) => i.Name === name);
      return found ? { id: found.Id, itemIds: [] } : null;
    } catch (err) {
      logger.error({ err }, 'jellyfin getPlaylistByName failed');
      return null;
    }
  }

  async createPlaylist(name, itemIds, opts = {}) {
    const body = {
      Name: name,
      Ids: itemIds,
      UserId: this.userId,
      MediaType: 'Video',
      IsPublic: !!opts.public,
    };
    const res = await axios.post(`${this.url}/Playlists`, body, { headers: this._headers() });
    return { id: res.data?.Id };
  }

  async replacePlaylistItems(playlistId, itemIds, opts = {}) {
    if (!opts.name) {
      throw new Error('replacePlaylistItems requires opts.name to recreate the playlist');
    }
    // Jellyfin's DELETE /Playlists/{id}/Items has version-specific quirks that
    // return 400 on current versions. Simpler and more reliable: delete the
    // whole playlist via DELETE /Items/{id} and recreate.
    // Tolerate a stale playlistId (e.g. user deleted the playlist manually or
    // the server state drifted) — log and fall through to create-fresh.
    try {
      await axios.delete(`${this.url}/Items/${playlistId}`, { headers: this._headers() });
    } catch (err) {
      const status = err.response?.status;
      logger.warn({ status, playlistId }, 'jellyfin replacePlaylistItems: delete failed, creating fresh');
    }
    return this.createPlaylist(opts.name, itemIds, { public: !!opts.public });
  }
}

module.exports = JellyfinAdapter;
