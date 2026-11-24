const { QueryTypes } = require('sequelize');
const playlistSelection = require('./download/playlistAutoSelection');
const logger = require('../logger');
const videoActivity = require('./download/videoActivity');
const { findArchiveOnlyIds } = require('./archiveOnlyIds');
const playlistFilters = require('./playlistFilters');

// Videos listed by the settings dialog's filter preview; its counts cover all.
const FILTER_PREVIEW_LIMIT = 50;

// Raw SQL: one grouped count for a whole page of playlists. "Downloaded" means
// a usable file on disk, the same predicate as the playlist videos listing's
// per-row `downloaded` flag and its Downloaded filter (routes/playlists.js,
// playlistVideoFilters.js). Deleted downloads do not count.
const DOWNLOADED_COUNT_SQL = `
  SELECT pv.playlist_id, COUNT(*) AS downloaded
  FROM playlistvideos pv
  JOIN videos v ON v.youtube_id = pv.youtube_id
  WHERE pv.playlist_id IN (:playlistIds)
    AND v.removed = 0
    AND (v.file_path IS NOT NULL OR v.audio_file_path IS NOT NULL)
  GROUP BY pv.playlist_id
`;

// Dependencies are passed at call time, as in playlistVideoFilters, to keep
// download orchestration out of the route without introducing a module cycle.
class PlaylistDownloadModule {
  /**
   * The tracked videos a download path may queue. Pass the playlist as
   * `filterBy` on paths where Youtarr picks the videos (scheduled runs,
   * download all, the suggested batch): `filteredIds` then holds the candidates
   * its download filters skip. They stay in `candidates`, so a path where the
   * user picks the videos can ignore `filteredIds` and queue them anyway.
   */
  async getTrackedVideos(playlistId, { PlaylistVideo, Video, playlistModule }, {
    youtubeIds, includeIgnored = false, allowRedownload = false, excludeActive = false, filterBy = null,
  } = {}) {
    const rows = await PlaylistVideo.findAll({
      where: { playlist_id: playlistId, ...(!includeIgnored && { ignored: false }), ...(youtubeIds && { youtube_id: youtubeIds }) },
      attributes: ['id', 'youtube_id', 'channel_id', 'channel_name', 'title', 'duration', 'position', 'published_at', 'added_at', 'first_seen_at', 'auto_download_requested', 'auto_download_last_attempt_at'],
      order: [['position', 'ASC']],
    });
    const candidates = rows.filter((row) => row.youtube_id && !playlistModule.isUnavailableTitle(row.title));
    const existing = candidates.length && !allowRedownload ? await Video.findAll({
      where: { youtubeId: candidates.map((row) => row.youtube_id) },
      attributes: ['youtubeId', 'filePath', 'audioFilePath'],
    }) : [];
    const downloaded = new Set(existing.map((video) => video.youtubeId));
    // Without a re-download, yt-dlp also skips what the archive lists without a
    // row (e.g. emptied from the trash with its archive entry kept); queued, such
    // a video would never download and would be picked again on every sweep.
    const archiveOnly = allowRedownload ? new Set() : await findArchiveOnlyIds(
      candidates.map((row) => row.youtube_id).filter((id) => !downloaded.has(id))
    );
    const eligible = candidates.filter((row) => !downloaded.has(row.youtube_id) &&
      !archiveOnly.has(row.youtube_id) && (!excludeActive || !videoActivity.isActive(row.youtube_id)));
    const { filteredIds, error: filterError } = filterBy
      ? await this.findSkippedIds(filterBy, eligible)
      : { filteredIds: new Set(), error: null };
    return { candidates: eligible, existing, filteredIds, filterError };
  }

  /**
   * The rows a playlist's download filters skip. A video the user selected
   * (a saved batch request) is never skipped, even when a filter that cannot
   * be evaluated holds everything else.
   * @param {Object} settings - Playlist row, or its filter fields
   * @param {Array<Object>} rows - Playlist video rows with title, duration and auto_download_requested
   * @returns {Promise<{ filteredIds: Set<string>, error: ?string }>}
   */
  async findSkippedIds(settings, rows) {
    const { filteredIds, error } = await playlistFilters.findFilteredIds(settings, rows);
    for (const row of rows) {
      if (row.auto_download_requested) filteredIds.delete(row.youtube_id);
    }
    return { filteredIds, error };
  }

  /**
   * Videos with a file on disk per playlist, keyed by playlist_id. Playlists
   * with none are absent from the map.
   * @param {string[]} playlistIds
   * @param {{ PlaylistVideo: Object }} deps
   * @returns {Promise<Map<string, number>>}
   */
  async getDownloadedCounts(playlistIds, { PlaylistVideo }) {
    if (!playlistIds.length) return new Map();
    const rows = await PlaylistVideo.sequelize.query(DOWNLOADED_COUNT_SQL, {
      replacements: { playlistIds },
      type: QueryTypes.SELECT,
    });
    return new Map(rows.map((row) => [row.playlist_id, Number(row.downloaded)]));
  }

  async getCounts(playlist, deps) {
    const { candidates, existing, filteredIds, filterError } = await this.getTrackedVideos(
      playlist.playlist_id, deps, { filterBy: playlist }
    );
    const downloadedCounts = await this.getDownloadedCounts([playlist.playlist_id], deps);
    const pending = playlist.auto_download_baseline_at ? playlistSelection.selectNewSinceBaseline({
      candidates,
      baselineAt: playlist.auto_download_baseline_at,
      baselineId: playlist.auto_download_baseline_id,
      limit: candidates.length,
    }) : { discoveries: [], retries: [] };
    const targetsAudio = playlist.audio_format === 'mp3_only';
    return {
      downloaded_count: downloadedCounts.get(playlist.playlist_id) || 0,
      not_downloaded_count: candidates.length,
      following_existing_count: candidates.length - pending.discoveries.length - pending.retries.length,
      following_requested_count: candidates.filter((row) => row.auto_download_requested).length,
      unsyncable_count: existing.filter((video) => {
        const matching = targetsAudio ? video.audioFilePath : video.filePath;
        return !matching && (video.filePath || video.audioFilePath);
      }).length,
      // Skipped by the download filters; following_existing_count is left as
      // the older videos, whether or not a filter would also skip them.
      filtered_count: filteredIds.size,
      filter_error: filterError,
    };
  }

