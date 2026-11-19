const logger = require('../../logger');
const configModule = require('../configModule');
const serverRegistry = require('./serverRegistry');
const messageEmitter = require('../messageEmitter');
const { MediaServerUnavailableError, describeHttpError, extractBasename } = require('./adapters/baseAdapter');
const { Playlist, PlaylistVideo, PlaylistSyncState, Video } = require('../../models');
const reorganizeLock = require('../reorganize/reorganizeLock');
const libraryLocator = require('./libraryLocator');
const { REMOVAL_STATES, removalState } = require('../videoRemovalState');

// Backoff retry for resolving items after library scan. Tuned for typical Plex/Jellyfin
// scan completion times — short initial delays, then longer as more time passes.
const POLL_BACKOFFS_MS = [2000, 5000, 10000, 20000, 30000];

const ADAPTER_TYPE_TAG = {
  PlexAdapter: 'plex',
  JellyfinAdapter: 'jellyfin',
  EmbyAdapter: 'emby',
};

const SERVER_DISPLAY_NAME = {
  plex: 'Plex',
  jellyfin: 'Jellyfin',
  emby: 'Emby',
};

const DOWNLOAD_TYPE_LABEL = {
  video_mp3: 'Video + MP3',
  mp3_only: 'MP3 Only',
};

// Why a sync created or changed nothing on the server. The playlist page shows
// this text as is, so it is whole sentences that name the likely cause.
function describeDeferral({ playlist, mediaType, serverName, hasEntries, mismatched }) {
  const isAudio = mediaType === 'audio';
  const downloadType = DOWNLOAD_TYPE_LABEL[playlist.audio_format] || 'Video Only';
  const syncsAs = `This playlist syncs as a ${isAudio ? 'music' : 'video'} playlist because its Download Type is ${downloadType}.`;

  if (!hasEntries) {
    if (mismatched === 0) return 'No downloaded items to sync yet.';
    return `None of the downloaded items has ${isAudio ? 'an MP3' : 'a video'} file. ${syncsAs}`;
  }
  const notFound = `Downloaded ${isAudio ? 'MP3' : 'video'} files were not found on ${serverName}. If they were just downloaded, the server may still be scanning; otherwise check that the files still exist and that the server has a ${isAudio ? 'music' : 'video'}-type library that includes your Youtarr output folder.`;
  // Video + MP3 is the one type whose sync type surprises: its mp3s may sit
  // in a music library while the sync looks for the videos.
  return playlist.audio_format === 'video_mp3' ? `${notFound} ${syncsAs}` : notFound;
}

