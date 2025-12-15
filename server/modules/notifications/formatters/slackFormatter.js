/**
 * Slack Block Kit notification formatter
 */

const { formatDuration, buildTitle, getSubtitle } = require('../utils');

/**
 * Format download notification as Slack Block Kit message
 * @param {Object} finalSummary - Summary object from downloadExecutor
 * @param {Array} videoData - Array of video metadata objects
 * @returns {Object} Slack webhook message payload with blocks
 */
function formatDownloadMessage(finalSummary, videoData) {
  const { totalDownloaded, jobType } = finalSummary;

  const title = buildTitle(totalDownloaded);

  const blocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: title,
        emoji: true
      }
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${getSubtitle(jobType)}:*`
      }
    }
  ];

  // Add video details
  if (videoData && videoData.length > 0) {
    const videosToShow = videoData.slice(0, 10);

    videosToShow.forEach(video => {
      const channelName = video.youTubeChannelName || 'Unknown Channel';
      const videoTitle = video.youTubeVideoName || 'Unknown Title';
      const duration = formatDuration(video.duration);

      const truncatedTitle = videoTitle.length > 80 ? `${videoTitle.substring(0, 77)}...` : videoTitle;

      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${channelName}*\n${truncatedTitle} • ${duration}`
        }
      });
    });

    if (videoData.length > 10) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `_...and ${videoData.length - 10} more videos_`
        }
      });
    }
  }

  // Add footer
  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `Youtarr • ${new Date().toLocaleString()}`
      }
    ]
  });

  return { blocks };
}

/**
 * Format test notification as Slack Block Kit message
 * @param {string} name - Name of the webhook being tested
 * @returns {Object} Slack webhook message payload with blocks
 */
function formatTestMessage(name) {
  return {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '✅ Test Notification',
          emoji: true
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `Testing webhook: *${name}*\n\nYour Youtarr notifications are working correctly!`
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: '*📺 Example Video*\nChannel Name - Video Title - 10:30'
          }
        ]
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Youtarr Notifications • ${new Date().toLocaleString()}`
          }
        ]
      }
    ]
  };
}

module.exports = {
  formatDownloadMessage,
  formatTestMessage
};

