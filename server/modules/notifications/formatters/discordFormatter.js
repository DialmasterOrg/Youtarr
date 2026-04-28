/**
 * Discord embed notification formatter
 */

const {
  formatDuration,
  buildTitle,
  getFailedCount,
  buildFailedCountLabel,
  formatFailedVideoLine,
  getSubtitle,
  buildAutoRemovalTitle,
  formatBytes,
  groupVideosByChannel
} = require('../utils');

const DISCORD_FIELD_VALUE_LIMIT = 1024;

function truncateFieldValueAtLineBoundary(value, limit = DISCORD_FIELD_VALUE_LIMIT) {
  if (!value || value.length <= limit) {
    return value;
  }

  const truncated = value.substring(0, limit);
  const lastNewline = truncated.lastIndexOf('\n');
  return lastNewline > 0 ? truncated.substring(0, lastNewline) : truncated;
}

/**
 * Format download notification as Discord embed
 * @param {Object} finalSummary - Summary object from downloadExecutor
 * @param {Array} videoData - Array of video metadata objects
 * @returns {Object} Discord webhook message payload with embeds
 */
function formatDownloadMessage(finalSummary, videoData) {
  const { totalDownloaded, jobType } = finalSummary;
  const failedCount = getFailedCount(finalSummary);

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

  if (failedCount > 0) {
    description += `\n⚠️ **${buildFailedCountLabel(failedCount)}.**`;
    const failedVideosToShow = (finalSummary.failedVideos || []).slice(0, 5);
    const failedValue = failedVideosToShow.length > 0
      ? truncateFieldValueAtLineBoundary(failedVideosToShow.map(formatFailedVideoLine).join('\n'))
      : 'See Youtarr download history for details.';

    fields.push({
      name: '⚠️ Failed downloads',
      value: failedValue,
      inline: false
    });
  }

  return {
    embeds: [{
      title,
      description,
      color: failedCount > 0 ? 0xffa500 : 0x00ff00, // Orange for partial success, green for success
      fields,
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

/**
 * Format auto-removal notification as Discord embed
 * @param {Object} cleanupResult - Result object from performAutomaticCleanup()
 * @returns {Object} Discord webhook message payload with embeds
 */
function formatAutoRemovalMessage(cleanupResult) {
  const { totalDeleted, deletedByAge, deletedBySpace, freedBytes, plan = {} } = cleanupResult;
  const ageStrategy = plan.ageStrategy || {};
  const spaceStrategy = plan.spaceStrategy || {};

  const title = buildAutoRemovalTitle(totalDeleted);
  const description = `Freed **${formatBytes(freedBytes)}** of storage`;

  const fields = [];

  if (deletedByAge > 0) {
    const threshold = ageStrategy.thresholdDays;
    const { groups, truncatedCount } = groupVideosByChannel(ageStrategy.sampleVideos, 5, deletedByAge);
    let value = groups.map(group => {
      const videoLabel = group.count === 1 ? '1 video' : `${group.count} videos`;
      return `📺 **${group.channel}** (${videoLabel})\n${group.titles.join(', ')}`;
    }).join('\n\n');

    if (truncatedCount > 0) {
      value += `\n\n...and ${truncatedCount} more videos`;
    }

    if (!value) value = `${deletedByAge} ${deletedByAge === 1 ? 'video' : 'videos'}`;

    fields.push({
      name: `🕐 Removed by age (exceeded ${threshold}-day limit): ${deletedByAge}`,
      value,
      inline: false
    });
  }

  if (deletedBySpace > 0) {
    const threshold = spaceStrategy.threshold;
    const { groups, truncatedCount } = groupVideosByChannel(spaceStrategy.sampleVideos, 5, deletedBySpace);
    let value = groups.map(group => {
      const videoLabel = group.count === 1 ? '1 video' : `${group.count} videos`;
      return `📺 **${group.channel}** (${videoLabel})\n${group.titles.join(', ')}`;
    }).join('\n\n');

    if (truncatedCount > 0) {
      value += `\n\n...and ${truncatedCount} more videos`;
    }

    if (!value) value = `${deletedBySpace} ${deletedBySpace === 1 ? 'video' : 'videos'}`;

    fields.push({
      name: `💾 Removed for storage (below ${threshold} threshold): ${deletedBySpace}`,
      value,
      inline: false
    });
  }

  return {
    embeds: [{
      title,
      description,
      color: 0xFFA500, // Orange for auto-removal
      fields,
      timestamp: new Date().toISOString(),
      footer: {
        text: 'Youtarr'
      }
    }]
  };
}

module.exports = {
  formatDownloadMessage,
  formatTestMessage,
  formatPlainMessage,
  formatAutoRemovalMessage
};
