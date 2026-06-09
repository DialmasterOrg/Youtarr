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

// True for a fixed-URL-list download (manual or playlist), as opposed to a
// channel/tab download.
function isSpecificUrlDownloadJob(jobType) {
  if (!jobType) return false;
  return jobType.includes(MANUAL_DOWNLOAD_LABEL) || jobType.startsWith(PLAYLIST_DOWNLOAD_LABEL_PREFIX);
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

module.exports = {
  MANUAL_DOWNLOAD_LABEL,
  CHANNEL_DOWNLOAD_LABEL,
  PLAYLIST_DOWNLOAD_LABEL_PREFIX,
  isSpecificUrlDownloadJob,
  isDownloadJob,
  playlistJobLabel,
};
