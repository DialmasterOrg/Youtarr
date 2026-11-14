const configModule = require('./configModule');
const { Video, Job } = require('../models');

const MIN_DOWNLOADED_VIDEOS = 200;
const MIN_DAYS_SINCE_FIRST_USE = 14;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toValidDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * The one-time "consider supporting Youtarr" prompt: decides whether this
 * install should see it, and records that it was shown so it never returns.
 */
class SupportPromptModule {
  async shouldShow() {
    // Elfhosted users already pay for Youtarr through their host.
    if (configModule.isElfhostedPlatform()) return false;
    if (configModule.getConfig().supportPromptShownAt) return false;

    const videoCount = await Video.count();
    if (videoCount < MIN_DOWNLOADED_VIDEOS) return false;

    const firstUse = await this.getFirstUseDate();
    if (!firstUse) return false;
    return Date.now() - firstUse.getTime() >= MIN_DAYS_SINCE_FIRST_USE * MS_PER_DAY;
  }

  // Rows from before last_downloaded_at existed have no download time, so
  // the oldest job stands in for them.
  async getFirstUseDate() {
    const [firstDownload, firstJob] = await Promise.all([
      Video.min('last_downloaded_at'),
      Job.min('timeCreated'),
    ]);
    const dates = [toValidDate(firstDownload), toValidDate(firstJob)].filter(Boolean);
    if (dates.length === 0) return null;
    return new Date(Math.min(...dates.map((date) => date.getTime())));
  }

  markShown() {
    const config = configModule.getConfig();
    if (config.supportPromptShownAt) return;
    configModule.updateConfig({ ...config, supportPromptShownAt: new Date().toISOString() });
  }
}

module.exports = new SupportPromptModule();
module.exports.MIN_DOWNLOADED_VIDEOS = MIN_DOWNLOADED_VIDEOS;
module.exports.MIN_DAYS_SINCE_FIRST_USE = MIN_DAYS_SINCE_FIRST_USE;
