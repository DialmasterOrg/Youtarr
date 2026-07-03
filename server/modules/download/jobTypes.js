// Job-type labels and detection for the download pipeline, keyed off the
// job-type string. Two families:
//   1. Channel downloads - yt-dlp walks a channel/tab playlist; video count is
//      discovered from yt-dlp output as it runs.
//   2. Specific URL-list downloads - a fixed list of video URLs, covering
//      manually-added URLs (including the "(via API: ...)" variant) and playlist
//      downloads. Video count is known upfront.
// Several pipeline stages (progress seeding, per-item counting, processed-URL
// derivation, completion gating) treat both URL-list kinds identically. Use the
// helpers below rather than bare string comparisons so every label is covered.

const MANUAL_DOWNLOAD_LABEL = 'Manually Added Urls';
const CHANNEL_DOWNLOAD_LABEL = 'Channel Downloads';
// Playlist jobs are labelled `Playlist: <title>` so they are distinguishable in
// the activity view. The title is dynamic, so detection matches on the prefix.
const PLAYLIST_DOWNLOAD_LABEL_PREFIX = 'Playlist: ';
// "Download all videos for a channel" jobs. Must NOT contain
// CHANNEL_DOWNLOAD_LABEL: isDownloadJob and the /triggerchanneldownloads
// already-running guard match that substring, and a download-all job is a
// URL-list job, not a channel/tab sweep.
const CHANNEL_DOWNLOAD_ALL_LABEL_PREFIX = 'Channel Download All: ';
// Auto-retry jobs enqueued after transient-403 failures. Always a URL-list
// job. Like the download-all label, must NOT contain CHANNEL_DOWNLOAD_LABEL
// even when retrying channel-sweep failures.
const AUTO_RETRY_LABEL_PREFIX = 'Auto-retry: ';

// True for a fixed-URL-list download (manual, playlist, or channel
// download-all), as opposed to a channel/tab download.
function isSpecificUrlDownloadJob(jobType) {
  if (!jobType) return false;
  return (
    jobType.includes(MANUAL_DOWNLOAD_LABEL) ||
    jobType.startsWith(PLAYLIST_DOWNLOAD_LABEL_PREFIX) ||
    jobType.startsWith(CHANNEL_DOWNLOAD_ALL_LABEL_PREFIX) ||
    jobType.startsWith(AUTO_RETRY_LABEL_PREFIX)
  );
}

// True for any download job (channel, manual, or playlist). Gates
// download-specific completion handling against non-download jobs like
// Import Subscriptions.
function isDownloadJob(jobType) {
  if (!jobType) return false;
  return jobType.includes(CHANNEL_DOWNLOAD_LABEL) || isSpecificUrlDownloadJob(jobType);
}

// Build the activity-view job label for a playlist download.
function playlistJobLabel(playlist) {
  return `${PLAYLIST_DOWNLOAD_LABEL_PREFIX}${playlist.title || playlist.playlist_id}`;
}

// Build the activity-view job label for a channel download-all job.
function channelDownloadAllJobLabel(channel) {
  return `${CHANNEL_DOWNLOAD_ALL_LABEL_PREFIX}${channel.title || channel.channel_id}`;
}

// Build the activity-view job label for a transient-403 auto-retry job.
function autoRetryJobLabel(videoCount) {
  return `${AUTO_RETRY_LABEL_PREFIX}${videoCount} video${videoCount !== 1 ? 's' : ''} (HTTP 403)`;
}

// True for a channel download-all job. These jobs are exempt from the
// absolute runtime cap (large channels legitimately take days).
function isChannelDownloadAllJob(jobType) {
  if (!jobType) return false;
  return jobType.startsWith(CHANNEL_DOWNLOAD_ALL_LABEL_PREFIX);
}

module.exports = {
  MANUAL_DOWNLOAD_LABEL,
  CHANNEL_DOWNLOAD_LABEL,
  PLAYLIST_DOWNLOAD_LABEL_PREFIX,
  CHANNEL_DOWNLOAD_ALL_LABEL_PREFIX,
  AUTO_RETRY_LABEL_PREFIX,
  isSpecificUrlDownloadJob,
  isDownloadJob,
  playlistJobLabel,
  channelDownloadAllJobLabel,
  autoRetryJobLabel,
  isChannelDownloadAllJob,
};
