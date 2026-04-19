'use strict';

const https = require('https');
const logger = require('../logger');
const createConcurrencyLimiter = require('./subscriptionImport/concurrencyLimiter');

// Rate limiting: at most OEMBED_RPS outbound oEmbed requests per second.
// This protects the user's IP from YouTube throttling / temporary bans.
const OEMBED_RPS = 3;
const OEMBED_CONCURRENCY = 3;
const OEMBED_TIMEOUT_MS = 5000;
const OEMBED_HARD_DEADLINE_MS = OEMBED_TIMEOUT_MS + 2000;
const OEMBED_MAX_IDS_PER_REQUEST = 100;
const OEMBED_MAX_BYTES = 64 * 1024;
const VIDEO_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/;

/**
 * Creates a rate limiter that ensures at most `rps` fires per second.
 * Returned object has `waitForSlot()`, which resolves when the caller
 * may proceed. Call exactly once per outbound request.
 *
 * Callers share state within a single limiter instance: two concurrent
 * waitForSlot() invocations will be scheduled back-to-back, not in
 * parallel.
 */
function createRateLimiter({ rps, now = Date.now, sleep } = {}) {
  if (!Number.isFinite(rps) || rps <= 0) {
    throw new Error('createRateLimiter: rps must be a positive number');
  }
  const minIntervalMs = Math.ceil(1000 / rps);
  const sleepFn = sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  let nextSlotAt = 0;

  return {
    waitForSlot() {
      const t = now();
      const target = Math.max(t, nextSlotAt);
      nextSlotAt = target + minIntervalMs;
      const delay = target - t;
      if (delay <= 0) return Promise.resolve();
      return sleepFn(delay);
    },
  };
}

const defaultRateLimiter = createRateLimiter({ rps: OEMBED_RPS });

function fetchOembed(videoId) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };

    const deadline = setTimeout(() => {
      logger.warn({ videoId }, 'videoOembedEnricher: hard deadline exceeded');
      finish(null);
    }, OEMBED_HARD_DEADLINE_MS);

    try {
      const oEmbedUrl = `https://www.youtube.com/oembed?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3D${videoId}&format=json`;
      const req = https.get(oEmbedUrl, { timeout: OEMBED_TIMEOUT_MS }, (res) => {
        const { statusCode } = res;

        if (statusCode !== 200) {
          res.resume();
          clearTimeout(deadline);
          if (statusCode !== 401 && statusCode !== 403 && statusCode !== 404) {
            logger.warn({ videoId, statusCode }, 'videoOembedEnricher: non-200 oembed response');
          }
          finish(null);
          return;
        }

        const chunks = [];
        let bytesRead = 0;
        let overflow = false;

        res.on('data', (chunk) => {
          bytesRead += chunk.length;
          if (bytesRead > OEMBED_MAX_BYTES) {
            overflow = true;
            res.destroy();
            return;
          }
          chunks.push(chunk);
        });

        res.on('end', () => {
          clearTimeout(deadline);
          if (overflow) {
            logger.warn({ videoId, bytesRead }, 'videoOembedEnricher: oembed response too large');
            finish(null);
            return;
          }
          try {
            const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
            const title = typeof parsed.title === 'string' ? parsed.title : '';
            const channelName = typeof parsed.author_name === 'string' ? parsed.author_name : '';
            if (!title && !channelName) {
              finish(null);
              return;
            }
            finish({ title, channelName });
          } catch (err) {
            logger.warn({ videoId, err }, 'videoOembedEnricher: failed to parse oembed JSON');
            finish(null);
          }
        });

        res.on('error', (err) => {
          clearTimeout(deadline);
          logger.warn({ videoId, err }, 'videoOembedEnricher: response stream error');
          finish(null);
        });

        res.on('close', () => {
          clearTimeout(deadline);
          finish(null);
        });
      });

      req.on('timeout', () => {
        req.destroy();
        clearTimeout(deadline);
        finish(null);
      });

      req.on('error', (err) => {
        clearTimeout(deadline);
        logger.warn({ videoId, err }, 'videoOembedEnricher: request error');
        finish(null);
      });
    } catch (err) {
      clearTimeout(deadline);
      logger.warn({ videoId, err }, 'videoOembedEnricher: unexpected error');
      finish(null);
    }
  });
}

/**
 * Fetch title + channel name for a batch of YouTube video IDs via oEmbed.
 *
 * @param {string[]} ids - YouTube video IDs
 * @param {Object} [options]
 * @param {{ waitForSlot: () => Promise<void> }} [options.rateLimiter]
 *        Optional rate limiter override, used in tests.
 * @returns {Promise<Object.<string, { title: string, channelName: string }>>}
 */
async function enrichByIds(ids, { rateLimiter = defaultRateLimiter } = {}) {
  if (!Array.isArray(ids) || ids.length === 0) return {};

  const cleanIds = Array.from(
    new Set(ids.filter((id) => typeof id === 'string' && VIDEO_ID_PATTERN.test(id)))
  ).slice(0, OEMBED_MAX_IDS_PER_REQUEST);

  if (cleanIds.length === 0) return {};

  const limit = createConcurrencyLimiter(OEMBED_CONCURRENCY);
  const results = {};

  await Promise.all(
    cleanIds.map((id) =>
      limit(async () => {
        await rateLimiter.waitForSlot();
        const data = await fetchOembed(id);
        if (data) {
          results[id] = data;
        }
      })
    )
  );

  return results;
}

module.exports = {
  enrichByIds,
  createRateLimiter,
  OEMBED_MAX_IDS_PER_REQUEST,
  OEMBED_RPS,
};
