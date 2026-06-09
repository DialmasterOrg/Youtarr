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

  // Video playlists visible in the CURRENT scope (token / no-token). Throws on
  // request failure so callers can distinguish "id genuinely absent from this
  // scope" from "couldn't enumerate the scope".
  async _listVideoPlaylists() {
    const res = await axios.get(`${this.url}/playlists`, {
      params: this._plParams({ playlistType: 'video' }),
    });
    return res.data?.MediaContainer?.Metadata || [];
  }

  async getPlaylistByName(name) {
    try {
      const found = (await this._listVideoPlaylists()).find((p) => p.title === name);
      return found ? { id: found.ratingKey, itemIds: [] } : null;
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

  // Best-effort removal of a playlist stranded in a DIFFERENT scope than the one
  // currently configured (e.g. after switching plexPlaylistToken). The configured
  // token can't see it, so we try each scope auth we know about (current,
  // anonymous, admin token) and stop at the first success; failure leaves an orphan.
  async _deleteStrandedPlaylist(playlistId) {
    const candidates = [this._plParams(), {}];
    if (this.token) candidates.push({ 'X-Plex-Token': this.token });
    const tried = new Set();
    for (const params of candidates) {
      const key = JSON.stringify(params);
      if (tried.has(key)) continue;
      tried.add(key);
      try {
        await axios.delete(`${this.url}/playlists/${playlistId}`, { params });
        logger.info({ playlistId }, 'plex: removed stranded playlist from its prior scope');
        return true;
      } catch (err) {
        // Wrong scope for this candidate; try the next.
      }
    }
    logger.warn({ playlistId }, 'plex: could not delete stranded playlist in any known scope; leaving orphan');
    return false;
  }

  // In-place item replace (delete items + PUT items). If the id is unreachable
  // (404/403) fall back to creating a fresh playlist.
  async _replaceInPlace(playlistId, itemIds, opts = {}) {
    try {
      await axios.delete(`${this.url}/playlists/${playlistId}/items`, {
        params: this._plParams(),
      });
      const machineId = await this._getMachineId();
      const uri = `server://${machineId}/com.plexapp.plugins.library/library/metadata/${itemIds.join(',')}`;
      await axios.put(`${this.url}/playlists/${playlistId}/items`, null, {
        params: this._plParams({ uri }),
      });
      return { id: playlistId };
    } catch (err) {
      const status = err.response?.status;
      if (status === 404 || status === 403) {
        logger.warn({ status, playlistId }, 'plex _replaceInPlace: stored id unreachable, creating fresh');
        if (!opts.name) throw err;
        return this.createPlaylist(opts.name, itemIds, { public: !!opts.public });
      }
      throw err;
    }
  }

  async replacePlaylistItems(playlistId, itemIds, opts = {}) {
    // Enumerate the current scope to tell whether the stored id actually lives
    // here. A playlist owned by another account answers item ops by direct id
    // (HTTP 200) but does NOT appear in this listing, so editing it in place
    // would leave it stranded where the user's Plex Web session can't see it.
    // If we cannot enumerate the scope (transient error), fall back to the
    // in-place path rather than taking the destructive relocate route.
    let scopePlaylists = null;
    try {
      scopePlaylists = await this._listVideoPlaylists();
    } catch (err) {
      logger.warn({ err, playlistId }, 'plex replacePlaylistItems: could not list current scope; attempting in-place');
    }

    if (scopePlaylists) {
      const visible = scopePlaylists.some((p) => String(p.ratingKey) === String(playlistId));
      if (!visible) {
        if (!opts.name) throw new Error('cannot relocate Plex playlist without a name');
        logger.warn(
          { playlistId },
          'plex replacePlaylistItems: stored id not visible in current scope; relocating playlist to this scope'
        );
        // Remove the stranded copy from its old scope so it does not linger in
        // a Plex Web session the user is still browsing.
        await this._deleteStrandedPlaylist(playlistId);
        // Reconcile by name within this scope so repeated scope switches don't
        // pile up duplicates: adopt an existing same-named playlist if present.
        const sameName = scopePlaylists.find((p) => p.title === opts.name);
        if (sameName) return this._replaceInPlace(sameName.ratingKey, itemIds, opts);
        return this.createPlaylist(opts.name, itemIds, { public: !!opts.public });
      }
    }

    return this._replaceInPlace(playlistId, itemIds, opts);
  }
}

module.exports = PlexAdapter;
