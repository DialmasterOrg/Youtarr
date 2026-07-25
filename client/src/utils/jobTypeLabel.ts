// Maps backend job-type strings to display labels. The canonical constants
// live in server/modules/download/jobTypes.js and the run labels in
// server/modules/download/downloadRunTracker.js; this is the client-side
// mirror used by the activity header, queued-job chips, and job summaries.

const AUTO_RETRY_PREFIX = 'Auto-retry: ';
const CHANNEL_DOWNLOAD_ALL_PREFIX = 'Channel Download All: ';
const PLAYLIST_DOWNLOAD_PREFIX = 'Playlist: ';
const CHANNEL_DOWNLOAD_LABEL = 'Channel Downloads';
const MANUAL_DOWNLOAD_LABEL = 'Manually Added Urls';
// Synthetic already-Complete marker for an idle playlist auto-download sweep;
// also matches the run tracker's 'Playlist downloads' label case-insensitively.
const PLAYLIST_SWEEP_LABEL = 'Playlist Downloads';
const API_KEY_PATTERN = /\(via API: (.+)\)/;

export function jobTypeLabel(jobType: string | null | undefined): string {
  if (!jobType) {
    return '';
  }
  if (jobType.startsWith(AUTO_RETRY_PREFIX)) {
    return `Automatic retry: ${jobType.slice(AUTO_RETRY_PREFIX.length)}`;
  }
  if (jobType.startsWith(CHANNEL_DOWNLOAD_ALL_PREFIX)) {
    return `Full channel download: ${jobType.slice(CHANNEL_DOWNLOAD_ALL_PREFIX.length)}`;
  }
  if (jobType.startsWith(PLAYLIST_DOWNLOAD_PREFIX)) {
    return `Playlist download: ${jobType.slice(PLAYLIST_DOWNLOAD_PREFIX.length)}`;
  }
  if (jobType.toLowerCase() === PLAYLIST_SWEEP_LABEL.toLowerCase()) {
    return 'Playlist downloads';
  }
  if (jobType.includes(CHANNEL_DOWNLOAD_LABEL)) {
    return 'Channel update';
  }
  if (jobType.includes(MANUAL_DOWNLOAD_LABEL)) {
    const apiKeyMatch = jobType.match(API_KEY_PATTERN);
    return apiKeyMatch ? `API: ${apiKeyMatch[1]}` : 'Manual download';
  }
  return jobType;
}
