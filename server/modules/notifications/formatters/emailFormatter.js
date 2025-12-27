/**
 * HTML email notification formatter
 */

const { escapeHtml, formatDuration, buildTitle, getSubtitle } = require('../utils');

/**
 * Generate the email CSS styles
 * @returns {string} CSS styles
 */
function getStyles() {
  // Using MUI primary blue (#1976d2) for consistency with the app UI
  return `
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%); color: white; padding: 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 24px; }
    .subtitle { color: #666; font-size: 14px; margin-bottom: 20px; }
    .video-card { background: #f8f9fa; border-radius: 6px; padding: 16px; margin-bottom: 12px; border-left: 4px solid #1976d2; }
    .channel-name { font-weight: 600; color: #333; margin-bottom: 4px; }
    .video-title { color: #555; margin-bottom: 4px; }
    .duration { color: #888; font-size: 13px; }
    .footer { padding: 16px 24px; background: #f8f9fa; text-align: center; color: #888; font-size: 12px; }
    .more-videos { color: #666; font-style: italic; padding: 12px 0; }
  `;
}

/**
 * Build HTML email wrapper
 * @param {string} title - Email title
 * @param {string} subtitle - Email subtitle
 * @param {string} content - Email content HTML
 * @returns {string} Complete HTML email
 */
function buildEmailHtml(title, subtitle, content) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>${getStyles()}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${escapeHtml(title)}</h1>
    </div>
    <div class="content">
      <p class="subtitle">${escapeHtml(subtitle)}</p>
      ${content}
    </div>
    <div class="footer">
      Sent by Youtarr • ${new Date().toLocaleString()}
    </div>
  </div>
</body>
</html>`;
}

/**
 * Format download notification as HTML email
 * @param {Object} finalSummary - Summary object from downloadExecutor
 * @param {Array} videoData - Array of video metadata objects
 * @returns {Object} Object with title and HTML body strings
 */
function formatDownloadMessage(finalSummary, videoData) {
  const { totalDownloaded, jobType } = finalSummary;

  const title = buildTitle(totalDownloaded);
  const subtitle = getSubtitle(jobType);

  let content = '';

  if (videoData && videoData.length > 0) {
    const videosToShow = videoData.slice(0, 10);

    videosToShow.forEach(video => {
      const channelName = escapeHtml(video.youTubeChannelName || 'Unknown Channel');
      const videoTitle = escapeHtml(video.youTubeVideoName || 'Unknown Title');
      const duration = formatDuration(video.duration);

      content += `
      <div class="video-card">
        <div class="channel-name">📺 ${channelName}</div>
        <div class="video-title">${videoTitle}</div>
        <div class="duration">⏱️ ${duration}</div>
      </div>`;
    });

    if (videoData.length > 10) {
      content += `<p class="more-videos">...and ${videoData.length - 10} more videos</p>`;
    }
  }

  return {
    title,
    body: buildEmailHtml(title, subtitle, content)
  };
}

/**
 * Format test notification as HTML email
 * @param {string} name - Name of the webhook being tested
 * @returns {Object} Object with title and HTML body strings
 */
function formatTestMessage(name) {
  const content = `
      <p>Testing: <strong>${escapeHtml(name)}</strong></p>
      <p>Your Youtarr notifications are working correctly!</p>
      <div class="video-card">
        <div class="channel-name">📺 Example Channel</div>
        <div class="video-title">Example Video Title</div>
        <div class="duration">⏱️ 10:30</div>
      </div>`;

  return {
    title: '✅ Test Notification',
    body: buildEmailHtml('✅ Test Notification', 'Test Message', content)
  };
}

module.exports = {
  formatDownloadMessage,
  formatTestMessage
};

