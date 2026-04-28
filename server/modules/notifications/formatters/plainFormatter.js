/**
 * Plain text notification formatter
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

/**
 * Format download notification as plain text
 * @param {Object} finalSummary - Summary object from downloadExecutor
 * @param {Array} videoData - Array of video metadata objects
 * @returns {Object} Object with title and body strings
 */
function formatDownloadMessage(finalSummary, videoData) {
  const { totalDownloaded, jobType } = finalSummary;
  const failedCount = getFailedCount(finalSummary);

  const title = buildTitle(totalDownloaded);
  let body = `${getSubtitle(jobType)}:\n`;

  if (failedCount > 0) {
    body += `\n⚠️ ${buildFailedCountLabel(failedCount)}.\n`;
    const failedVideosToShow = (finalSummary.failedVideos || []).slice(0, 5);
    failedVideosToShow.forEach(failedVideo => {
      body += `• ${formatFailedVideoLine(failedVideo)}\n`;
    });
    if (failedCount > failedVideosToShow.length) {
      body += `...and ${failedCount - failedVideosToShow.length} more failed\n`;
    }
    body += '\n';
  }

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

/**
 * Format auto-removal notification as plain text
 * @param {Object} cleanupResult - Result object from performAutomaticCleanup()
 * @returns {Object} Object with title and body strings
 */
function formatAutoRemovalMessage(cleanupResult) {
  const { totalDeleted, deletedByAge, deletedBySpace, freedBytes, plan = {} } = cleanupResult;
  const ageStrategy = plan.ageStrategy || {};
  const spaceStrategy = plan.spaceStrategy || {};

  const title = buildAutoRemovalTitle(totalDeleted);
  let body = `Freed ${formatBytes(freedBytes)} of storage\n`;

  if (deletedByAge > 0) {
    const threshold = ageStrategy.thresholdDays;
    body += `\nRemoved by age (exceeded ${threshold}-day limit): ${deletedByAge} ${deletedByAge === 1 ? 'video' : 'videos'}`;

    const { groups, truncatedCount } = groupVideosByChannel(ageStrategy.sampleVideos, 5, deletedByAge);
    for (const group of groups) {
      const videoLabel = group.count === 1 ? '1 video' : `${group.count} videos`;
      body += `\n  ${group.channel} (${videoLabel}): ${group.titles.join(', ')}`;
    }
    if (truncatedCount > 0) {
      body += `\n  ...and ${truncatedCount} more videos`;
    }
  }

  if (deletedBySpace > 0) {
    const threshold = spaceStrategy.threshold;
    body += `\nRemoved for storage (below ${threshold} threshold): ${deletedBySpace} ${deletedBySpace === 1 ? 'video' : 'videos'}`;

    const { groups, truncatedCount } = groupVideosByChannel(spaceStrategy.sampleVideos, 5, deletedBySpace);
    for (const group of groups) {
      const videoLabel = group.count === 1 ? '1 video' : `${group.count} videos`;
      body += `\n  ${group.channel} (${videoLabel}): ${group.titles.join(', ')}`;
    }
    if (truncatedCount > 0) {
      body += `\n  ...and ${truncatedCount} more videos`;
    }
  }

  return { title, body };
}

module.exports = {
  formatDownloadMessage,
  formatTestMessage,
  formatAutoRemovalMessage
};
