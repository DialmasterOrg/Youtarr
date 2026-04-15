const axios = require('axios');
const BaseAdapter = require('./baseAdapter');
const { extractBasename } = require('./baseAdapter');
const logger = require('../../../logger');
const plexModule = require('../../plexModule');

// Sentinel value for config.plexPlaylistToken that tells the adapter to make
// playlist-scoped requests WITHOUT any X-Plex-Token, matching the anonymous
// session used by Plex Web on unclaimed servers that allow unauthenticated
// LAN access. Deliberately distinctive so no real token could collide.
const UNCLAIMED_SERVER_SENTINEL = 'UNCLAIMED_SERVER';

class PlexAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
    this.url = config.plexUrl;
    this.token = config.plexApiKey;
    this.libraryId = config.plexYoutubeLibraryId;
    // Optional override for playlist-scoped operations. Useful when the admin
    // token belongs to a different Plex account than the one used by the Plex
    // Web session.
    //   - null / "" / undefined  -> fall back to plexApiKey (standard case)
    //   - "UNCLAIMED_SERVER"     -> send requests with NO token (anonymous;
    //                                for unclaimed dev servers with unauth-LAN)
    //   - any other string       -> use that token for playlist scope
    const override = config.plexPlaylistToken;
    if (override === UNCLAIMED_SERVER_SENTINEL) {
      this.playlistToken = null; // marker: no token
    } else if (override && String(override).trim() !== '') {
      this.playlistToken = override;
    } else {
      this.playlistToken = this.token;
    }
  }

  // Build params for playlist-scoped requests. Conditionally omits X-Plex-Token
  // when playlistToken is null (UNCLAIMED_SERVER sentinel was configured).
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

  async replacePlaylistItems(playlistId, itemIds, opts = {}) {
    // Try in-place replace (delete items + PUT items). If the stored playlistId
    // no longer exists on the server (manually deleted, created under a
    // different account/token, server state drifted), the DELETE returns 404;
    // fall back to creating a fresh playlist.
    try {
      await axios.delete(`${this.url}/playlists/${playlistId}/items`, {
        params: this._plParams(),
      });
      const machineId = await this._getMachineId();
      const uri = `server://${machineId}/com.plexapp.plugins.library/library/metadata/${itemIds.join(',')}`;
      await axios.put(`${this.url}/playlists/${playlistId}/items`, null, {
        params: this._plParams({ uri }),
      });
      // In-place success — return the same id.
      return { id: playlistId };
    } catch (err) {
      const status = err.response?.status;
      if (status === 404 || status === 403) {
        logger.warn({ status, playlistId }, 'plex replacePlaylistItems: stored id unreachable, creating fresh');
        if (!opts.name) throw err;
        return this.createPlaylist(opts.name, itemIds, { public: !!opts.public });
      }
      throw err;
    }
  }
}

module.exports = PlexAdapter;
