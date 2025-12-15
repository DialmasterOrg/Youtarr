/**
 * Discord Markdown notification formatter
 * Formats messages using Discord-compatible markdown for Apprise
 */

const { formatDuration, buildTitle, getSubtitle } = require('../utils');

/**
 * Format download notification as Discord markdown
 * @param {Object} finalSummary - Summary object from downloadExecutor
 * @param {Array} videoData - Array of video metadata objects
 * @returns {Object} { title, body } for Apprise
 */
function formatDownloadMessage(finalSummary, videoData) {
  const { totalDownloaded, jobType } = finalSummary;

  const title = buildTitle(totalDownloaded);
  let body = `**${getSubtitle(jobType)}**\n\n`;

  // Add video list
  if (videoData && videoData.length > 0) {
    const videosToShow = videoData.slice(0, 10);

    videosToShow.forEach((video, index) => {
      const channelName = video.youTubeChannelName || 'Unknown Channel';
      const videoTitle = video.youTubeVideoName || 'Unknown Title';
      const duration = formatDuration(video.duration);

      // Truncate title if too long
      const truncatedTitle = videoTitle.length > 80 ? `${videoTitle.substring(0, 77)}...` : videoTitle;

      body += `📺 **${channelName}**\n`;
      body += `${truncatedTitle}\n`;
      body += `⏱️ ${duration}\n`;
      
      if (index < videosToShow.length - 1) {
        body += '\n';
      }
    });

    if (videoData.length > 10) {
      body += `\n...and ${videoData.length - 10} more videos`;
    }
  }

  return { title, body };
}

/**
 * Format test notification as Discord markdown
 * @param {string} name - Name of the webhook being tested
 * @returns {Object} { title, body } for Apprise
 */
function formatTestMessage(name) {
  const title = '✅ Test Notification';
  const body = `Testing webhook: **${name}**

Your Youtarr notifications are working correctly!

📺 **Example Channel**
Example Video Title
⏱️ 10:30`;

  return { title, body };
}

module.exports = {
  formatDownloadMessage,
  formatTestMessage
};

