const logger = require('../../logger');
const configModule = require('../configModule');
const serverRegistry = require('./serverRegistry');
const { Playlist, PlaylistVideo, PlaylistSyncState, Video } = require('../../models');

// Backoff retry for resolving items after library scan. Tuned for typical Plex/Jellyfin
// scan completion times — short initial delays, then longer as more time passes.
const POLL_BACKOFFS_MS = [2000, 5000, 10000, 20000, 30000];

const ADAPTER_TYPE_TAG = {
  PlexAdapter: 'plex',
  JellyfinAdapter: 'jellyfin',
  EmbyAdapter: 'emby',
};

class MediaServerSync {
  constructor() {
    // playlistId -> { promise, rerunRequested }. Serializes concurrent syncs of
    // the same playlist: Jellyfin/Emby replace is delete+recreate, so two
    // overlapping runs can destroy each other's playlists, and two first-time
    // runs would double-create. A call arriving mid-run joins the in-flight
    // promise and schedules exactly one follow-up pass over fresh DB state.
    // Tradeoff: if the initial run rejects, joiners share that rejection and
    // any rerun they requested is dropped (a later call starts fresh).
    this._inFlight = new Map();
  }

  syncPlaylist(playlistId) {
    // Deliberately synchronous: no await may be introduced between the map
    // check and set, or two callers could both miss the entry and run
    // concurrently.
    const key = String(playlistId);
    const existing = this._inFlight.get(key);
    if (existing) {
      existing.rerunRequested = true;
      return existing.promise;
    }
    const entry = { rerunRequested: false };
    entry.promise = this._runWithRerun(key, playlistId, entry);
    this._inFlight.set(key, entry);
    return entry.promise;
  }

  async _runWithRerun(key, playlistId, entry) {
    try {
      await this._doSync(playlistId);
      while (entry.rerunRequested) {
        entry.rerunRequested = false;
        await this._doSync(playlistId);
      }
    } finally {
      this._inFlight.delete(key);
    }
  }

  async _doSync(playlistId) {
    const playlist = await Playlist.findByPk(playlistId);
    if (!playlist) return;

    const videos = await PlaylistVideo.findAll({
      where: { playlist_id: playlist.playlist_id, ignored: false },
      order: [['position', 'ASC']],
    });

    const config = configModule.getConfig();
    const adapters = serverRegistry.getEnabledAdapters(config);

    for (const adapter of adapters) {
      const serverType = ADAPTER_TYPE_TAG[adapter.constructor.name];
      if (!this._shouldSync(playlist, serverType)) continue;

      try {
        await this._syncToOne(playlist, videos, adapter, serverType);
      } catch (err) {
        logger.error({ err, playlist_id: playlist.playlist_id, serverType }, 'sync failed');
        await this._recordError(playlist.id, serverType, err.message);
      }
    }
  }

  _shouldSync(playlist, serverType) {
    if (serverType === 'plex') return !!playlist.sync_to_plex;
    if (serverType === 'jellyfin') return !!playlist.sync_to_jellyfin;
    if (serverType === 'emby') return !!playlist.sync_to_emby;
    return false;
  }

