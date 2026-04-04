/**
 * Slack Markdown notification formatter
 * Formats messages using Slack-compatible markdown (mrkdwn) for Apprise
 * Note: Slack uses *bold*, _italic_, ~strike~, `code`
 */

const { formatDuration, buildTitle, getSubtitle, buildAutoRemovalTitle, formatBytes, groupVideosByChannel } = require('../utils');

/**
 * Format download notification as Slack markdown
 * @param {Object} finalSummary - Summary object from downloadExecutor
 * @param {Array} videoData - Array of video metadata objects
 * @returns {Object} { title, body } for Apprise
 */
function formatDownloadMessage(finalSummary, videoData) {
  const { totalDownloaded, jobType } = finalSummary;

  const title = buildTitle(totalDownloaded);
  let body = `*${getSubtitle(jobType)}*\n\n`;

  // Add video list
  if (videoData && videoData.length > 0) {
    const videosToShow = videoData.slice(0, 10);

    videosToShow.forEach((video, index) => {
      const channelName = video.youTubeChannelName || 'Unknown Channel';
      const videoTitle = video.youTubeVideoName || 'Unknown Title';
      const duration = formatDuration(video.duration);

      // Truncate title if too long
      const truncatedTitle = videoTitle.length > 80 ? `${videoTitle.substring(0, 77)}...` : videoTitle;

      body += `📺 *${channelName}*\n`;
      body += `${truncatedTitle}\n`;
      body += `⏱️ ${duration}\n`;

      if (index < videosToShow.length - 1) {
        body += '\n';
      }
    });

    if (videoData.length > 10) {
      body += `\n_...and ${videoData.length - 10} more videos_`;
    }
  }

  return { title, body };
}

/**
 * Format test notification as Slack markdown
 * @param {string} name - Name of the webhook being tested
 * @returns {Object} { title, body } for Apprise
 */
function formatTestMessage(name) {
  const title = '✅ Test Notification';
  const body = `Testing webhook: *${name}*

Your Youtarr notifications are working correctly!

📺 *Example Channel*
Example Video Title
⏱️ 10:30`;

  return { title, body };
}

/**
 * Format auto-removal notification as Slack markdown
 * @param {Object} cleanupResult - Result object from performAutomaticCleanup()
 * @returns {Object} { title, body } for Apprise
 */
function formatAutoRemovalMessage(cleanupResult) {
  const { totalDeleted, deletedByAge, deletedBySpace, freedBytes, plan = {} } = cleanupResult;
  const ageStrategy = plan.ageStrategy || {};
  const spaceStrategy = plan.spaceStrategy || {};

  const title = buildAutoRemovalTitle(totalDeleted);
  let body = `Freed *${formatBytes(freedBytes)}* of storage\n`;

  if (deletedByAge > 0) {
    const threshold = ageStrategy.thresholdDays;
    body += `\n*Removed by age (exceeded ${threshold}-day limit): ${deletedByAge} ${deletedByAge === 1 ? 'video' : 'videos'}*\n`;

    const grouped = groupVideosByChannel(ageStrategy.sampleVideos);
    for (const group of grouped) {
      const videoLabel = group.count === 1 ? '1 video' : `${group.count} videos`;
      body += `📺 *${group.channel}* (${videoLabel}): ${group.titles.join(', ')}\n`;
    }
  }

  if (deletedBySpace > 0) {
    const threshold = spaceStrategy.threshold;
    body += `\n*Removed for storage (below ${threshold} threshold): ${deletedBySpace} ${deletedBySpace === 1 ? 'video' : 'videos'}*\n`;

    const grouped = groupVideosByChannel(spaceStrategy.sampleVideos);
    for (const group of grouped) {
      const videoLabel = group.count === 1 ? '1 video' : `${group.count} videos`;
      body += `📺 *${group.channel}* (${videoLabel}): ${group.titles.join(', ')}\n`;
    }
  }

  return { title, body };
}

module.exports = {
  formatDownloadMessage,
  formatTestMessage,
  formatAutoRemovalMessage
};

