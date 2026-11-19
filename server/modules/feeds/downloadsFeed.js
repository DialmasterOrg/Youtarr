const crypto = require('crypto');
const { Op } = require('sequelize');
const { Video } = require('../../models');
const configModule = require('../configModule');
const logger = require('../../logger');
const { buildVideoLink, escapeHtml, formatDuration } = require('../notifications/utils');
const { normalizeItemLimit, normalizeMediaTypes } = require('./feedSettings');
const { renderRss } = require('./rssWriter');

const TOKEN_BYTES = 32;
const DESCRIPTION_MAX_LENGTH = 300;
const YOUTUBE_LINK_TEMPLATE = 'https://www.youtube.com/watch?v={youtubeId}';
const UPLOAD_DATE_PATTERN = /^(\d{4})(\d{2})(\d{2})$/;
const FEED_ATTRIBUTES = [
  'youtubeId',
  'youTubeVideoName',
  'youTubeChannelName',
  'duration',
  'originalDate',
  'description',
  'youtube_removed',
  'last_downloaded_at',
];

const sha256 = (value) => crypto.createHash('sha256').update(value).digest();

function buildThumbnailUrl(row, origin) {
  // Readers load images in the browser, where an https reader blocks an
  // http://192.168.x.x image and a login proxy can block /images, so Youtarr's
  // own copy is only for a video YouTube no longer has.
  return row.youtube_removed
    ? `${origin}/images/videothumb-${row.youtubeId}.jpg`
    : `https://i.ytimg.com/vi/${row.youtubeId}/hqdefault.jpg`;
}

function formatUploadDate(originalDate) {
  const match = UPLOAD_DATE_PATTERN.exec(originalDate ?? '');
  return match ? `Uploaded ${match[1]}-${match[2]}-${match[3]}` : null;
}

function buildDescriptionHtml(description) {
  const text = (description ?? '').trim();
  if (!text) return '';
  const cut = text.length > DESCRIPTION_MAX_LENGTH ? `${text.slice(0, DESCRIPTION_MAX_LENGTH)}...` : text;
  return `<p>${escapeHtml(cut).replace(/(\r?\n)+/g, '<br/>')}</p>`;
}

function buildBody(row, link, thumbnailUrl) {
  const image = `<img src="${escapeHtml(thumbnailUrl)}" alt="${escapeHtml(row.youTubeVideoName)}"/>`;
  const details = [
    row.youTubeChannelName,
    row.duration ? formatDuration(row.duration) : null,
    formatUploadDate(row.originalDate),
  ].filter(Boolean).join(' | ');

  return [
    `<p><a href="${escapeHtml(link)}">${image}</a></p>`,
    `<p>${escapeHtml(details)}</p>`,
    buildDescriptionHtml(row.description),
  ].join('');
}

function toFeedItem(row, origin, linkTemplate) {
  const youtubeLink = buildVideoLink(YOUTUBE_LINK_TEMPLATE, row);
  if (!youtubeLink) return null;

  const link = buildVideoLink(linkTemplate, row) || youtubeLink;
  const thumbnailUrl = buildThumbnailUrl(row, origin);
  return {
    title: row.youTubeVideoName,
    link,
    // The video ID alone: last_downloaded_at is rewritten at job save and job
    // recovery, so a date in here would show one download as several items.
    guid: `youtarr:video:${row.youtubeId}`,
    pubDate: row.last_downloaded_at,
    creator: row.youTubeChannelName,
    thumbnailUrl,
    description: buildBody(row, link, thumbnailUrl),
  };
}

class DownloadsFeed {
  /**
   * A wrong token and a disabled feed look the same to the caller.
   * @param {unknown} candidate - The token query parameter
   * @returns {boolean}
   */
  isAuthorized(candidate) {
    const { downloadsFeedEnabled, downloadsFeedToken } = configModule.getConfig();
    if (downloadsFeedEnabled !== true || typeof candidate !== 'string') return false;
    if (typeof downloadsFeedToken !== 'string' || !downloadsFeedToken) return false;
    return crypto.timingSafeEqual(sha256(candidate), sha256(downloadsFeedToken));
  }

  getOrCreateToken() {
    return configModule.getConfig().downloadsFeedToken || this.saveNewToken();
  }

  regenerateToken() {
    return this.saveNewToken();
  }

  saveNewToken() {
    const token = crypto.randomBytes(TOKEN_BYTES).toString('hex');
    configModule.updateConfig({ ...configModule.getConfig(), downloadsFeedToken: token });
    logger.info({ event: 'downloads_feed_token_created' }, 'Created a new download feed URL');
    return token;
  }

  /**
   * @param {string} origin - Scheme and host the reader used, for the feed's home
   *   link and the thumbnail of a video removed from YouTube
   * @returns {Promise<string>} The RSS document
   */
  async renderFeed(origin) {
    const config = configModule.getConfig();
    const rows = await Video.findAll({
      attributes: FEED_ATTRIBUTES,
      where: {
        removed: false,
        last_downloaded_at: { [Op.ne]: null },
        media_type: { [Op.in]: normalizeMediaTypes(config.downloadsFeedMediaTypes) },
      },
      order: [['last_downloaded_at', 'DESC'], ['id', 'DESC']],
      limit: normalizeItemLimit(config.downloadsFeedItemLimit),
      raw: true,
    });

    return renderRss({
      title: 'Youtarr downloads',
      link: origin,
      description: 'Videos recently downloaded by Youtarr',
      // The newest item, not the current time: identical bytes let Express
      // answer a reader's repeat fetch with a 304.
      lastBuildDate: rows[0]?.last_downloaded_at ?? null,
      items: rows
        .map((row) => toFeedItem(row, origin, config.downloadsFeedLinkTemplate))
        .filter(Boolean),
    });
  }
}

module.exports = new DownloadsFeed();