  async getPreview(playlist, { order, count }, deps) {
    const { candidates: rows, filteredIds } = await this.getTrackedVideos(
      playlist.playlist_id, deps, { excludeActive: true, filterBy: playlist }
    );
    const candidates = rows.map((row) => ({
      youtube_id: row.youtube_id, title: row.title, position: row.position, published_at: row.published_at,
      filtered: filteredIds.has(row.youtube_id),
    }));
    const { selected, missingDates } = playlistSelection.selectBatchEntries({ candidates, order, limit: count, filteredIds });
    return { candidates, selectedIds: selected.map((row) => row.youtube_id), missingDates };
  }

  /**
   * What proposed download filters would do to this playlist, before they are
   * saved: how many tracked videos match, which of the most recently
   * discovered ones do, and how many waiting discoveries would then download
   * automatically (null before a starting point exists).
   * @param {Object} playlist
   * @param {{ title_filter_regex: ?string, min_duration: ?number, max_duration: ?number }} proposed
   * @returns {Promise<Object>} The preview, or { error } when the pattern cannot be evaluated
   */
  async getFilterPreview(playlist, proposed, deps) {
    const rows = await deps.PlaylistVideo.findAll({
      where: { playlist_id: playlist.playlist_id },
      attributes: ['id', 'youtube_id', 'title', 'duration'],
      order: [['id', 'DESC']],
    });
    const available = rows.filter((row) => row.youtube_id && !deps.playlistModule.isUnavailableTitle(row.title));
    const { filteredIds, error } = await playlistFilters.findFilteredIds(
      { ...proposed, playlist_id: playlist.playlist_id }, available
    );
    if (error) return { error };

    let waitingCount = null;
    if (playlist.auto_download_baseline_at) {
      // Count what a scheduled run could still queue: active downloads are
      // already admitted, and a row a refresh added since the read above was
      // never checked against the proposed filters.
      const evaluatedIds = new Set(available.map((row) => row.youtube_id));
      const tracked = await this.getTrackedVideos(playlist.playlist_id, deps, { excludeActive: true });
      const candidates = tracked.candidates.filter((row) => evaluatedIds.has(row.youtube_id));
      const skipped = new Set(candidates
        .filter((row) => filteredIds.has(row.youtube_id) && !row.auto_download_requested)
        .map((row) => row.youtube_id));
      waitingCount = playlistSelection.selectNewSinceBaseline({
        candidates,
        baselineAt: playlist.auto_download_baseline_at,
        baselineId: playlist.auto_download_baseline_id,
        limit: candidates.length,
        filteredIds: skipped,
      }).discoveries.length;
    }

    const videos = available.slice(0, FILTER_PREVIEW_LIMIT).map((row) => ({
      youtube_id: row.youtube_id,
      title: row.title,
      duration: row.duration ?? null,
      matches: !filteredIds.has(row.youtube_id),
    }));
    return {
      totalCount: available.length,
      matchCount: available.length - filteredIds.size,
      waitingCount,
      videos,
      truncated: available.length > videos.length,
    };
  }

  async queueBatch(playlist, videoIds, deps) {
    const { candidates } = await this.getTrackedVideos(playlist.playlist_id, deps, { excludeActive: true });
    const wanted = new Set(videoIds);
    const ids = candidates.filter((row) => wanted.has(row.youtube_id)).map((row) => row.youtube_id);
    if (!ids.length) return { queued: 0 };

    const canRetry = Boolean(playlist.auto_download && playlist.auto_download_baseline_at);
    if (canRetry) {
      await deps.PlaylistVideo.update({ auto_download_requested: true }, {
        where: { playlist_id: playlist.playlist_id, youtube_id: ids },
      });
    }
    try {
      // Record selection before admission, including attempts whose queue call
      // fails or whose admitted job later crashes. The original batch is full.
      if (canRetry) await this.markRequestedAttempt(playlist.playlist_id, ids, deps);
      return { queued: await deps.downloadModule.doPlaylistDownloads(playlist, { youtubeIds: ids }) };
    } catch (err) {
      if (!canRetry) throw err;
      if (deps.storageGuard && deps.storageGuard.isPausedError(err)) {
        (deps.logger || logger).info({ playlist_id: playlist.playlist_id, count: ids.length }, 'Saved playlist batch for retry while downloads are paused');
        return { queued: 0, warning: `${err.message}. Selection saved; auto-download will queue it once downloads resume.` };
      }
      (deps.logger || logger).error({ err, playlist_id: playlist.playlist_id, count: ids.length }, 'Queueing saved playlist batch failed');
      return { queued: 0, warning: 'Selection saved. Queuing failed; auto-download will retry on a scheduled run.' };
    }
  }

  async markRequestedAttempt(playlistId, ids, { PlaylistVideo }) {
    if (!ids.length) return;
    await PlaylistVideo.update({ auto_download_last_attempt_at: new Date() }, {
      where: { playlist_id: playlistId, youtube_id: ids, auto_download_requested: true },
    });
  }
}

module.exports = new PlaylistDownloadModule();
