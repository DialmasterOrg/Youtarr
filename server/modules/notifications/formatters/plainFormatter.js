/**
 * Plain text notification formatter
 */

const { formatDuration, buildTitle, getSubtitle } = require('../utils');

/**
 * Format download notification as plain text
 * @param {Object} finalSummary - Summary object from downloadExecutor
 * @param {Array} videoData - Array of video metadata objects
 * @returns {Object} Object with title and body strings
 */
function formatDownloadMessage(finalSummary, videoData) {
  const { totalDownloaded, jobType } = finalSummary;

  const title = buildTitle(totalDownloaded);
  let body = `${getSubtitle(jobType)}:\n`;

  if (videoData && videoData.length > 0) {
    const videosToShow = videoData.slice(0, 10);

    videosToShow.forEach(video => {
      const channelName = video.youTubeChannelName || 'Unknown Channel';
      const videoTitle = video.youTubeVideoName || 'Unknown Title';
      const duration = formatDuration(video.duration);

      const fullLine = `${channelName} - ${videoTitle} - ${duration}`;
      const truncatedLine = fullLine.length > 150 ? `${fullLine.substring(0, 147)}...` : fullLine;
      body += `• ${truncatedLine}\n`;
    });

    if (videoData.length > 10) {
      body += `\n...and ${videoData.length - 10} more`;
    }
  }

  return { title, body };
}

/**
 * Format test notification as plain text
 * @param {string} name - Name of the webhook being tested
 * @returns {Object} Object with title and body strings
 */
function formatTestMessage(name) {
  return {
    title: '✅ Test Notification',
    body: `Testing: ${name}\n\nYour Youtarr notifications are working correctly!\n\n📺 Example Video\nChannel Name - Video Title - 10:30`
  };
}

module.exports = {
  formatDownloadMessage,
  formatTestMessage
};

