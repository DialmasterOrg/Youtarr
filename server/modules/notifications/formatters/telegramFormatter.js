/**
 * Telegram HTML notification formatter
 */

const { escapeHtml, formatDuration, buildTitle, getSubtitle, buildAutoRemovalTitle, formatBytes, groupVideosByChannel } = require('../utils');

/**
 * Format download notification as Telegram HTML message
 * @param {Object} finalSummary - Summary object from downloadExecutor
 * @param {Array} videoData - Array of video metadata objects
 * @returns {Object} Object with title and HTML body strings
 */
function formatDownloadMessage(finalSummary, videoData) {
  const { totalDownloaded, jobType } = finalSummary;

  const title = buildTitle(totalDownloaded);
  let body = `<b>${getSubtitle(jobType)}:</b>\n\n`;

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
  const { totalDeleted, deletedByAge, deletedBySpace, freedBytes, plan = {} } = cleanupResult;
  const ageStrategy = plan.ageStrategy || {};
  const spaceStrategy = plan.spaceStrategy || {};

  const title = buildAutoRemovalTitle(totalDeleted);
  let body = `Freed <b>${formatBytes(freedBytes)}</b> of storage\n`;

  if (deletedByAge > 0) {
    const threshold = ageStrategy.thresholdDays;
    body += `\n<b>Removed by age (exceeded ${threshold}-day limit): ${deletedByAge} ${deletedByAge === 1 ? 'video' : 'videos'}</b>\n`;

    const grouped = groupVideosByChannel(ageStrategy.sampleVideos);
    for (const group of grouped) {
      const videoLabel = group.count === 1 ? '1 video' : `${group.count} videos`;
      body += `📺 <b>${escapeHtml(group.channel)}</b> (${videoLabel}): ${group.titles.map(t => escapeHtml(t)).join(', ')}\n`;
    }
  }

  if (deletedBySpace > 0) {
    const threshold = escapeHtml(String(spaceStrategy.threshold));
    body += `\n<b>Removed for storage (below ${threshold} threshold): ${deletedBySpace} ${deletedBySpace === 1 ? 'video' : 'videos'}</b>\n`;

    const grouped = groupVideosByChannel(spaceStrategy.sampleVideos);
    for (const group of grouped) {
      const videoLabel = group.count === 1 ? '1 video' : `${group.count} videos`;
      body += `📺 <b>${escapeHtml(group.channel)}</b> (${videoLabel}): ${group.titles.map(t => escapeHtml(t)).join(', ')}\n`;
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

