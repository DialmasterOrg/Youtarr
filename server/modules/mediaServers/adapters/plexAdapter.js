const axios = require('axios');
const BaseAdapter = require('./baseAdapter');
const { extractBasename } = require('./baseAdapter');
const logger = require('../../../logger');
const plexModule = require('../../plexModule');

class PlexAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
    this.url = config.plexUrl;
    this.token = config.plexApiKey;
    this.libraryId = config.plexYoutubeLibraryId;
    // Optional override for playlist-scoped operations. Useful when the admin
    // token belongs to a different Plex account than the one used by the Plex
    // Web session (e.g., unclaimed dev servers where Plex Web uses no token).
    // - undefined/null -> fall back to plexApiKey (standard case)
    // - "" (empty string) -> send requests with NO token (anonymous access on
    //   servers that allow unauthenticated LAN access)
    // - "some-token" -> use that token for playlist scope
    const override = config.plexPlaylistToken;
    this.playlistToken = (override === undefined || override === null) ? this.token : override;
  }

  // Build params for playlist-scoped requests. Conditionally omits X-Plex-Token
  // when the resolved playlistToken is empty, so Plex treats the call as
  // anonymous (works when the server is set up for unauthenticated LAN access).
  _plParams(extra = {}) {
    const params = { ...extra };
    if (this.playlistToken) params['X-Plex-Token'] = this.playlistToken;
    return params;
  }

  async testConnection() {
    try {
      await axios.get(`${this.url}/identity`, { params: { 'X-Plex-Token': this.token } });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  async listUsers() { return []; }

  async triggerLibraryScan(subfolder) {
    return plexModule.refreshLibrariesForSubfolders([subfolder].filter(Boolean));
  }

  async resolveItemIdByFilepath(filepath) {
    // Match by filename across different mount views. Youtarr sees e.g.
    // /usr/src/app/data/...; Plex may report Windows paths like Q:\Media\...
    // Use extractBasename which handles both separators. YouTube video IDs
    // embedded in filenames (e.g. "Title [abc123].mp4") are globally unique.
    const target = extractBasename(filepath);
    try {
      const res = await axios.get(`${this.url}/library/sections/${this.libraryId}/all`, {
        params: this._plParams(),
      });
      const items = res.data?.MediaContainer?.Metadata || [];
      for (const item of items) {
        for (const media of item.Media || []) {
          for (const part of media.Part || []) {
            if (part.file && extractBasename(part.file) === target) return item.ratingKey;
          }
        }
      }
      return null;
    } catch (err) {
      logger.error({ err, filepath }, 'plex resolveItemIdByFilepath failed');
      return null;
    }
  }

  async getPlaylistByName(name) {
    try {
      const res = await axios.get(`${this.url}/playlists`, {
        params: this._plParams({ playlistType: 'video' }),
      });
      const found = (res.data?.MediaContainer?.Metadata || []).find((p) => p.title === name);
      if (!found) return null;
      return { id: found.ratingKey, itemIds: [] };
    } catch (err) {
      logger.error({ err }, 'plex getPlaylistByName failed');
      return null;
    }
  }

  async _getMachineId() {
    // /identity is server-wide info; use the admin token which is always valid.
    const res = await axios.get(`${this.url}/identity`, { params: { 'X-Plex-Token': this.token } });
    return res.data?.MediaContainer?.machineIdentifier;
  }

  async createPlaylist(name, itemIds) {
    const machineId = await this._getMachineId();
    const uri = `server://${machineId}/com.plexapp.plugins.library/library/metadata/${itemIds.join(',')}`;
    const res = await axios.post(`${this.url}/playlists`, null, {
      params: this._plParams({ type: 'video', title: name, smart: 0, uri }),
    });
    return { id: res.data?.MediaContainer?.Metadata?.[0]?.ratingKey };
  }

  async replacePlaylistItems(playlistId, itemIds) {
    await axios.delete(`${this.url}/playlists/${playlistId}/items`, {
      params: this._plParams(),
    });
    const machineId = await this._getMachineId();
    const uri = `server://${machineId}/com.plexapp.plugins.library/library/metadata/${itemIds.join(',')}`;
    await axios.put(`${this.url}/playlists/${playlistId}/items`, null, {
      params: this._plParams({ uri }),
    });
  }
}

module.exports = PlexAdapter;