// The message recorded for a failed sync. It is shown on the playlist page,
// so an HTTP failure is reduced to its status or error code.
function describeSyncFailure(err, serverName) {
  if (err && err.isAxiosError) {
    const { status, code } = describeHttpError(err);
    const detail = status ? `HTTP ${status}` : code;
    return detail ? `${serverName} request failed (${detail}).` : `${serverName} request failed.`;
  }
  return err && err.message ? err.message : String(err);
}

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
    // Playlists whose sync was put off while a reorganize moved files.
    this._deferred = new Set();
    reorganizeLock.on('released', () => this._runDeferred());
  }

  _runDeferred() {
    const ids = [...this._deferred];
    this._deferred.clear();
    for (const playlistId of ids) {
      this.syncPlaylist(playlistId).catch((err) => {
        logger.error({ err, playlistId }, 'Deferred media server playlist sync failed');
      });
    }
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
    this._broadcastSyncUpdated(playlistId);
    return entry.promise;
  }

  // A reorganize refuses to start while any playlist sync runs.
  isAnySyncInFlight() {
    return this._inFlight.size > 0;
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
      this._broadcastSyncUpdated(playlistId);
    }
  }

  // Tells open playlist pages to re-read the sync status. Sent when a run
  // starts and after it ends; never throws, since a sync must not fail over it.
  _broadcastSyncUpdated(playlistId) {
    try {
      messageEmitter.emitMessage('broadcast', null, 'playlists', 'playlistSyncUpdated', { playlistDbId: playlistId });
    } catch (err) {
      logger.warn({ err, playlist_db_id: playlistId }, 'failed to broadcast playlist sync update');
    }
  }

  // The last recorded result per server plus whether a sync is running now,
  // for the playlist page.
  async getSyncStatus(playlist) {
    const syncing = this._inFlight.has(String(playlist.id));
    const rows = await PlaylistSyncState.findAll({ where: { playlist_id: playlist.id } });
    const servers = {};
    for (const row of rows) {
      servers[row.server_type] = { last_synced_at: row.last_synced_at, last_error: row.last_error };
    }
    return { syncing, servers };
  }

  async _doSync(playlistId) {
    // Paths are mid-move; the sync runs once the reorganize ends.
    if (reorganizeLock.isActive()) {
      logger.info({ playlistId }, 'Downloads are being reorganized; deferring the media server playlist sync');
      this._deferred.add(playlistId);
      return;
    }
    const playlist = await Playlist.findByPk(playlistId);
    if (!playlist) return;

    const positionDirection = playlist.sort_order === 'reversed' ? 'DESC' : 'ASC';
    const videos = await PlaylistVideo.findAll({
      where: { playlist_id: playlist.playlist_id, ignored: false },
      order: [['position', positionDirection]],
    });

    const config = configModule.getConfig();
    const adapters = serverRegistry.getEnabledAdapters(config);

    for (const adapter of adapters) {
      const serverType = ADAPTER_TYPE_TAG[adapter.constructor.name];
      if (!this._shouldSync(playlist, serverType)) continue;

      try {
        await this._syncToOne(playlist, videos, adapter, serverType);
      } catch (err) {
        await this._handleSyncError(err, playlist, serverType);
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

    // Server playlists are media-typed (Plex audio vs video, Jellyfin/Emby
    // MediaType) and can't mix types. The Download Type setting decides which
    // type we sync, not what's on disk: per-video overrides can mix formats,
    // and one manual video download shouldn't flip an audio playlist to video.
    const mediaType = playlist.audio_format === 'mp3_only' ? 'audio' : 'video';
    const entries = [];
    let mismatched = 0;
    for (const pv of videos) {
      const v = byYoutubeId.get(pv.youtube_id);
      // A deleted row keeps its stored paths, but its file is gone for good.
      // A missing one stays: its file may come back.
      if (!v || removalState(v) === REMOVAL_STATES.DELETED) continue;
      const mediaPath = mediaType === 'audio' ? v.audioFilePath : v.filePath;
      if (mediaPath) {
        entries.push({ youtube_id: pv.youtube_id, filePath: mediaPath });
      } else if (v.filePath || v.audioFilePath) {
        mismatched += 1;
      }
    }
    if (mismatched > 0) {
      logger.info(
        { playlist_id: playlist.playlist_id, serverType, mediaType, mismatched },
        `Playlist "${playlist.title}" has ${mismatched} downloaded item(s) with no ${mediaType === 'audio' ? 'mp3' : 'video'} file; leaving them out (the playlist's Download Type setting makes this a ${mediaType} playlist, and media servers cannot mix types)`
      );
    }

    // The media type tells Plex whether music sections need a scan; audio
    // files have no other scan trigger anywhere in Youtarr. Jellyfin/Emby
    // ignore the hint (their refresh already covers every library).
    await adapter.triggerLibraryScan(null, { mediaType });

    // Plex lists whole sections each round, so only the ones that hold Youtarr's folders.
    const libraryIds = serverType === 'plex' ? await libraryLocator.scopeFor(adapter) : null;
    const resolvedByPath = await this._resolveAllWithBackoff(
      adapter,
      entries.map((entry) => entry.filePath),
      { libraryIds }
    );
    const serverName = SERVER_DISPLAY_NAME[serverType] || serverType;
    const itemType = mediaType === 'audio' ? 'Audio' : 'Video';
    const itemIds = [];
    for (const entry of entries) {
      const id = resolvedByPath.get(entry.filePath);
      if (id) {
        itemIds.push(id);
        continue;
      }
      const fileName = extractBasename(entry.filePath);
      logger.warn(
        { youtube_id: entry.youtube_id, serverType, fileName, itemType },
        `Unable to sync item ${entry.youtube_id} for playlist "${playlist.title}" to ${serverName}: ${itemType} file "${fileName}" not found on server, skipping`
      );
    }

    const name = `YT: ${playlist.title}`;
    const state = await PlaylistSyncState.findOne({
      where: { playlist_id: playlist.id, server_type: serverType },
    });

    // With zero resolved items, the only case that proceeds is a deliberately
    // emptied playlist (every video ignored, or every downloaded file deleted)
    // with an existing server playlist to empty (Jellyfin/Emby delete it
    // instead; see replacePlaylistItems). Everything else defers: the
    // servers reject empty playlist creation, and replacing an existing
    // playlist with nothing would wipe it over a transient condition (scan
    // lag, a missing file that may come back, or downloads that don't match a
    // just-changed Download Type).
    const hasFiles = entries.length > 0 || mismatched > 0;
    if (itemIds.length === 0 && !(state?.server_playlist_id && !hasFiles)) {
      const reason = describeDeferral({
        playlist, mediaType, serverName, hasEntries: entries.length > 0, mismatched,
      });
      logger.info(
        { playlist_id: playlist.playlist_id, serverType },
        `Deferring ${serverName} sync of playlist "${playlist.title}": ${reason}`
      );
      // Recorded so the playlist page can say why nothing synced. Only the
      // reason is written: the server playlist id and last_synced_at stay.
      await this._recordError(playlist.id, serverType, reason);
      return;
    }

    if (state?.server_playlist_id) {
      // Pass name+public so adapters that implement replace as delete+recreate
      // (Jellyfin, Emby) can construct the new playlist. Plex replaces in place
      // and ignores opts. Capture the returned id in case the adapter recreated
      // — the sync-state row must track the new id.
      const replaced = await adapter.replacePlaylistItems(state.server_playlist_id, itemIds, {
        name, public: !!playlist.public_on_servers, mediaType,
      });
      // id null: emptying it left no playlist on the server (it cannot hold an
      // empty one); the next sync with items creates a fresh one.
      const effectiveId = replaced?.id === null ? null : (replaced?.id || state.server_playlist_id);
      if (state.update) await state.update({
        server_playlist_id: effectiveId,
        last_synced_at: new Date(),
        last_error: null,
      });
    } else {
      const created = await adapter.createPlaylist(name, itemIds, { public: !!playlist.public_on_servers, mediaType });
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
  async _resolveAllWithBackoff(adapter, filepaths, { libraryIds = null } = {}) {
    const resolved = new Map();
    let pending = [...new Set(filepaths)];
    const collect = (results) => {
      for (const [filepath, id] of results) {
        if (id) resolved.set(filepath, id);
      }
      pending = pending.filter((filepath) => !resolved.has(filepath));
    };

    if (!pending.length) return resolved;
    collect(await adapter.resolveItemIdsByFilepaths(pending, { libraryIds }));
    for (const delay of POLL_BACKOFFS_MS) {
      if (!pending.length) break;
      await new Promise((r) => setTimeout(r, delay));
      collect(await adapter.resolveItemIdsByFilepaths(pending, { libraryIds }));
    }
    return resolved;
  }

  // Turn a thrown sync error into one user-readable log line plus a concise
  // recorded last_error. An unreachable/unresponsive server gets a friendly
  // "not reachable" message; anything else logs a compact reason. Never the raw
  // axios error, which would dump the API token into the logs.
  async _handleSyncError(err, playlist, serverType) {
    const serverName = SERVER_DISPLAY_NAME[serverType] || serverType;
    if (err instanceof MediaServerUnavailableError) {
      logger.warn(
        { playlist_id: playlist.playlist_id, serverType },
        `Unable to sync playlist "${playlist.title}" to ${serverName}: server not reachable or not responding. Please ensure that your media server is up and reachable.`
      );
      await this._recordError(playlist.id, serverType, `${serverName} not reachable or not responding.`);
      return;
    }
    const logData = { playlist_id: playlist.playlist_id, serverType };
    if (err && err.isAxiosError) logData.reason = describeHttpError(err);
    else logData.err = err;
    logger.error(logData, `Unable to sync playlist "${playlist.title}" to ${serverName}`);
    await this._recordError(playlist.id, serverType, describeSyncFailure(err, serverName));
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
