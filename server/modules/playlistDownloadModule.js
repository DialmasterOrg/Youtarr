const playlistSelection = require('./download/playlistAutoSelection');
const logger = require('../logger');
const videoActivity = require('./download/videoActivity');

// Dependencies are passed at call time, as in playlistVideoFilters, to keep
// download orchestration out of the route without introducing a module cycle.
class PlaylistDownloadModule {
  async getTrackedVideos(playlistId, { PlaylistVideo, Video, playlistModule }, {
    youtubeIds, includeIgnored = false, allowRedownload = false, excludeActive = false,
  } = {}) {
    const rows = await PlaylistVideo.findAll({
      where: { playlist_id: playlistId, ...(!includeIgnored && { ignored: false }), ...(youtubeIds && { youtube_id: youtubeIds }) },
      attributes: ['id', 'youtube_id', 'channel_id', 'channel_name', 'title', 'position', 'published_at', 'added_at', 'first_seen_at', 'auto_download_requested', 'auto_download_last_attempt_at'],
      order: [['position', 'ASC']],
    });
    const candidates = rows.filter((row) => row.youtube_id && !playlistModule.isUnavailableTitle(row.title));
    const existing = candidates.length && !allowRedownload ? await Video.findAll({
      where: { youtubeId: candidates.map((row) => row.youtube_id) },
      attributes: ['youtubeId', 'filePath', 'audioFilePath'],
    }) : [];
    const downloaded = new Set(existing.map((video) => video.youtubeId));
    return { candidates: candidates.filter((row) => !downloaded.has(row.youtube_id) &&
      (!excludeActive || !videoActivity.isActive(row.youtube_id))), existing };
  }

  async getCounts(playlist, deps) {
    const { candidates, existing } = await this.getTrackedVideos(playlist.playlist_id, deps);
    const pending = playlist.auto_download_baseline_at ? playlistSelection.selectNewSinceBaseline({
      candidates,
      baselineAt: playlist.auto_download_baseline_at,
      baselineId: playlist.auto_download_baseline_id,
      limit: candidates.length,
    }) : { discoveries: [], retries: [] };
    const targetsAudio = playlist.audio_format === 'mp3_only';
    return {
      not_downloaded_count: candidates.length,
      following_existing_count: candidates.length - pending.discoveries.length - pending.retries.length,
      following_requested_count: candidates.filter((row) => row.auto_download_requested).length,
      unsyncable_count: existing.filter((video) => {
        const matching = targetsAudio ? video.audioFilePath : video.filePath;
        return !matching && (video.filePath || video.audioFilePath);
      }).length,
    };
  }

  async getPreview(playlistId, { order, count }, deps) {
    const { candidates: rows } = await this.getTrackedVideos(playlistId, deps, { excludeActive: true });
    const candidates = rows.map((row) => ({
      youtube_id: row.youtube_id, title: row.title, position: row.position, published_at: row.published_at,
    }));
    const { selected, missingDates } = playlistSelection.selectBatchEntries({ candidates, order, limit: count });
    return { candidates, selectedIds: selected.map((row) => row.youtube_id), missingDates };
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
