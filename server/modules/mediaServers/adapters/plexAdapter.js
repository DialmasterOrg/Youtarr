const axios = require('axios');
const BaseAdapter = require('./baseAdapter');
const {
  extractBasename,
  pathSegments,
  trailingSegmentMatch,
  REQUEST_TIMEOUT_MS,
  isServerUnavailableError,
  describeHttpError,
  MediaServerUnavailableError,
} = require('./baseAdapter');
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
    // Cache of video-bearing section ids to search when resolving a file to its
    // server item. A playlist's videos can be scattered across libraries (e.g.
    // channels writing to subfolders that the admin mapped to separate Plex
    // libraries). Plex playlists accept ratingKeys from any section, so we search
    // every video section. Populated lazily on first resolve. See _getVideoSectionIds.
    this._videoSectionIds = null;
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

  // Distinct, ordered list of video-bearing library section ids to search,
  // discovered from the Plex server itself (not from Youtarr config, which may
  // not map every library). The configured YouTube library is placed first as
  // the most likely location. Result is cached for the lifetime of the adapter
  // instance (one sync). Falls back to the configured library if enumeration fails.
  async _getVideoSectionIds() {
    if (this._videoSectionIds) return this._videoSectionIds;
    const ids = [];
    const add = (id) => {
      if (id == null) return;
      const s = String(id).trim();
      if (s && /^\d+$/.test(s) && !ids.includes(s)) ids.push(s);
    };
    add(this.libraryId);
    try {
      const res = await axios.get(`${this.url}/library/sections`, { params: this._plParams(), timeout: REQUEST_TIMEOUT_MS });
      const dirs = res.data?.MediaContainer?.Directory || [];
      for (const dir of dirs) {
        // Only video-bearing sections can hold downloaded videos: 'movie' covers
        // "Other Videos"/Personal Media libraries; 'show' covers TV-type ones.
        if (dir.type === 'movie' || dir.type === 'show') add(dir.key);
      }
    } catch (err) {
      logger.warn({ ...describeHttpError(err) }, 'plex: could not enumerate library sections; searching configured library only');
    }
    this._videoSectionIds = ids;
    return ids;
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
      await axios.get(`${this.url}/identity`, { params: { 'X-Plex-Token': this.token }, timeout: REQUEST_TIMEOUT_MS });
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
    const resolved = await this.resolveItemIdsByFilepaths([filepath]);
    return resolved.get(filepath) || null;
  }

  // Batch filepath resolution: one /all fetch per video section per call, not
  // per file, so a whole playlist costs (sections) fetches instead of
  // (sections x files). Listings are not cached across calls: the sync
  // orchestrator polls this while a library scan is in flight and each round
  // must observe freshly indexed items.
  //
  // Matching is by basename (mount views differ between Youtarr and Plex;
  // YouTube ids in filenames are globally unique). The same basename can match
  // in two sections when a stale item lingers after a file moved between
  // libraries, so every section is scanned and the best-scoring candidate wins;
  // see trailingSegmentMatch in baseAdapter.
  async resolveItemIdsByFilepaths(filepaths) {
    const results = new Map();
    const targets = [...new Set((filepaths || []).filter(Boolean))];
    if (targets.length === 0) return results;

    // Candidate index over every section, restricted to the basenames we need.
    const wanted = new Set(targets.map(extractBasename));
    const candidatesByBasename = new Map(); // basename -> [{ ratingKey, segments }]
    const sectionIds = await this._getVideoSectionIds();
    for (const libraryId of sectionIds) {
      try {
        const res = await axios.get(`${this.url}/library/sections/${libraryId}/all`, {
          params: this._plParams(),
          timeout: REQUEST_TIMEOUT_MS,
        });
        const items = res.data?.MediaContainer?.Metadata || [];
        for (const item of items) {
          for (const media of item.Media || []) {
            for (const part of media.Part || []) {
              if (!part.file) continue;
              const base = extractBasename(part.file);
              if (!wanted.has(base)) continue;
              if (!candidatesByBasename.has(base)) candidatesByBasename.set(base, []);
              candidatesByBasename.get(base).push({
                ratingKey: item.ratingKey,
                segments: pathSegments(part.file),
              });
            }
          }
        }
      } catch (err) {
        if (isServerUnavailableError(err)) throw new MediaServerUnavailableError(describeHttpError(err));
        // A single section failing shouldn't abort the search of the others.
        logger.warn({ ...describeHttpError(err), libraryId }, 'plex: could not list library section during item lookup');
      }
    }

    for (const filepath of targets) {
      const targetSegments = pathSegments(filepath);
      let best = null; // { ratingKey, score }
      for (const candidate of candidatesByBasename.get(extractBasename(filepath)) || []) {
        const score = trailingSegmentMatch(targetSegments, candidate.segments);
        if (!best || score > best.score) best = { ratingKey: candidate.ratingKey, score };
      }
      results.set(filepath, best ? best.ratingKey : null);
    }
    return results;
  }

  // Video playlists visible in the CURRENT scope (token / no-token). Throws on
  // request failure so callers can distinguish "id genuinely absent from this
  // scope" from "couldn't enumerate the scope".
  async _listVideoPlaylists() {
    const res = await axios.get(`${this.url}/playlists`, {
      params: this._plParams({ playlistType: 'video' }),
      timeout: REQUEST_TIMEOUT_MS,
    });
    return res.data?.MediaContainer?.Metadata || [];
  }

  async getPlaylistByName(name) {
    try {
      const found = (await this._listVideoPlaylists()).find((p) => p.title === name);
      return found ? { id: found.ratingKey, itemIds: [] } : null;
    } catch (err) {
      logger.warn({ ...describeHttpError(err) }, 'plex: could not list playlists');
      return null;
    }
  }

  async _getMachineId() {
    // /identity is server-wide info; use the admin token which is always valid.
    const res = await axios.get(`${this.url}/identity`, { params: { 'X-Plex-Token': this.token }, timeout: REQUEST_TIMEOUT_MS });
    return res.data?.MediaContainer?.machineIdentifier;
  }

  async createPlaylist(name, itemIds) {
    const machineId = await this._getMachineId();
    const uri = `server://${machineId}/com.plexapp.plugins.library/library/metadata/${itemIds.join(',')}`;
    const res = await axios.post(`${this.url}/playlists`, null, {
      params: this._plParams({ type: 'video', title: name, smart: 0, uri }),
      timeout: REQUEST_TIMEOUT_MS,
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
        await axios.delete(`${this.url}/playlists/${playlistId}`, { params, timeout: REQUEST_TIMEOUT_MS });
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
        timeout: REQUEST_TIMEOUT_MS,
      });
      const machineId = await this._getMachineId();
      const uri = `server://${machineId}/com.plexapp.plugins.library/library/metadata/${itemIds.join(',')}`;
      await axios.put(`${this.url}/playlists/${playlistId}/items`, null, {
        params: this._plParams({ uri }),
        timeout: REQUEST_TIMEOUT_MS,
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