  async _syncToOne(playlist, videos, adapter, serverType) {
    const youtubeIds = videos.map((pv) => pv.youtube_id);
    const downloaded = youtubeIds.length
      ? await Video.findAll({ where: { youtubeId: youtubeIds } })
      : [];
    const byYoutubeId = new Map(downloaded.map((v) => [v.youtubeId, v]));
    const filepaths = [];
    for (const pv of videos) {
      const v = byYoutubeId.get(pv.youtube_id);
      if (v && v.filePath) filepaths.push({ youtube_id: pv.youtube_id, filePath: v.filePath });
    }

    await adapter.triggerLibraryScan();

    const resolvedByPath = await this._resolveAllWithBackoff(
      adapter,
      filepaths.map((entry) => entry.filePath)
    );
    const itemIds = [];
    for (const entry of filepaths) {
      const id = resolvedByPath.get(entry.filePath);
      if (id) itemIds.push(id);
      else logger.warn({ youtube_id: entry.youtube_id, serverType }, 'unresolved on media server, skipping');
    }

    const name = `YT: ${playlist.title}`;
    const state = await PlaylistSyncState.findOne({
      where: { playlist_id: playlist.id, server_type: serverType },
    });

    // Skip create when no items resolved. Plex/Jellyfin/Emby reject empty playlist creation,
    // and the normal flow (subscribe → videos download later → post-download hook re-syncs)
    // will create the playlist on the next sync once items exist.
    if (!state?.server_playlist_id && itemIds.length === 0) {
      logger.info(
        { playlist_id: playlist.playlist_id, serverType },
        'sync: no resolvable items yet, deferring playlist creation until videos are downloaded'
      );
      return;
    }

    if (state?.server_playlist_id) {
      // Pass name+public so adapters that implement replace as delete+recreate
      // (Jellyfin, Emby) can construct the new playlist. Plex replaces in place
      // and ignores opts. Capture the returned id in case the adapter recreated
      // — the sync-state row must track the new id.
      const replaced = await adapter.replacePlaylistItems(state.server_playlist_id, itemIds, {
        name, public: !!playlist.public_on_servers,
      });
      const effectiveId = replaced?.id || state.server_playlist_id;
      if (state.update) await state.update({
        server_playlist_id: effectiveId,
        last_synced_at: new Date(),
        last_error: null,
      });
    } else {
      const created = await adapter.createPlaylist(name, itemIds, { public: !!playlist.public_on_servers });
      if (state) {
        // State row exists from a prior failure (last_error set, server_playlist_id null).
        // Update it in place rather than creating a duplicate — the unique constraint
        // (playlist_id, server_type) would reject a second create.
        if (state.update) await state.update({
          server_playlist_id: created.id,
          last_synced_at: new Date(),
          last_error: null,
        });
      } else {
        await PlaylistSyncState.create({
          playlist_id: playlist.id,
          server_type: serverType,
          server_playlist_id: created.id,
          last_synced_at: new Date(),
        });
      }
    }
  }

  // Resolve the whole batch per polling round rather than per file: each round
  // re-queries the server so files indexed by the in-flight library scan are
  // picked up, and only still-missing paths are retried. With a bulk adapter
  // (Plex) this costs (sections x rounds) listing fetches instead of
  // (sections x files x rounds). Returns Map<filePath, itemId> for resolved
  // paths only.
  async _resolveAllWithBackoff(adapter, filepaths) {
    const resolved = new Map();
    let pending = [...new Set(filepaths)];
    const collect = (results) => {
      for (const [filepath, id] of results) {
        if (id) resolved.set(filepath, id);
      }
      pending = pending.filter((filepath) => !resolved.has(filepath));
    };

    if (!pending.length) return resolved;
    collect(await adapter.resolveItemIdsByFilepaths(pending));
    for (const delay of POLL_BACKOFFS_MS) {
      if (!pending.length) break;
      await new Promise((r) => setTimeout(r, delay));
      collect(await adapter.resolveItemIdsByFilepaths(pending));
    }
    return resolved;
  }

  // Never throws: this runs inside _doSync's per-adapter catch, and a
  // failure here must not abort the sync of the remaining adapters.
  async _recordError(playlistId, serverType, message) {
    try {
      const state = await PlaylistSyncState.findOne({
        where: { playlist_id: playlistId, server_type: serverType },
      });
      if (state) {
        if (state.update) await state.update({ last_error: message });
      } else {
        await PlaylistSyncState.create({ playlist_id: playlistId, server_type: serverType, last_error: message });
      }
    } catch (err) {
      logger.error({ err, playlist_db_id: playlistId, serverType }, 'failed to record playlist sync error');
    }
  }
}

module.exports = new MediaServerSync();
