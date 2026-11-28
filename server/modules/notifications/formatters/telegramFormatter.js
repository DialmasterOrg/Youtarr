/**
 * Telegram HTML notification formatter
 */

const {
  escapeHtml,
  buildVideoLink,
  formatDuration,
  buildTitle,
  getFailedCount,
  buildFailedCountLabel,
  formatFailedVideoLine,
  getSubtitle,
  buildAutoRemovalTitle,
  buildDownloadPauseContent,
  buildCookiesInvalidContent,
  formatBytes,
  videoCountLabel,
  getAutoRemovalSections,
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

/**
 * Format download notification as Telegram HTML message
 * @param {Object} finalSummary - Summary object from downloadExecutor
 * @param {Array} videoData - Array of video metadata objects
 * @param {Object} [options]
 * @param {string} [options.linkTemplate] - Link template that adds a link to each video
 * @returns {Object} Object with title and HTML body strings
 */
function formatDownloadMessage(finalSummary, videoData, options = {}) {
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

  const stoppedLines = getStoppedLines(finalSummary);
  if (stoppedLines.length > 0) {
    stoppedLines.forEach(line => {
      body += `⚠️ <b>${escapeHtml(line)}</b>\n`;
    });
    body += '\n';
  }

  if (videoData && videoData.length > 0) {
    const videosToShow = videoData.slice(0, 10);

    videosToShow.forEach(video => {
      const channelName = escapeHtml(video.youTubeChannelName || 'Unknown Channel');
      const videoTitle = escapeHtml(video.youTubeVideoName || 'Unknown Title');
      const duration = formatDuration(video.duration);
      const link = buildVideoLink(options.linkTemplate, video);

      body += `📺 <b>${channelName}</b>\n`;
      body += `${link ? `<a href="${escapeHtml(link)}">${videoTitle}</a>` : videoTitle}\n`;
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
  const title = buildAutoRemovalTitle(cleanupResult.totalDeleted);
  let body = `Freed <b>${formatBytes(cleanupResult.freedBytes)}</b> of storage\n`;

  for (const section of getAutoRemovalSections(cleanupResult)) {
    body += `\n<b>${escapeHtml(section.label)}: ${videoCountLabel(section.count)}</b>\n`;
    for (const group of section.groups) {
      body += `📺 <b>${escapeHtml(group.channel)}</b> (${videoCountLabel(group.count)}): ${group.titles.map(t => escapeHtml(t)).join(', ')}\n`;
    }
    if (section.truncatedCount > 0) {
      body += `<i>...and ${section.truncatedCount} more videos</i>\n`;
    }
  }

  body += '\n<i>— Youtarr</i>';

  return { title, body };
}

/**
 * Format downloads paused/resumed notification as Telegram HTML
 * @param {Object} status - storageGuard status
 * @returns {Object} Object with title and HTML body strings
 */
function formatDownloadPauseMessage(status) {
  const { title, summary, reasons, footer } = buildDownloadPauseContent(status);
  let body = escapeHtml(summary);
  if (reasons.length > 0) {
    body += `\n\n${reasons.map((reason) => `• <b>${escapeHtml(reason)}</b>`).join('\n')}`;
  }
  if (footer) {
    body += `\n\n<i>${escapeHtml(footer)}</i>`;
  }
  body += '\n\n<i>— Youtarr</i>';
  return { title, body };
}

/**
 * Format the "cookies stopped working" notification as Telegram HTML
 * @param {Object} info - see utils.buildCookiesInvalidContent
 * @returns {Object} Object with title and HTML body strings
 */
function formatCookiesInvalidMessage(info) {
  const { title, summary, effect, action } = buildCookiesInvalidContent(info);
  const body = `${escapeHtml(summary)}\n\n${escapeHtml(effect)}\n\n<i>${escapeHtml(action)}</i>\n\n<i>— Youtarr</i>`;
  return { title, body };
}

module.exports = {
  formatDownloadMessage,
  formatTestMessage,
  formatAutoRemovalMessage,
  formatDownloadPauseMessage,
  formatCookiesInvalidMessage
};
