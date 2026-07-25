/**
 * Telegram HTML notification formatter
 */

const {
  escapeHtml,
  formatDuration,
  buildTitle,
  getFailedCount,
  buildFailedCountLabel,
  formatFailedVideoLine,
  getSubtitle,
  buildAutoRemovalTitle,
  formatBytes,
  groupVideosByChannel,
  getTerminatedCount,
  buildTerminatedCountLabel,
  formatTerminatedChannelLine,
  getTerminationFailureCount,
  buildTerminationFailureCountLabel,
  formatTerminationFailureLine,
  getDiagnoses,
  formatDiagnosisLine
} = require('../utils');

/**
 * Format download notification as Telegram HTML message
 * @param {Object} finalSummary - Summary object from downloadExecutor
 * @param {Array} videoData - Array of video metadata objects
 * @returns {Object} Object with title and HTML body strings
 */
function formatDownloadMessage(finalSummary, videoData) {
  const { totalDownloaded, jobType } = finalSummary;
  const failedCount = getFailedCount(finalSummary);
  const terminatedCount = getTerminatedCount(finalSummary);
  const terminationFailureCount = getTerminationFailureCount(finalSummary);

  const title = buildTitle(totalDownloaded, terminatedCount, terminationFailureCount);
  let body = `<b>${getSubtitle(jobType)}:</b>\n\n`;

  if (terminatedCount > 0) {
    body += `⚠️ <b>${escapeHtml(buildTerminatedCountLabel(terminatedCount))}.</b>\n`;
    const terminatedChannelsToShow = (finalSummary.terminatedChannels || []).slice(0, 5);
    terminatedChannelsToShow.forEach(channel => {
      body += `• ${escapeHtml(formatTerminatedChannelLine(channel))}\n`;
    });
    if (terminatedCount > terminatedChannelsToShow.length) {
      body += `<i>...and ${terminatedCount - terminatedChannelsToShow.length} more</i>\n`;
    }
    body += '\n';
  }

  if (terminationFailureCount > 0) {
    body += `⚠️ <b>${escapeHtml(buildTerminationFailureCountLabel(terminationFailureCount))}.</b>\n`;
    const failuresToShow = (finalSummary.terminationFailures || []).slice(0, 5);
    failuresToShow.forEach(channelId => {
      body += `• ${escapeHtml(formatTerminationFailureLine(channelId))}\n`;
    });
    if (terminationFailureCount > failuresToShow.length) {
      body += `<i>...and ${terminationFailureCount - failuresToShow.length} more</i>\n`;
    }
    body += '\n';
  }

  if (failedCount > 0) {
    body += `⚠️ <b>${escapeHtml(buildFailedCountLabel(failedCount))}.</b>\n`;
    const failedVideosToShow = (finalSummary.failedVideos || []).slice(0, 5);
    failedVideosToShow.forEach(failedVideo => {
      body += `• ${escapeHtml(formatFailedVideoLine(failedVideo))}\n`;
    });
    if (failedCount > failedVideosToShow.length) {
      body += `<i>...and ${failedCount - failedVideosToShow.length} more failed</i>\n`;
    }
    getDiagnoses(finalSummary).forEach(diagnosis => {
      body += `💡 <i>${escapeHtml(formatDiagnosisLine(diagnosis))}</i>\n`;
    });
    body += '\n';
  }

  if (videoData && videoData.length > 0) {
    const videosToShow = videoData.slice(0, 10);

    videosToShow.forEach(video => {
      const channelName = escapeHtml(video.youTubeChannelName || 'Unknown Channel');
      const videoTitle = escapeHtml(video.youTubeVideoName || 'Unknown Title');
      const duration = formatDuration(video.duration);

      body += `📺 <b>${channelName}</b>\n`;
      body += `${videoTitle}\n`;
      body += `<i>⏱️ ${duration}</i>\n\n`;
    });

    if (videoData.length > 10) {
      body += `<i>...and ${videoData.length - 10} more videos</i>\n`;
    }
  }

  body += '\n<i>— Youtarr</i>';

  return { title, body };
}

