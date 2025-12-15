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

module.exports = {
  escapeHtml,
  formatDuration,
  buildTitle,
  getSubtitle
};

