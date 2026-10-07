const axios = require('axios');
const BaseAdapter = require('./baseAdapter');
const {
  extractBasename,
  normalizeBaseUrl,
  REQUEST_TIMEOUT_MS,
  isServerUnavailableError,
  describeHttpError,
  MediaServerUnavailableError,
} = require('./baseAdapter');
const logger = require('../../../logger');

// Jellyfin/Emby report playback position in ticks (100ns units).
const TICKS_PER_MS = 10000;

const WATCH_STATE_FILTERS = [{ isPlayed: true }, { filters: 'IsResumable' }];
const WATCH_STATE_PAGE_SIZE = 1000;

class JellyfinAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
    this.serverType = 'jellyfin';
    this.url = normalizeBaseUrl(config.jellyfinUrl);
    this.apiKey = String(config.jellyfinApiKey || '').trim();
    this.userId = String(config.jellyfinUserId || '').trim() || undefined;
    this.allUsers = config.jellyfinWatchStatusAllUsers !== false;
  }

  // Jellyfin 12.0 disables the legacy X-Emby-Token header by default; the
  // Authorization: MediaBrowser scheme is accepted by 10.x and 12.x alike.
  _headers() { return { Authorization: `MediaBrowser Token="${this.apiKey}"` }; }

  async testConnection() {
    try {
      const res = await axios.get(`${this.url}/System/Info`, { headers: this._headers(), timeout: REQUEST_TIMEOUT_MS });
      return { ok: true, version: res.data?.Version };
    } catch (err) {
      const status = err.response?.status;
      if (status === 401 || status === 403) {
        return {
          ok: false,
          error: 'The server is reachable but rejected the API key. Re-copy the key from the server dashboard (select only the key itself) and try again.',
        };
      }
      return { ok: false, error: err.message };
    }
  }

  async listUsers() {
    const res = await axios.get(`${this.url}/Users`, { headers: this._headers(), timeout: REQUEST_TIMEOUT_MS });
    return (res.data || []).map((u) => ({ id: u.Id, name: u.Name }));
  }

  async triggerLibraryScan() {
    try {
      await axios.post(`${this.url}/Library/Refresh`, null, { headers: this._headers(), timeout: REQUEST_TIMEOUT_MS });
    } catch (err) {
      logger.warn({ ...describeHttpError(err) }, 'jellyfin: library refresh request failed');
    }
  }

  async resolveItemIdByFilepath(filepath) {
    // Match by filename across different mount views (supports Windows paths
    // via extractBasename which splits on both / and \).
    const target = extractBasename(filepath);
    // Audio-only downloads are Audio items on the server, not Video.
    const isAudio = /\.mp3$/i.test(target);
    try {
      const params = {
        userId: this.userId,
        includeItemTypes: isAudio ? 'Audio' : 'Video,Movie,Episode',
        // Data lookups need individual movies even when Jellyfin groups collections.
        collapseBoxSetItems: false,
        recursive: true,
        fields: 'Path',
      };
      const res = await axios.get(`${this.url}/Items`, { headers: this._headers(), params, timeout: REQUEST_TIMEOUT_MS });
      const items = res.data?.Items || [];
      const match = items.find((i) => i.Path && extractBasename(i.Path) === target);
      return match ? match.Id : null;
    } catch (err) {
      if (isServerUnavailableError(err)) throw new MediaServerUnavailableError(describeHttpError(err));
      logger.warn({ ...describeHttpError(err), filepath }, 'jellyfin: could not look up library item by file path');
      return null;
    }
  }

  // Watch state per target user: every server user when
  // jellyfinWatchStatusAllUsers is on (the default), else just the configured
  // one. Only watched and in-progress items are listed; a whole-server listing
  // takes minutes on large libraries and would outlast the request timeout.
  // Everything unlisted is unwatched, so users listed in full come back as
  // completeUserIds. UserData rides along when enableUserData is set and a
  // userId is supplied (API-key auth returns no UserData otherwise). A failed
  // /Users fetch fails the whole call: silently syncing nobody would
  // masquerade as an empty success.
  async fetchWatchStates() {
    try {
      let users = [];
      let targets;
      if (this.allUsers) {
        const res = await axios.get(`${this.url}/Users`, { headers: this._headers(), timeout: REQUEST_TIMEOUT_MS });
        users = (res.data || []).map((u) => ({ id: String(u.Id), name: u.Name || null }));
        targets = users;
      } else {
        targets = [{ id: this.userId, name: null }];
      }
      const entries = [];
      const completeUserIds = [];
      for (const user of targets) {
        const { items, complete } = await this._listItemsWithWatchState(user.id);
        for (const item of items) {
          if (item.Path) entries.push(this._itemWatchState(item, user.id));
        }
        if (!user.id) continue;
        if (complete) {
          completeUserIds.push(user.id);
        } else {
          logger.warn({ serverUserId: user.id }, 'jellyfin: server repeated a page of items; keeping stored watch state for this user');
        }
      }
      return { entries, users, completeUserIds };
    } catch (err) {
      if (isServerUnavailableError(err)) throw new MediaServerUnavailableError(describeHttpError(err));
      throw err;
    }
  }

  // Server-side filters for watched, then in-progress items; combined in one
  // request they must both hold, which matches nothing. An item in both
  // listings is kept once, as watched. `complete` is false when a full page
  // brought nothing new (the server ignored startIndex), so later pages were
  // never seen. Offset paging can also skip an item when the listing shifts
  // mid-sync (an earlier item marked unwatched between two pages); that
  // resets the skipped row until the next sync, which only defers cleanup.
  async _listItemsWithWatchState(userId) {
    const itemsById = new Map();
    let complete = true;
    for (const filter of WATCH_STATE_FILTERS) {
      const seen = new Set();
      for (let startIndex = 0; ; startIndex += WATCH_STATE_PAGE_SIZE) {
        const params = {
          userId,
          includeItemTypes: 'Video,Movie,Episode',
          // Collection containers do not carry the individual videos' watch state.
          collapseBoxSetItems: false,
          recursive: true,
          fields: 'Path',
          enableUserData: true,
          sortBy: 'SortName',
          startIndex,
          limit: WATCH_STATE_PAGE_SIZE,
          ...filter,
        };
        const res = await axios.get(`${this.url}/Items`, { headers: this._headers(), params, timeout: REQUEST_TIMEOUT_MS });
        const page = res.data?.Items || [];
        let added = 0;
        for (const item of page) {
          if (seen.has(item.Id)) continue;
          seen.add(item.Id);
          added += 1;
          if (!itemsById.has(item.Id)) itemsById.set(item.Id, item);
        }
        // A short page ends the listing; a longer one means the server
        // ignored limit and returned everything.
        if (page.length !== WATCH_STATE_PAGE_SIZE) break;
        if (added === 0) {
          complete = false;
          break;
        }
      }
    }
    return { items: [...itemsById.values()], complete };
  }

  _itemWatchState(item, serverUserId) {
    const ud = item.UserData || {};
    const played = !!ud.Played;
    const positionTicks = ud.PlaybackPositionTicks != null ? Number(ud.PlaybackPositionTicks) : null;
    let percentWatched = null;
    if (played) {
      percentWatched = 100;
    } else if (ud.PlayedPercentage != null) {
      percentWatched = Math.round(Number(ud.PlayedPercentage) * 10) / 10;
    }
    return {
      path: item.Path,
      serverUserId,
      played,
      playCount: ud.PlayCount != null ? Number(ud.PlayCount) : 0,
      positionMs: positionTicks != null ? Math.round(positionTicks / TICKS_PER_MS) : null,
      percentWatched,
      lastWatchedAt: ud.LastPlayedDate ? new Date(ud.LastPlayedDate) : null,
    };
  }

  async createPlaylist(name, itemIds, opts = {}) {
    const body = {
      Name: name,
      Ids: itemIds,
      UserId: this.userId,
      MediaType: opts.mediaType === 'audio' ? 'Audio' : 'Video',
      IsPublic: !!opts.public,
    };
    const res = await axios.post(`${this.url}/Playlists`, body, { headers: this._headers(), timeout: REQUEST_TIMEOUT_MS });
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
      await axios.delete(`${this.url}/Items/${playlistId}`, { headers: this._headers(), timeout: REQUEST_TIMEOUT_MS });
    } catch (err) {
      const status = err.response?.status;
      logger.warn({ status, playlistId }, 'jellyfin replacePlaylistItems: delete failed, creating fresh');
    }
    return this.createPlaylist(opts.name, itemIds, { public: !!opts.public, mediaType: opts.mediaType });
  }
}

module.exports = JellyfinAdapter;
