const ChannelVideo = require('../models/channelvideo');
const { Video, Channel } = require('../models');
const downloadModule = require('./downloadModule');
const { channelDownloadAllJobLabel } = require('./download/jobTypes');
const { MEDIA_TAB_TYPE_MAP } = require('./tabsUtils');
const logger = require('../logger');
const videoActivity = require('./download/videoActivity');
const titleShowQueries = require('./tvShows/titleShowQueries');

const WATCH_URL_PREFIX = 'https://www.youtube.com/watch?v=';

// "Download all videos for a channel" (one tab at a time). Assumes the caller
// already ran the fetch-all ("Load More") flow, so channelvideos is complete.
class ChannelDownloadAllModule {
  /**
   * @param {string} channelId
   * @param {string} tabType
   * @param {Object|null} [channel] - channels row; with tv_show_only_downloads only title show
   *   episodes are downloadable (while the channel has a title show)
   */
  async getDownloadableVideos(channelId, tabType, channel = null) {
    const mediaType = MEDIA_TAB_TYPE_MAP[tabType] || 'video';

    const rows = await ChannelVideo.findAll({
      where: {
        channel_id: channelId,
        media_type: mediaType,
        ignored: false,
        youtube_removed: false,
      },
      attributes: ['youtube_id', 'duration', 'availability', 'live_status'],
    });

    // Mirror the yt-dlp manual-download match filter
    // (availability!=subscriber_only & !is_live & live_status!=is_upcoming)
    // so the preview count matches what yt-dlp will accept.
    const candidates = rows.filter(
      (row) =>
        row.availability !== 'subscriber_only' &&
        row.live_status !== 'is_live' &&
        row.live_status !== 'is_upcoming'
    );

    if (candidates.length === 0) {
      return [];
    }

    const existing = await Video.findAll({
      where: { youtubeId: candidates.map((row) => row.youtube_id) },
      attributes: ['youtubeId', 'removed'],
    });
    // Anything ever downloaded is excluded, even deleted rows (removed: true):
    // those stay in the yt-dlp archive, so yt-dlp would skip them and the
    // preview count would overstate.
    const downloaded = new Set(existing.map((video) => video.youtubeId));

    const downloadable = candidates
      .filter((row) => !downloaded.has(row.youtube_id) && !videoActivity.isActive(row.youtube_id));
    const episodes = channel && channel.tv_show_only_downloads
      ? await titleShowQueries.showEpisodeIds(channelId, downloadable.map((row) => row.youtube_id))
      : null;
    return downloadable
      .filter((row) => !episodes || episodes.has(row.youtube_id))
      .map((row) => ({ youtube_id: row.youtube_id, duration: row.duration }));
  }

  async getPreview(channelId, tabType) {
    const channel = await this.findChannelOrThrow(channelId);
    const videos = await this.getDownloadableVideos(channelId, tabType, channel);

    let totalDurationSeconds = 0;
    let missingDurations = 0;
    for (const video of videos) {
      if (video.duration == null) {
        missingDurations += 1;
      } else {
        totalDurationSeconds += video.duration;
      }
    }

    return { count: videos.length, totalDurationSeconds, missingDurations };
  }

  async startDownloadAll(channelId, tabType, overrideSettings = {}) {
    const channel = await this.findChannelOrThrow(channelId);
    const videos = await this.getDownloadableVideos(channelId, tabType, channel);

    if (videos.length === 0) {
      return { queued: 0 };
    }

    // The selection already excludes downloaded videos, so allowRedownload is dropped.
    const settings = { ...overrideSettings };
    delete settings.allowRedownload;

    const urls = videos.map((video) => `${WATCH_URL_PREFIX}${video.youtube_id}`);
    const admission = await downloadModule.doSpecificDownloads({
      body: {
        urls,
        overrideSettings: settings,
        channelId,
        jobLabel: channelDownloadAllJobLabel(channel),
      },
    });

    logger.info(
      { channelId, tabType, count: urls.length },
      'Queued channel download-all job'
    );

    return { queued: admission.queued };
  }

  async findChannelOrThrow(channelId) {
    const channel = await Channel.findOne({ where: { channel_id: channelId } });
    if (!channel) {
      throw new Error('CHANNEL_NOT_FOUND');
    }
    return channel;
  }
}

module.exports = new ChannelDownloadAllModule();
