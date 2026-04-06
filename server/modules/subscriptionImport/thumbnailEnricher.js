'use strict';

const https = require('https');
const logger = require('../../logger');
const createLimiter = require('./concurrencyLimiter');
const { THUMBNAIL_CONCURRENCY, THUMBNAIL_FETCH_TIMEOUT_MS, THUMBNAIL_MAX_BYTES } = require('./constants');

const OG_IMAGE_RE = /<meta\s+property="og:image"\s+content="([^"]+)"/i;

/**
 * Fetches the og:image URL from a YouTube channel page.
 * Handles one level of redirect (3xx with Location header).
 * NEVER rejects — all failures resolve to null.
 *
 * @param {string} channelId - YouTube channel ID (for logging context)
 * @param {string} url - URL to fetch (defaults to YouTube channel URL)
 * @param {boolean} [isRedirect=false] - Whether this is a redirected request (limits recursion)
 * @returns {Promise<string|null>}
 */
function fetchOgImage(channelId, url, isRedirect = false) {
  return new Promise((resolve) => {
    try {
      const req = https.get(url, { timeout: THUMBNAIL_FETCH_TIMEOUT_MS }, (res) => {
        const { statusCode, headers } = res;

        // Handle redirects (one level only)
        if (statusCode >= 300 && statusCode < 400 && headers.location && !isRedirect) {
          res.destroy();
          resolve(fetchOgImage(channelId, headers.location, true));
          return;
        }

        // Handle non-200 responses
        if (statusCode !== 200) {
          res.destroy();
          logger.warn({ channelId, statusCode }, 'thumbnailEnricher: non-200 response');
          resolve(null);
          return;
        }

        // Read body up to THUMBNAIL_MAX_BYTES
        const chunks = [];
        let bytesRead = 0;

        res.on('data', (chunk) => {
          bytesRead += chunk.length;
          if (bytesRead <= THUMBNAIL_MAX_BYTES) {
            chunks.push(chunk);
          } else {
            // We have enough data — stop reading and destroy
            res.destroy();
          }
        });

        res.on('end', () => {
          const html = Buffer.concat(chunks).toString('utf8');
          const match = OG_IMAGE_RE.exec(html);
          resolve(match ? match[1] : null);
        });

        res.on('error', (err) => {
          // Response stream error after connection established
          logger.warn({ channelId, err }, 'thumbnailEnricher: response stream error');
          resolve(null);
        });
      });

      req.on('timeout', () => {
        req.destroy();
        logger.warn({ channelId }, 'thumbnailEnricher: request timed out');
        resolve(null);
      });

      req.on('error', (err) => {
        logger.warn({ channelId, err }, 'thumbnailEnricher: request error');
        resolve(null);
      });
    } catch (err) {
      logger.warn({ channelId, err }, 'thumbnailEnricher: unexpected error in fetchOgImage');
      resolve(null);
    }
  });
}

/**
 * Enriches an array of channel objects with a `thumbnailUrl` field by
 * scraping the og:image meta tag from each channel's YouTube page.
 *
 * NEVER throws — failures produce `thumbnailUrl: null` on the affected channel.
 *
 * @param {Array<{ channelId: string, title: string, url: string }>} channels
 * @returns {Promise<Array<{ channelId: string, title: string, url: string, thumbnailUrl: string|null }>>}
 */
async function enrichWithThumbnails(channels) {
  const limit = createLimiter(THUMBNAIL_CONCURRENCY);

  return Promise.all(
    channels.map((ch) =>
      limit(async () => {
        try {
          const channelUrl = `https://www.youtube.com/channel/${ch.channelId}`;
          const thumbnailUrl = await fetchOgImage(ch.channelId, channelUrl);
          return { ...ch, thumbnailUrl };
        } catch (err) {
          logger.warn({ channelId: ch.channelId, err }, 'thumbnailEnricher: unexpected error enriching channel');
          return { ...ch, thumbnailUrl: null };
        }
      })
    )
  );
}

module.exports = { enrichWithThumbnails };
