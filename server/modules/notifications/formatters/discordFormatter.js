/**
 * Discord embed notification formatter
 */

const { formatDuration, buildTitle, getSubtitle } = require('../utils');

/**
 * Format download notification as Discord embed
 * @param {Object} finalSummary - Summary object from downloadExecutor
 * @param {Array} videoData - Array of video metadata objects
 * @returns {Object} Discord webhook message payload with embeds
 */
function formatDownloadMessage(finalSummary, videoData) {
  const { totalDownloaded, jobType } = finalSummary;

  const title = buildTitle(totalDownloaded);
  let description = `**${getSubtitle(jobType)}:**\n`;

  // Build fields for each video (up to 10)
  const fields = [];
  if (videoData && videoData.length > 0) {
    const videosToShow = videoData.slice(0, 10);

    videosToShow.forEach(video => {
      const channelName = video.youTubeChannelName || 'Unknown Channel';
      const videoTitle = video.youTubeVideoName || 'Unknown Title';
      const duration = formatDuration(video.duration);

      // Truncate title if too long
      const truncatedTitle = videoTitle.length > 100 ? `${videoTitle.substring(0, 97)}...` : videoTitle;

      fields.push({
        name: `📺 ${channelName}`,
        value: `${truncatedTitle}\n⏱️ ${duration}`,
        inline: true
      });
    });

    if (videoData.length > 10) {
      description += `\n...and ${videoData.length - 10} more videos`;
    }
  }

  return {
    embeds: [{
      title,
      description,
      color: 0x00ff00, // Green for success
      fields: fields.length > 0 ? fields : undefined,
      timestamp: new Date().toISOString(),
      footer: {
        text: 'Youtarr'
      }
    }]
  };
}

/**
 * Format test notification as Discord embed
 * @param {string} name - Name of the webhook being tested
 * @returns {Object} Discord webhook message payload with embeds
 */
function formatTestMessage(name) {
  return {
    embeds: [{
      title: '✅ Test Notification',
      description: `Testing webhook: **${name}**\n\nYour Youtarr notifications are working correctly!`,
      color: 0x00ff00,
      timestamp: new Date().toISOString(),
      footer: {
        text: 'Youtarr Notifications'
      },
      fields: [
        {
          name: '📺 Example Video',
          value: 'Channel Name - Video Title - 10:30',
          inline: false
        }
      ]
    }]
  };
}

/**
 * Format plain text message for Discord (no embeds)
 * @param {string} title - Message title
 * @param {string} body - Message body
 * @returns {Object} Discord webhook message payload
 */
function formatPlainMessage(title, body) {
  return {
    content: `**${title}**\n\n${body}`
  };
}

module.exports = {
  formatDownloadMessage,
  formatTestMessage,
  formatPlainMessage
};

