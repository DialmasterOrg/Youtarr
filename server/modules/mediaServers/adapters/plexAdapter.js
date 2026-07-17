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
  WatchStateFetchError,
} = require('./baseAdapter');
const logger = require('../../../logger');
const plexModule = require('../../plexModule');

// Sentinel value for config.plexPlaylistToken that tells the adapter to make
// playlist-scoped requests WITHOUT any X-Plex-Token, matching the anonymous
// session used by Plex Web on unclaimed servers that allow unauthenticated
// LAN access. Deliberately distinctive so no real token could collide.
const UNCLAIMED_SERVER_SENTINEL = 'UNCLAIMED_SERVER';

// Plex metadata type for episode leaves. Listing a show section's /all returns
// show-level items with no file parts; ?type=4 lists the episodes instead.
const PLEX_TYPE_EPISODE = 4;

// Server-local accountID of the server owner: always 1 in /accounts and the
// play-history endpoint. The owner's watch state comes from section listings
// (full fidelity); history rows for account 1 are skipped as duplicates.
const PLEX_OWNER_ACCOUNT_ID = '1';

// Play-history pagination. The page cap bounds a single sync on servers with
// enormous history; anything past it is picked up by later incremental syncs.
const HISTORY_PAGE_SIZE = 1000;
const MAX_HISTORY_PAGES = 50;

class PlexAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
    this.serverType = 'plex';
    this.url = config.plexUrl;
    this.token = config.plexApiKey;
    this.libraryId = config.plexYoutubeLibraryId;
    // Section ids to search when resolving files, split { video, music }, keyed
    // by scope ('playlist' | 'admin', see _getSectionIds). Populated lazily
    // per scope on first use.
    this._sectionIds = null;
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
    // Unclaimed servers have no accounts: Plex Web browses as the anonymous
    // LAN session, and watch state is recorded in that same anonymous scope.
    // fetchWatchStates uses this to read watch state tokenless in that mode.
    this.anonymousScope = override === UNCLAIMED_SERVER_SENTINEL;
    this.allUsers = config.plexWatchStatusAllUsers !== false;
  }

  // Distinct, ordered lists of library section ids to search, discovered from
  // the Plex server itself (not from Youtarr config, which may not map every
  // library). video: 'movie' covers "Other Videos"/Personal Media libraries,
  // 'show' covers TV-type ones. music: 'artist' covers Music libraries, which
  // hold audio-only downloads. The configured YouTube library is placed first
  // as the most likely location. Result is cached per scope for the lifetime
  // of the adapter instance (one sync). Falls back to the configured library
  // if enumeration fails.
  //
  // scope controls which token enumerates /library/sections: 'playlist' (the
  // default) uses the playlist-scoped token, matching every other caller of
  // this method (file resolution, library scans). 'admin' uses the admin token,
  // for fetchWatchStates on claimed servers, since watch state is read from the
  // admin account and must see the same sections that account can. (Unclaimed
  // servers pass 'playlist', which is tokenless there; see anonymousScope.)
  async _getSectionIds(scope = 'playlist') {
    if (!this._sectionIds) this._sectionIds = {};
    if (this._sectionIds[scope]) return this._sectionIds[scope];
    const video = [];
    const music = [];
    // Subset of `video`: section ids of type 'show'. Their default /all listing
    // returns show-level items with no file parts, so callers needing
    // file-backed leaves must request episodes explicitly for these sections.
    const shows = [];
    const add = (list, id) => {
      if (id == null) return;
      const s = String(id).trim();
      if (s && /^\d+$/.test(s) && !video.includes(s) && !music.includes(s)) list.push(s);
    };
    add(video, this.libraryId);
    // Preserved so callers with no configured fallback library can tell
    // "enumeration failed" apart from "server genuinely has no sections".
    let enumerationError = null;
    try {
      const params = scope === 'admin' ? { 'X-Plex-Token': this.token } : this._plParams();
      const res = await axios.get(`${this.url}/library/sections`, { params, timeout: REQUEST_TIMEOUT_MS });
      const dirs = res.data?.MediaContainer?.Directory || [];
      for (const dir of dirs) {
        if (dir.type === 'movie' || dir.type === 'show') {
          add(video, dir.key);
          const key = String(dir.key ?? '').trim();
          // Also covers the configured library already added above turning out
          // to be a show section.
          if (dir.type === 'show' && video.includes(key) && !shows.includes(key)) shows.push(key);
        } else if (dir.type === 'artist') {
          add(music, dir.key);
        }
      }
    } catch (err) {
      enumerationError = err;
      logger.warn({ ...describeHttpError(err) }, 'plex: could not enumerate library sections; searching configured library only');
    }
    this._sectionIds[scope] = { video, music, shows, enumerationError };
    return this._sectionIds[scope];
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

  async triggerLibraryScan(subfolder, opts = {}) {
    // Video sections are already scanned by the post-download refresh (see
    // downloadCompletionEffects), so the subfolder delegation below stays a
    // deliberate no-op when no subfolder is given. Music sections have no
    // scan trigger anywhere else in Youtarr, so an audio sync must request
    // one here or the mp3s stay unindexed until the user's own library
    // settings happen to scan them.
    if (opts.mediaType === 'audio') {
      const sections = await this._getSectionIds();
      // refreshLibrary logs and swallows its own errors; allSettled just
      // guarantees one section can't abort the sync.
      await Promise.allSettled(sections.music.map((id) => plexModule.refreshLibrary(id)));
    }
    return plexModule.refreshLibrariesForSubfolders([subfolder].filter(Boolean));
  }

  async resolveItemIdByFilepath(filepath) {
    const resolved = await this.resolveItemIdsByFilepaths([filepath]);
    return resolved.get(filepath) || null;
  }

  // Batch filepath resolution: one /all fetch per searched section per call,
  // not per file, so a whole playlist costs (sections) fetches instead of
  // (sections x files). Video sections are always searched; music only for
  // mp3 batches. Listings are not cached across calls: the sync orchestrator
  // polls this while a library scan is in flight and each round must observe
  // freshly indexed items.
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
    const sections = await this._getSectionIds();
    // Music sections must be queried with type=10 (tracks): the default /all
    // for an 'artist' section returns artists, which carry no file paths.
    const hasAudio = targets.some((p) => /\.mp3$/i.test(p));
    const sources = [
      ...sections.video.map((id) => ({ id, params: {} })),
      ...(hasAudio ? sections.music.map((id) => ({ id, params: { type: 10 } })) : []),
    ];
    for (const { id: libraryId, params } of sources) {
      try {
        const res = await axios.get(`${this.url}/library/sections/${libraryId}/all`, {
          params: this._plParams(params),
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

  // Playlists of the given media type visible in the CURRENT scope (token /
  // no-token). Throws on request failure so callers can distinguish "id
  // genuinely absent from this scope" from "couldn't enumerate the scope".
  async _listPlaylists(mediaType) {
    const res = await axios.get(`${this.url}/playlists`, {
      params: this._plParams({ playlistType: mediaType === 'audio' ? 'audio' : 'video' }),
      timeout: REQUEST_TIMEOUT_MS,
    });
    return res.data?.MediaContainer?.Metadata || [];
  }

  async _getMachineId() {
    // /identity is server-wide info; use the admin token which is always valid.
    const res = await axios.get(`${this.url}/identity`, { params: { 'X-Plex-Token': this.token }, timeout: REQUEST_TIMEOUT_MS });
    return res.data?.MediaContainer?.machineIdentifier;
  }

  async createPlaylist(name, itemIds, opts = {}) {
    const machineId = await this._getMachineId();
    const uri = `server://${machineId}/com.plexapp.plugins.library/library/metadata/${itemIds.join(',')}`;
    const res = await axios.post(`${this.url}/playlists`, null, {
      params: this._plParams({ type: opts.mediaType === 'audio' ? 'audio' : 'video', title: name, smart: 0, uri }),
      timeout: REQUEST_TIMEOUT_MS,
    });
    return { id: res.data?.MediaContainer?.Metadata?.[0]?.ratingKey };
  }

  // Best-effort removal of a playlist superseded by the relocate path: either
  // stranded in a DIFFERENT scope than the one currently configured (e.g. after
  // switching plexPlaylistToken), or left behind as the wrong media type after
  // a flip. Deletion by direct id works regardless of playlist type, but the
  // owning scope may differ, so we try each scope auth we know about (current,
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
        logger.info({ playlistId }, 'plex: removed superseded playlist (prior scope or media type)');
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
        return this.createPlaylist(opts.name, itemIds, { public: !!opts.public, mediaType: opts.mediaType });
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
      scopePlaylists = await this._listPlaylists(opts.mediaType);
    } catch (err) {
      logger.warn({ err, playlistId }, 'plex replacePlaylistItems: could not list current scope; attempting in-place');
    }

    if (scopePlaylists) {
      const visible = scopePlaylists.some((p) => String(p.ratingKey) === String(playlistId));
      if (!visible) {
        if (!opts.name) throw new Error('cannot relocate Plex playlist without a name');
        // Two ways the stored id can be missing from this listing: the playlist
        // lives in a different token scope (a stranded playlist), or the
        // playlist's media type flipped (e.g. an all-audio playlist whose first
        // video item just downloaded: the id exists, but not as a playlist of
        // the current media type).
        logger.warn(
          { playlistId, mediaType: opts.mediaType === 'audio' ? 'audio' : 'video' },
          'plex replacePlaylistItems: stored id not found among current-scope playlists of this media type (scope changed or media type flipped); recreating'
        );
        // Remove the stranded copy from its old scope so it does not linger in
        // a Plex Web session the user is still browsing.
        await this._deleteStrandedPlaylist(playlistId);
        // Reconcile by name within this scope so repeated scope switches don't
        // pile up duplicates: adopt an existing same-named playlist if present.
        const sameName = scopePlaylists.find((p) => p.title === opts.name);
        if (sameName) return this._replaceInPlace(sameName.ratingKey, itemIds, opts);
        return this.createPlaylist(opts.name, itemIds, { public: !!opts.public, mediaType: opts.mediaType });
      }
    }

    return this._replaceInPlace(playlistId, itemIds, opts);
  }

  // Watch state comes from the same section listings used for file resolution:
  // every item carries viewCount (completed plays), viewOffset (in-progress
  // position, ms) and lastViewedAt (unix seconds). On claimed servers this
  // reads the ADMIN account's watch state, not the 'user'-mode plexPlaylistToken
  // account, since watch state is per Plex account and v1 reads the admin's. On
  // unclaimed servers (UNCLAIMED_SERVER sentinel) it reads the anonymous
  // session's watch state instead, the scope Plex Web itself uses there.
  //
  // When plexWatchStatusAllUsers is on (the default, claimed servers only),
  // OTHER accounts' watch state is layered on from the server-local play
  // history; see _fetchHistoryWatchStates. opts.since is that history's
  // incremental watermark.
  async fetchWatchStates(opts = {}) {
    const entries = [];
    const ratingKeyPaths = new Map(); // ratingKey -> [file paths] for history mapping
    const sections = await this._getSectionIds(this.anonymousScope ? 'playlist' : 'admin');
    let sectionsListed = 0;
    let lastError = null;
    for (const libraryId of sections.video) {
      // Show sections need type=4 to list episode leaves, which carry both the
      // file paths and the per-episode watch state; the default /all would
      // return file-less show items and nothing could match.
      const typeParams = sections.shows.includes(libraryId) ? { type: PLEX_TYPE_EPISODE } : {};
      try {
        const res = await axios.get(`${this.url}/library/sections/${libraryId}/all`, {
          params: this.anonymousScope ? this._plParams(typeParams) : { ...typeParams, 'X-Plex-Token': this.token },
          timeout: REQUEST_TIMEOUT_MS,
        });
        sectionsListed += 1;
        const items = res.data?.MediaContainer?.Metadata || [];
        for (const item of items) {
          const state = this._itemWatchState(item);
          for (const media of item.Media || []) {
            for (const part of media.Part || []) {
              if (!part.file) continue;
              entries.push({ path: part.file, serverUserId: PLEX_OWNER_ACCOUNT_ID, ...state });
              if (item.ratingKey != null) {
                const key = String(item.ratingKey);
                if (!ratingKeyPaths.has(key)) ratingKeyPaths.set(key, []);
                ratingKeyPaths.get(key).push(part.file);
              }
            }
          }
        }
      } catch (err) {
        if (isServerUnavailableError(err)) throw new MediaServerUnavailableError(describeHttpError(err));
        // A single section failing shouldn't abort the fetch of the others.
        lastError = err;
        logger.warn({ ...describeHttpError(err), libraryId }, 'plex: could not list library section during watch-state fetch');
      }
    }
    // Every section failing (e.g. an expired admin token 401s everywhere) is a
    // failed sync, not a successful empty one; swallowing it would record
    // "0 updated" and hide the problem from the sync summary. This includes
    // enumeration itself failing with no configured library to fall back on
    // (sections.video is empty then, but the fetch still didn't succeed).
    if (sectionsListed === 0 && (sections.video.length > 0 || sections.enumerationError)) {
      const failure = lastError || sections.enumerationError;
      if (isServerUnavailableError(failure)) throw new MediaServerUnavailableError(describeHttpError(failure));
      const info = describeHttpError(failure);
      throw new WatchStateFetchError(`could not list any Plex library section (${info.status ? `HTTP ${info.status}` : info.message})`);
    }

    // Unclaimed servers have no accounts, so all-users mode only applies to
    // claimed ones.
    let users = [];
    let historyCursor = null;
    if (this.allUsers && !this.anonymousScope) {
      users = await this._fetchAccounts();
      // A server account the caller has never stored may carry history that
      // predates the incremental cursor; do one full pull to backfill it.
      const known = opts.knownUserIds ? new Set(opts.knownUserIds.map(String)) : null;
      let since = opts.since || null;
      if (since && known && users.some((u) => u.id !== PLEX_OWNER_ACCOUNT_ID && !known.has(u.id))) {
        logger.info('plex: new server account detected; performing a full watch-history pull');
        since = null;
      }
      const history = await this._fetchHistoryWatchStates(ratingKeyPaths, since);
      entries.push(...history.entries);
      // Advance the stored cursor only when every section listed successfully:
      // with a partial ratingKey map, events skipped as "unknown item" may
      // belong to the failed section and must be rescanned next sync.
      const listingComplete = sectionsListed === sections.video.length;
      historyCursor = listingComplete ? history.scannedThrough : null;
      // On an incomplete scan, withhold not-yet-known accounts from the user
      // list: reporting one would mark it "known" and consume its one-time
      // full-history backfill even though this scan may have skipped its
      // events. The next sync re-detects it and repeats the full pull until a
      // complete scan records it. (Keyed off listingComplete, not
      // historyCursor: a complete scan with zero history events also yields a
      // null cursor, and those accounts must still be recorded.)
      if (!listingComplete && known) {
        users = users.filter((u) => u.id === PLEX_OWNER_ACCOUNT_ID || known.has(u.id));
      }
    }
    return { entries, users, historyCursor };
  }

  // Server-local account directory (/accounts): every account with activity on
  // this server, owner included (id 1). Names are enrichment for the users
  // table; a failure here must not abort the history fetch itself.
  async _fetchAccounts() {
    try {
      const res = await axios.get(`${this.url}/accounts`, {
        params: { 'X-Plex-Token': this.token },
        timeout: REQUEST_TIMEOUT_MS,
      });
      const accounts = res.data?.MediaContainer?.Account || [];
      return accounts
        .filter((a) => a.id != null && Number(a.id) > 0)
        .map((a) => ({ id: String(a.id), name: a.name || null }));
    } catch (err) {
      logger.warn({ ...describeHttpError(err) }, 'plex: could not list server accounts; user names unavailable');
      return [];
    }
  }

  // Watch state for NON-owner accounts comes from the server-local play
  // history (/status/sessions/history/all): the admin token cannot read other
  // accounts' per-item state, but it can read everyone's play events (the
  // endpoint Tautulli builds on; no plex.tv involvement). History is
  // played-only fidelity: any event marks the item watched (percent 100, no
  // position), an accepted v1 trade-off. `since` is an incremental watermark
  // over viewedAt so recurring syncs only page new events.
  //
  // Returns { entries, scannedThrough }: scannedThrough is the newest viewedAt
  // actually SCANNED (matched or not, capped or not), the safe value for a
  // durable cursor. Null when no events were scanned (nothing to advance).
  async _fetchHistoryWatchStates(ratingKeyPaths, since) {
    const byAccountItem = new Map(); // `${accountID}:${ratingKey}` -> max viewedAt (unix s)
    const sinceSeconds = since ? Math.floor(since.getTime() / 1000) : null;
    let maxScannedViewedAt = 0;
    let start = 0;
    let pages = 0;
    for (;;) {
      if (pages >= MAX_HISTORY_PAGES) {
        logger.warn(
          { pages, fetched: start },
          'plex: watch history page cap reached; the next sync resumes from the stored cursor'
        );
        break;
      }
      let res;
      try {
        res = await axios.get(`${this.url}/status/sessions/history/all`, {
          params: {
            sort: 'viewedAt:asc',
            'X-Plex-Container-Start': start,
            'X-Plex-Container-Size': HISTORY_PAGE_SIZE,
            'X-Plex-Token': this.token,
            ...(sinceSeconds != null ? { 'viewedAt>': sinceSeconds } : {}),
          },
          timeout: REQUEST_TIMEOUT_MS,
        });
      } catch (err) {
        if (isServerUnavailableError(err)) throw new MediaServerUnavailableError(describeHttpError(err));
        // Owner data alone must not report success while every other user
        // goes silently stale, so a failed history fetch fails the server.
        const info = describeHttpError(err);
        throw new WatchStateFetchError(
          `could not fetch Plex watch history for other users (${info.status ? `HTTP ${info.status}` : info.message})`
        );
      }
      const rows = res.data?.MediaContainer?.Metadata || [];
      for (const row of rows) {
        const viewedAt = Number(row.viewedAt) || 0;
        if (viewedAt > maxScannedViewedAt) maxScannedViewedAt = viewedAt;
        if (row.accountID == null || String(row.accountID) === PLEX_OWNER_ACCOUNT_ID) continue;
        const key = row.ratingKey != null ? String(row.ratingKey) : null;
        if (!key || !ratingKeyPaths.has(key)) continue;
        const mapKey = `${row.accountID}:${key}`;
        if (!byAccountItem.has(mapKey) || viewedAt > byAccountItem.get(mapKey)) {
          byAccountItem.set(mapKey, viewedAt);
        }
      }
      pages += 1;
      if (rows.length < HISTORY_PAGE_SIZE) break;
      start += HISTORY_PAGE_SIZE;
    }

    const entries = [];
    for (const [mapKey, viewedAt] of byAccountItem) {
      const separator = mapKey.indexOf(':');
      const accountId = mapKey.slice(0, separator);
      const ratingKey = mapKey.slice(separator + 1);
      for (const path of ratingKeyPaths.get(ratingKey)) {
        entries.push({
          path,
          serverUserId: accountId,
          played: true,
          playCount: 1,
          positionMs: null,
          percentWatched: 100,
          lastWatchedAt: viewedAt ? new Date(viewedAt * 1000) : null,
        });
      }
    }
    return {
      entries,
      scannedThrough: maxScannedViewedAt ? new Date(maxScannedViewedAt * 1000) : null,
    };
  }

  _itemWatchState(item) {
    const playCount = item.viewCount != null ? Number(item.viewCount) : 0;
    const played = playCount > 0;
    const positionMs = item.viewOffset != null ? Number(item.viewOffset) : null;
    const durationMs = item.duration != null ? Number(item.duration) : null;
    let percentWatched = null;
    if (played) {
      percentWatched = 100;
    } else if (positionMs != null && durationMs > 0) {
      percentWatched = Math.round((positionMs / durationMs) * 1000) / 10;
    }
    return {
      played,
      playCount,
      positionMs,
      percentWatched,
      lastWatchedAt: item.lastViewedAt ? new Date(Number(item.lastViewedAt) * 1000) : null,
    };
  }
}

module.exports = PlexAdapter;
module.exports.PLEX_OWNER_ACCOUNT_ID = PLEX_OWNER_ACCOUNT_ID;