/**
 * Format test notification as Telegram HTML message
 * @param {string} name - Name of the webhook being tested
 * @returns {Object} Object with title and HTML body strings
 */
function formatTestMessage(name) {
  return {
    title: '✅ Test Notification',
    body: `<b>Testing: ${escapeHtml(name)}</b>\n\nYour Youtarr notifications are working correctly!\n\n📺 <b>Example Video</b>\nChannel Name - Video Title\n<i>⏱️ 10:30</i>\n\n<i>— Youtarr</i>`
  };
}

/**
 * Format auto-removal notification as Telegram HTML
 * @param {Object} cleanupResult - Result object from performAutomaticCleanup()
 * @returns {Object} Object with title and HTML body strings
 */
function formatAutoRemovalMessage(cleanupResult) {
  const { totalDeleted, deletedByAge, deletedByWatched = 0, deletedBySpace, freedBytes, plan = {} } = cleanupResult;
  const ageStrategy = plan.ageStrategy || {};
  const watchedStrategy = plan.watchedStrategy || {};
  const spaceStrategy = plan.spaceStrategy || {};

  const title = buildAutoRemovalTitle(totalDeleted);
  let body = `Freed <b>${formatBytes(freedBytes)}</b> of storage\n`;

  if (deletedByAge > 0) {
    const threshold = escapeHtml(String(ageStrategy.thresholdDays));
    body += `\n<b>Removed by age (exceeded ${threshold}-day limit): ${deletedByAge} ${deletedByAge === 1 ? 'video' : 'videos'}</b>\n`;

    const { groups, truncatedCount } = groupVideosByChannel(ageStrategy.sampleVideos, 5, deletedByAge);
    for (const group of groups) {
      const videoLabel = group.count === 1 ? '1 video' : `${group.count} videos`;
      body += `📺 <b>${escapeHtml(group.channel)}</b> (${videoLabel}): ${group.titles.map(t => escapeHtml(t)).join(', ')}\n`;
    }
    if (truncatedCount > 0) {
      body += `<i>...and ${truncatedCount} more videos</i>\n`;
    }
  }

  if (deletedByWatched > 0) {
    body += `\n<b>Removed after being watched: ${deletedByWatched} ${deletedByWatched === 1 ? 'video' : 'videos'}</b>\n`;

    const { groups, truncatedCount } = groupVideosByChannel(watchedStrategy.sampleVideos, 5, deletedByWatched);
    for (const group of groups) {
      const videoLabel = group.count === 1 ? '1 video' : `${group.count} videos`;
      body += `📺 <b>${escapeHtml(group.channel)}</b> (${videoLabel}): ${group.titles.map(t => escapeHtml(t)).join(', ')}\n`;
    }
    if (truncatedCount > 0) {
      body += `<i>...and ${truncatedCount} more videos</i>\n`;
    }
  }

  if (deletedBySpace > 0) {
    const threshold = escapeHtml(String(spaceStrategy.threshold));
    body += `\n<b>Removed for storage (below ${threshold} threshold): ${deletedBySpace} ${deletedBySpace === 1 ? 'video' : 'videos'}</b>\n`;

    const { groups, truncatedCount } = groupVideosByChannel(spaceStrategy.sampleVideos, 5, deletedBySpace);
    for (const group of groups) {
      const videoLabel = group.count === 1 ? '1 video' : `${group.count} videos`;
      body += `📺 <b>${escapeHtml(group.channel)}</b> (${videoLabel}): ${group.titles.map(t => escapeHtml(t)).join(', ')}\n`;
    }
    if (truncatedCount > 0) {
      body += `<i>...and ${truncatedCount} more videos</i>\n`;
    }
  }

  body += '\n<i>— Youtarr</i>';

  return { title, body };
}

module.exports = {
  formatDownloadMessage,
  formatTestMessage,
  formatAutoRemovalMessage
};
