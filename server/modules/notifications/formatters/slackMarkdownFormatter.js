/**
 * Slack Markdown notification formatter
 * Formats messages using Slack-compatible markdown (mrkdwn) for Apprise
 * Note: Slack uses *bold*, _italic_, ~strike~, `code`
 */

const {
  buildVideoLink,
  formatDuration,
  buildTitle,
  getFailedCount,
  buildFailedCountLabel,
  formatFailedVideoLine,
  getSubtitle,
  buildAutoRemovalTitle,
  buildDownloadPauseContent,
  formatBytes,
  groupVideosByChannel,
  getTerminatedCount,
  buildTerminatedCountLabel,
  formatTerminatedChannelLine,
  getTerminationFailureCount,
  buildTerminationFailureCountLabel,
  formatTerminationFailureLine,
  getDiagnoses,
  formatDiagnosisLine,
  getStoppedLines
} = require('../utils');

// Slack link: [text](<url>). Apprise reads the body as Markdown and turns this
// form into Slack's <url|text>. Apprise 2.x also reads <url|text> as a bare
// link when the text has no space, so that form breaks one-word titles.
// A backslash keeps these characters literal in the text: \ < > [ ]
// A backtick cannot be escaped that way: CommonMark reads it as the start of a
// code span, which wins over a link and can pair with a backtick in a later
// title. A backslash would also show in Slack. So the label uses an apostrophe.
function buildSlackLink(text, url) {
  return `[${text.replace(/`/g, '\'').replace(/[\\<>[\]]/g, '\\$&')}](<${url}>)`;
}

/**
 * Format download notification as Slack markdown
 * @param {Object} finalSummary - Summary object from downloadExecutor
 * @param {Array} videoData - Array of video metadata objects
 * @param {Object} [options]
 * @param {string} [options.linkTemplate] - Link template that adds a link to each video
 * @returns {Object} { title, body } for Apprise
 */
function formatDownloadMessage(finalSummary, videoData, options = {}) {
  const { totalDownloaded, jobType } = finalSummary;
  const failedCount = getFailedCount(finalSummary);
  const terminatedCount = getTerminatedCount(finalSummary);
  const terminationFailureCount = getTerminationFailureCount(finalSummary);

  const title = buildTitle(totalDownloaded, terminatedCount, terminationFailureCount);
  let body = `*${getSubtitle(jobType)}*\n\n`;

  if (terminatedCount > 0) {
    body += `⚠️ *${buildTerminatedCountLabel(terminatedCount)}.*\n`;
    const terminatedChannelsToShow = (finalSummary.terminatedChannels || []).slice(0, 5);
    terminatedChannelsToShow.forEach(channel => {
      body += `• ${formatTerminatedChannelLine(channel)}\n`;
    });
    if (terminatedCount > terminatedChannelsToShow.length) {
      body += `_...and ${terminatedCount - terminatedChannelsToShow.length} more_\n`;
    }
    body += '\n';
  }

  if (terminationFailureCount > 0) {
    body += `⚠️ *${buildTerminationFailureCountLabel(terminationFailureCount)}.*\n`;
    const failuresToShow = (finalSummary.terminationFailures || []).slice(0, 5);
    failuresToShow.forEach(channelId => {
      body += `• ${formatTerminationFailureLine(channelId)}\n`;
    });
    if (terminationFailureCount > failuresToShow.length) {
      body += `_...and ${terminationFailureCount - failuresToShow.length} more_\n`;
    }
    body += '\n';
  }

  if (failedCount > 0) {
    body += `⚠️ *${buildFailedCountLabel(failedCount)}.*\n`;
    const failedVideosToShow = (finalSummary.failedVideos || []).slice(0, 5);
    failedVideosToShow.forEach(failedVideo => {
      body += `• ${formatFailedVideoLine(failedVideo)}\n`;
    });
    if (failedCount > failedVideosToShow.length) {
      body += `_...and ${failedCount - failedVideosToShow.length} more failed_\n`;
    }
    getDiagnoses(finalSummary).forEach(diagnosis => {
      body += `💡 _${formatDiagnosisLine(diagnosis)}_\n`;
    });
    body += '\n';
  }

  const stoppedLines = getStoppedLines(finalSummary);
  if (stoppedLines.length > 0) {
    stoppedLines.forEach(line => {
      body += `⚠️ *${line}*\n`;
    });
    body += '\n';
  }

  // Add video list
  if (videoData && videoData.length > 0) {
    const videosToShow = videoData.slice(0, 10);

    videosToShow.forEach((video, index) => {
      const channelName = video.youTubeChannelName || 'Unknown Channel';
      const videoTitle = video.youTubeVideoName || 'Unknown Title';
      const duration = formatDuration(video.duration);

      // Truncate title if too long
      const truncatedTitle = videoTitle.length > 80 ? `${videoTitle.substring(0, 77)}...` : videoTitle;

      const link = buildVideoLink(options.linkTemplate, video);

      body += `📺 *${channelName}*\n`;
      body += `${link ? buildSlackLink(truncatedTitle, link) : truncatedTitle}\n`;
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
  const { totalDeleted, deletedByAge, deletedByWatched = 0, deletedBySpace, deletedByUsage = 0, freedBytes, plan = {} } = cleanupResult;
  const ageStrategy = plan.ageStrategy || {};
  const watchedStrategy = plan.watchedStrategy || {};
  const spaceStrategy = plan.spaceStrategy || {};
  const usageStrategy = plan.usageStrategy || {};

  const title = buildAutoRemovalTitle(totalDeleted);
  let body = `Freed *${formatBytes(freedBytes)}* of storage\n`;

  if (deletedByAge > 0) {
    const threshold = ageStrategy.thresholdDays;
    body += `\n*Removed by age (exceeded ${threshold}-day limit): ${deletedByAge} ${deletedByAge === 1 ? 'video' : 'videos'}*\n`;

    const { groups, truncatedCount } = groupVideosByChannel(ageStrategy.sampleVideos, 5, deletedByAge);
    for (const group of groups) {
      const videoLabel = group.count === 1 ? '1 video' : `${group.count} videos`;
      body += `📺 *${group.channel}* (${videoLabel}): ${group.titles.join(', ')}\n`;
    }
    if (truncatedCount > 0) {
      body += `_...and ${truncatedCount} more videos_\n`;
    }
  }

  if (deletedByWatched > 0) {
    body += `\n*Removed after being watched: ${deletedByWatched} ${deletedByWatched === 1 ? 'video' : 'videos'}*\n`;

    const { groups, truncatedCount } = groupVideosByChannel(watchedStrategy.sampleVideos, 5, deletedByWatched);
    for (const group of groups) {
      const videoLabel = group.count === 1 ? '1 video' : `${group.count} videos`;
      body += `📺 *${group.channel}* (${videoLabel}): ${group.titles.join(', ')}\n`;
    }
    if (truncatedCount > 0) {
      body += `_...and ${truncatedCount} more videos_\n`;
    }
  }

  if (deletedBySpace > 0) {
    const threshold = spaceStrategy.threshold;
    body += `\n*Removed for storage (below ${threshold} threshold): ${deletedBySpace} ${deletedBySpace === 1 ? 'video' : 'videos'}*\n`;

    const { groups, truncatedCount } = groupVideosByChannel(spaceStrategy.sampleVideos, 5, deletedBySpace);
    for (const group of groups) {
      const videoLabel = group.count === 1 ? '1 video' : `${group.count} videos`;
      body += `📺 *${group.channel}* (${videoLabel}): ${group.titles.join(', ')}\n`;
    }
    if (truncatedCount > 0) {
      body += `_...and ${truncatedCount} more videos_\n`;
    }
  }

  if (deletedByUsage > 0) {
    const threshold = usageStrategy.limit;
    body += `\n*Removed to stay under the ${threshold} total size limit: ${deletedByUsage} ${deletedByUsage === 1 ? 'video' : 'videos'}*\n`;

    const { groups, truncatedCount } = groupVideosByChannel(usageStrategy.sampleVideos, 5, deletedByUsage);
    for (const group of groups) {
      const videoLabel = group.count === 1 ? '1 video' : `${group.count} videos`;
      body += `📺 *${group.channel}* (${videoLabel}): ${group.titles.join(', ')}\n`;
    }
    if (truncatedCount > 0) {
      body += `_...and ${truncatedCount} more videos_\n`;
    }
  }

  return { title, body };
}

/**
 * Format downloads paused/resumed notification as Slack markdown
 * @param {Object} status - storageGuard status
 * @returns {Object} { title, body } for Apprise
 */
function formatDownloadPauseMessage(status) {
  const { title, summary, reasons, footer } = buildDownloadPauseContent(status);
  let body = summary;
  if (reasons.length > 0) {
    body += `\n\n${reasons.map((reason) => `• *${reason}*`).join('\n')}`;
  }
  if (footer) {
    body += `\n\n_${footer}_`;
  }
  return { title, body };
}

module.exports = {
  formatDownloadMessage,
  formatTestMessage,
  formatAutoRemovalMessage,
  formatDownloadPauseMessage
};
