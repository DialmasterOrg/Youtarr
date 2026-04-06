'use strict';

const https = require('https');
const logger = require('../../logger');
const createLimiter = require('./concurrencyLimiter');
const { THUMBNAIL_CONCURRENCY, THUMBNAIL_FETCH_TIMEOUT_MS, THUMBNAIL_MAX_BYTES } = require('./constants');

const OG_IMAGE_RE = /<meta\s+property="og:image"\s+content="([^"]+)"/i;

/**
 * Hard deadline for a single og:image fetch, independent of the socket timeout.
 * Catches cases where the connection is alive but drip-feeding data.
 */
const HARD_DEADLINE_MS = THUMBNAIL_FETCH_TIMEOUT_MS + 2000;

/**
 * Fetches the og:image URL from a YouTube channel page.
 * Handles one level of redirect (3xx with Location header).
 * NEVER rejects - all failures resolve to null.
 *
 * @param {string} channelId - YouTube channel ID (for logging context)
 * @param {string} url - URL to fetch
 * @param {boolean} [isRedirect=false] - Whether this is a redirected request
 * @returns {Promise<string|null>}
 */
function fetchOgImage(channelId, url, isRedirect = false) {
  return new Promise((resolve) => {
    let resolved = false;
    function safeResolve(value) {
      if (!resolved) {
        resolved = true;
        resolve(value);
      }
    }

    // Hard deadline: if nothing resolves the promise within HARD_DEADLINE_MS, force-resolve null
    const deadline = setTimeout(() => {
      logger.warn({ channelId }, 'thumbnailEnricher: hard deadline exceeded');
      safeResolve(null);
    }, HARD_DEADLINE_MS);

    try {
      const req = https.get(url, { timeout: THUMBNAIL_FETCH_TIMEOUT_MS }, (res) => {
        const { statusCode, headers } = res;

        // Handle redirects (one level only)
        if (statusCode >= 300 && statusCode < 400 && headers.location && !isRedirect) {
          res.destroy();
          clearTimeout(deadline);
          resolve(fetchOgImage(channelId, headers.location, true));
          return;
        }

        // Handle non-200 responses
        if (statusCode !== 200) {
          res.destroy();
          clearTimeout(deadline);
          logger.warn({ channelId, statusCode }, 'thumbnailEnricher: non-200 response');
          safeResolve(null);
          return;
        }

        // Read body up to THUMBNAIL_MAX_BYTES
        const chunks = [];
        let bytesRead = 0;

        res.on('data', (chunk) => {
          bytesRead += chunk.length;
          if (bytesRead <= THUMBNAIL_MAX_BYTES) {
            chunks.push(chunk);
          }
          // Check if we have enough data to extract og:image
          if (bytesRead > THUMBNAIL_MAX_BYTES) {
            res.destroy();
            clearTimeout(deadline);
            const html = Buffer.concat(chunks).toString('utf8');
            const match = OG_IMAGE_RE.exec(html);
            if (!match) {
              const snippet = html.slice(0, 500).replace(/\n/g, ' ');
              logger.warn(
                { channelId, statusCode, bytesRead, htmlLength: html.length, snippet },
                'thumbnailEnricher: og:image not found in response (byte limit reached)'
              );
            }
            safeResolve(match ? match[1] : null);
          }
        });

        res.on('end', () => {
          clearTimeout(deadline);
          const html = Buffer.concat(chunks).toString('utf8');
          const match = OG_IMAGE_RE.exec(html);
          if (!match) {
            // Log diagnostic info to help debug why og:image wasn't found
            const snippet = html.slice(0, 500).replace(/\n/g, ' ');
            logger.warn(
              { channelId, statusCode, bytesRead, htmlLength: html.length, snippet },
              'thumbnailEnricher: og:image not found in response'
            );
          }
          safeResolve(match ? match[1] : null);
        });

        res.on('error', (err) => {
          clearTimeout(deadline);
          logger.warn({ channelId, err }, 'thumbnailEnricher: response stream error');
          safeResolve(null);
        });

        // 'close' fires after destroy() even when 'end' does not
        res.on('close', () => {
          clearTimeout(deadline);
          safeResolve(null);
        });
      });

      req.on('timeout', () => {
        req.destroy();
        clearTimeout(deadline);
        logger.warn({ channelId }, 'thumbnailEnricher: socket timeout');
        safeResolve(null);
      });

      req.on('error', (err) => {
        clearTimeout(deadline);
        logger.warn({ channelId, err }, 'thumbnailEnricher: request error');
        safeResolve(null);
      });
    } catch (err) {
      clearTimeout(deadline);
      logger.warn({ channelId, err }, 'thumbnailEnricher: unexpected error in fetchOgImage');
      safeResolve(null);
    }
  });
}

/**
 * Enriches an array of channel objects with a `thumbnailUrl` field by
 * scraping the og:image meta tag from each channel's YouTube page.
 *
 * NEVER throws - failures produce `thumbnailUrl: null` on the affected channel.
 *
 * @param {Array<{ channelId: string, title: string, url: string }>} channels
 * @returns {Promise<Array<{ channelId: string, title: string, url: string, thumbnailUrl: string|null }>>}
 */
async function enrichWithThumbnails(channels) {
  if (!channels || channels.length === 0) return [];

  logger.info({ channelCount: channels.length }, 'thumbnailEnricher: starting thumbnail enrichment');
  const startTime = Date.now();
  const limit = createLimiter(THUMBNAIL_CONCURRENCY);

  let successCount = 0;
  let failCount = 0;

  const enriched = await Promise.all(
    channels.map((ch) =>
      limit(async () => {
        try {
          const channelUrl = `https://www.youtube.com/channel/${ch.channelId}`;
          const thumbnailUrl = await fetchOgImage(ch.channelId, channelUrl);
          if (thumbnailUrl) {
            successCount += 1;
          } else {
            failCount += 1;
            if (failCount === 1) {
              logger.info({ channelId: ch.channelId }, 'thumbnailEnricher: first thumbnail failure (details logged at warn level above)');
            }
          }
          logger.debug({ channelId: ch.channelId, hasThumbnail: !!thumbnailUrl }, 'thumbnailEnricher: channel processed');
          return { ...ch, thumbnailUrl };
        } catch (err) {
          failCount += 1;
          logger.warn({ channelId: ch.channelId, err }, 'thumbnailEnricher: unexpected error enriching channel');
          return { ...ch, thumbnailUrl: null };
        }
      })
    )
  );

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  logger.info(
    { channelCount: channels.length, successCount, failCount, elapsedSeconds: elapsed },
    'thumbnailEnricher: enrichment complete'
  );

  return enriched;
}

module.exports = { enrichWithThumbnails };
