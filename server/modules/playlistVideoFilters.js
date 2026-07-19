const { Op } = require('sequelize');

// Resolves the youtube_id constraint for the paginated playlist-videos
// listing from the request's downloadState/watchedState filters. Each active
// filter contributes an allowed set ("only this") or an excluded set ("hide
// this"); the final constraint is the allowed intersection minus every
// exclusion. Models and watchStatusQueries are passed at call time so the
// playlists route keeps its dependency-injection pattern.
class PlaylistVideoFilters {
  /**
   * @param {string} params.downloadState - 'all' | 'downloaded' | 'not_downloaded'
   * @param {string} params.watchedState - 'all' | 'watched' | 'not_watched'
   * @returns {Promise<{empty: boolean, youtubeIdWhere: Object|null}>} empty
   *   means no row can match (caller should short-circuit); youtubeIdWhere is
   *   an Op.in/Op.notIn condition for the youtube_id column, or null for no
   *   constraint.
   */
  async resolveVideoIdFilter({ playlistId, downloadState, watchedState, PlaylistVideo, Video, watchStatusQueries }) {
    if (downloadState === 'all' && watchedState === 'all') {
      return { empty: false, youtubeIdWhere: null };
    }

    const members = await PlaylistVideo.findAll({
      where: { playlist_id: playlistId },
      attributes: ['youtube_id'],
    });
    const memberIds = members.map((m) => m.youtube_id).filter(Boolean);
    let existing = [];
    if (memberIds.length > 0 && Video) {
      existing = await Video.findAll({
        where: { youtubeId: memberIds },
        attributes: ['id', 'youtubeId', 'removed', 'filePath', 'audioFilePath'],
      });
    }

    let allowedIds = null;
    const excludedIds = new Set();

    if (downloadState !== 'all') {
      // Same usable-file predicate as the per-row `downloaded` flag in the
      // listing route so the two can never disagree. Rows with a Videos
      // record but no usable file (downloaded, then deleted) count as not
      // downloaded.
      const downloadedIds = existing
        .filter((v) => !v.removed && (v.filePath || v.audioFilePath))
        .map((v) => v.youtubeId);
      if (downloadState === 'downloaded') {
        allowedIds = new Set(downloadedIds);
      } else {
        downloadedIds.forEach((id) => excludedIds.add(id));
      }
    }

    if (watchedState !== 'all') {
      // Watched means "has a watched-by entry under the configured watched
      // rule"; never-downloaded and never-synced videos count as not watched.
      const watchedMap = await watchStatusQueries.getWatchedByMap(existing.map((v) => v.id));
      const watchedIds = existing
        .filter((v) => (watchedMap.get(v.id) || []).length > 0)
        .map((v) => v.youtubeId);
      if (watchedState === 'watched') {
        allowedIds = allowedIds === null
          ? new Set(watchedIds)
          : new Set(watchedIds.filter((id) => allowedIds.has(id)));
      } else {
        watchedIds.forEach((id) => excludedIds.add(id));
      }
    }

    if (allowedIds !== null) {
      const finalIds = [...allowedIds].filter((id) => !excludedIds.has(id));
      if (finalIds.length === 0) {
        return { empty: true, youtubeIdWhere: null };
      }
      return { empty: false, youtubeIdWhere: { [Op.in]: finalIds } };
    }
    if (excludedIds.size > 0) {
      // Op.notIn with an empty list would generate NOT IN (NULL), which
      // matches nothing; with nothing to exclude every row qualifies, so add
      // no constraint at all.
      return { empty: false, youtubeIdWhere: { [Op.notIn]: [...excludedIds] } };
    }
    return { empty: false, youtubeIdWhere: null };
  }
}

module.exports = new PlaylistVideoFilters();
