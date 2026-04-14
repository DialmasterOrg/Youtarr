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
  async syncPlaylist(playlistId) {
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
    const filepaths = [];
    for (const pv of videos) {
      const v = await Video.findOne({ where: { youtubeId: pv.youtube_id } });
      if (v && v.filePath) filepaths.push({ youtube_id: pv.youtube_id, filePath: v.filePath });
    }

    await adapter.triggerLibraryScan();

    const itemIds = [];
    for (const entry of filepaths) {
      const id = await this._resolveWithBackoff(adapter, entry.filePath);
      if (id) itemIds.push(id);
      else logger.warn({ youtube_id: entry.youtube_id, serverType }, 'unresolved on media server, skipping');
    }

    const name = `YT: ${playlist.title}`;
    const state = await PlaylistSyncState.findOne({
      where: { playlist_id: playlist.id, server_type: serverType },
    });

    if (state?.server_playlist_id) {
      await adapter.replacePlaylistItems(state.server_playlist_id, itemIds);
      if (state.update) await state.update({ last_synced_at: new Date(), last_error: null });
    } else {
      const created = await adapter.createPlaylist(name, itemIds, { public: !!playlist.public_on_servers });
      await PlaylistSyncState.create({
        playlist_id: playlist.id,
        server_type: serverType,
        server_playlist_id: created.id,
        last_synced_at: new Date(),
      });
    }
  }

  async _resolveWithBackoff(adapter, filepath) {
    let resolved = await adapter.resolveItemIdByFilepath(filepath);
    if (resolved) return resolved;
    for (const delay of POLL_BACKOFFS_MS) {
      await new Promise((r) => setTimeout(r, delay));
      resolved = await adapter.resolveItemIdByFilepath(filepath);
      if (resolved) return resolved;
    }
    return null;
  }

  async _recordError(playlistId, serverType, message) {
    const state = await PlaylistSyncState.findOne({
      where: { playlist_id: playlistId, server_type: serverType },
    });
    if (state) {
      if (state.update) await state.update({ last_error: message });
    } else {
      await PlaylistSyncState.create({ playlist_id: playlistId, server_type: serverType, last_error: message });
    }
  }
}

module.exports = new MediaServerSync();
