const axios = require('axios');
const BaseAdapter = require('./baseAdapter');
const logger = require('../../../logger');

class EmbyAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
    this.url = config.embyUrl;
    this.apiKey = config.embyApiKey;
    this.userId = config.embyUserId;
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
      logger.error({ err }, 'emby listUsers failed');
      return [];
    }
  }

  async triggerLibraryScan() {
    try {
      await axios.post(`${this.url}/Library/Refresh`, null, { headers: this._headers() });
    } catch (err) {
      logger.error({ err }, 'emby triggerLibraryScan failed');
    }
  }

  async resolveItemIdByFilepath(filepath) {
    try {
      const params = {
        userId: this.userId,
        includeItemTypes: 'Video,Movie,Episode',
        recursive: true,
        fields: 'Path',
      };
      const res = await axios.get(`${this.url}/Items`, { headers: this._headers(), params });
      const items = res.data?.Items || [];
      const match = items.find((i) => i.Path === filepath);
      return match ? match.Id : null;
    } catch (err) {
      logger.error({ err, filepath }, 'emby resolveItemIdByFilepath failed');
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
      logger.error({ err }, 'emby getPlaylistByName failed');
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

  async replacePlaylistItems(playlistId, itemIds) {
    const existing = await axios.get(`${this.url}/Playlists/${playlistId}/Items`, {
      headers: this._headers(), params: { userId: this.userId },
    });
    const entryIds = (existing.data?.Items || []).map((i) => i.PlaylistItemId).filter(Boolean);
    if (entryIds.length > 0) {
      await axios.delete(`${this.url}/Playlists/${playlistId}/Items`, {
        headers: this._headers(),
        params: { EntryIds: entryIds.join(',') },
      });
    }
    if (itemIds.length > 0) {
      await axios.post(`${this.url}/Playlists/${playlistId}/Items`, null, {
        headers: this._headers(),
        params: { Ids: itemIds.join(','), UserId: this.userId },
      });
    }
  }
}

module.exports = EmbyAdapter;
