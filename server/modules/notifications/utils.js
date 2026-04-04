/**
 * Shared utilities for notification formatting
 */

/**
 * Escape HTML special characters
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Format duration from seconds to human readable format (HH:MM:SS or MM:SS)
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration
 */
function formatDuration(seconds) {
  if (!seconds || seconds === 0) return '0:00';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Build notification title based on download count
 * @param {number} totalDownloaded - Number of videos downloaded
 * @returns {string} Title string
 */
function buildTitle(totalDownloaded) {
  if (totalDownloaded === 1) {
    return '🎬 New Video Downloaded';
  }
  return `🎬 ${totalDownloaded} New Videos Downloaded`;
}

/**
 * Get subtitle based on job type
 * @param {string} jobType - The job type string
 * @returns {string} Subtitle string
 */
function getSubtitle(jobType) {
  const isChannelDownload = jobType.includes('Channel Downloads');
  return isChannelDownload ? 'Channel Video Downloads' : 'Manually Selected Downloads';
}

/**
 * Build notification title for auto-removal events
 * @param {number} totalDeleted - Number of videos removed
 * @returns {string} Title string
 */
function buildAutoRemovalTitle(totalDeleted) {
  if (totalDeleted === 1) {
    return '🗑️ 1 Video Auto-Removed';
  }
  return `🗑️ ${totalDeleted} Videos Auto-Removed`;
}

/**
 * Format byte count as human-readable string (e.g. "12.50 GB")
 * @param {number} bytes - Number of bytes
 * @returns {string} Formatted string
 */
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';

  const gb = bytes / (1024 ** 3);
  if (gb >= 1) {
    return `${gb.toFixed(2)} GB`;
  }

  const mb = bytes / (1024 ** 2);
  if (mb >= 1) {
    return `${mb.toFixed(2)} MB`;
  }

  const kb = bytes / 1024;
  return `${kb.toFixed(2)} KB`;
}

/**
 * Group sample videos by channel name
 * @param {Array<{channel: string, title: string}>} sampleVideos - Video samples from cleanup result
 * @param {number} [maxVideos=5] - Maximum number of videos to include
 * @returns {Array<{channel: string, titles: string[], count: number}>} Grouped videos
 */
function groupVideosByChannel(sampleVideos, maxVideos = 5) {
  if (!sampleVideos || sampleVideos.length === 0) return [];

  const limited = sampleVideos.slice(0, maxVideos);
  const channelMap = new Map();

  for (const video of limited) {
    const channel = video.channel || 'Unknown Channel';
    if (!channelMap.has(channel)) {
      channelMap.set(channel, []);
    }
    channelMap.get(channel).push(video.title || 'Unknown Title');
  }

  return Array.from(channelMap.entries()).map(([channel, titles]) => ({
    channel,
    titles,
    count: titles.length
  }));
}

module.exports = {
  escapeHtml,
  formatDuration,
  buildTitle,
  getSubtitle,
  buildAutoRemovalTitle,
  formatBytes,
  groupVideosByChannel
};

