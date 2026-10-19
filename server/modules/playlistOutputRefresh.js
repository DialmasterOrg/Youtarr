const logger = require('../logger');
const { Playlist, PlaylistVideo } = require('../models');
const m3uGenerator = require('./m3uGenerator');
const mediaServerSync = require('./mediaServers/mediaServerSync');

/**
 * Rebuilds what Youtarr publishes for a playlist (its .m3u file and synced
 * media server playlists) when its videos lose their files outside a
 * download, so neither keeps listing a file that is gone.
 */
class PlaylistOutputRefresh {
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
