const logger = require('../logger');
const { Playlist, PlaylistVideo, Video } = require('../models');
const m3uGenerator = require('./m3uGenerator');
const mediaServerSync = require('./mediaServers/mediaServerSync');
const { REMOVAL_STATES, removalState } = require('./videoRemovalState');

// How long a playlist waits after its last ignore change before its outputs
// are rebuilt, so a run of changes costs one media server sync.
const IGNORE_CHANGE_REFRESH_DELAY_MS = 30 * 1000;

/**
 * Rebuilds what Youtarr publishes for a playlist (its .m3u file and synced
 * media server playlists) when its videos lose their files outside a
 * download, so neither keeps listing a file that is gone.
 */
class PlaylistOutputRefresh {
  constructor() {
    // playlist db id -> timer of the refresh waiting on its delay
    this._pending = new Map();
  }

  /**
   * After videos of one playlist were ignored or unignored: rebuild its
   * outputs once the delay passes, but only when one of the videos is listed
   * in them (has a file, or a missing one that may return). Never rejects.
   * @param {number} playlistDbId
   * @param {string[]} youtubeIds
   * @returns {Promise<boolean>} Whether a refresh is now waiting
   */
  async scheduleIfListed(playlistDbId, youtubeIds) {
    try {
      const rows = await Video.findAll({
        where: { youtubeId: youtubeIds },
        attributes: ['removed', 'removed_reason'],
      });
      if (!rows.some((row) => removalState(row) !== REMOVAL_STATES.DELETED)) return false;
    } catch (err) {
      logger.error({ err, playlist_db_id: playlistDbId }, 'Failed to schedule a playlist refresh after an ignore change');
      return false;
    }

    const key = String(playlistDbId);
    clearTimeout(this._pending.get(key));
    const timer = setTimeout(() => {
      this._pending.delete(key);
      this._refreshPlaylistInBackground(playlistDbId);
    }, IGNORE_CHANGE_REFRESH_DELAY_MS);
    // A waiting refresh must not hold the process open at shutdown.
    timer.unref();
    this._pending.set(key, timer);
    return true;
  }

  /**
   * Run a playlist's waiting refresh now instead of after its delay.
   * @param {number} playlistDbId
   * @returns {boolean} Whether a refresh was waiting
   */
  runPending(playlistDbId) {
    const key = String(playlistDbId);
    const timer = this._pending.get(key);
    if (!timer) return false;
    clearTimeout(timer);
    this._pending.delete(key);
    this._refreshPlaylistInBackground(playlistDbId);
    return true;
  }

  _refreshPlaylistInBackground(playlistDbId) {
    const logFailure = (err) => {
      logger.error({ err, playlist_db_id: playlistDbId }, 'Failed to refresh playlist M3U and media server sync');
    };
    // The playlist may have been removed while the refresh waited, and
    // neither writer checks: a removed playlist keeps its outputs as they are.
    Playlist.findOne({ where: { id: playlistDbId, enabled: true }, attributes: ['id'] })
      .then((playlist) => {
        if (!playlist) return undefined;
        // A failed M3U rebuild does not hold back the media server sync.
        return m3uGenerator.generatePlaylistM3U(playlistDbId)
          .catch(logFailure)
          .then(() => mediaServerSync.syncPlaylist(playlistDbId));
      })
      .catch(logFailure);
  }

  /**
   * Regenerate the M3U and re-sync media servers for every enabled playlist
   * that includes any of the videos, one playlist at a time.
   * @param {string[]} youtubeIds
   * @returns {Promise<void>}
   */
  async refreshForVideos(youtubeIds) {
    const ids = [...new Set((youtubeIds || []).filter(Boolean))];
    if (ids.length === 0) return;

    const rows = await PlaylistVideo.findAll({
      where: { youtube_id: ids, ignored: false },
      attributes: ['playlist_id'],
    });
    const playlistIds = [...new Set(rows.map((row) => row.playlist_id))];
    if (playlistIds.length === 0) return;

    const playlists = await Playlist.findAll({ where: { playlist_id: playlistIds, enabled: true } });
    for (const playlist of playlists) {
      try {
        await m3uGenerator.generatePlaylistM3U(playlist.id);
        await mediaServerSync.syncPlaylist(playlist.id);
      } catch (err) {
        logger.error({ err, playlist_id: playlist.playlist_id }, 'Failed to refresh playlist M3U and media server sync');
      }
    }
  }

  /**
   * Fire-and-forget wrapper for callers that should not wait on media server
   * syncs (library scans and item lookups can take minutes).
   * @param {string[]} youtubeIds
   * @param {string} reason - What changed the videos, for the log
   */
  refreshForVideosInBackground(youtubeIds, reason) {
    this.refreshForVideos(youtubeIds).catch((err) => {
      logger.error({ err, reason }, 'Failed to refresh playlists after their videos changed');
    });
  }
}

module.exports = new PlaylistOutputRefresh();
