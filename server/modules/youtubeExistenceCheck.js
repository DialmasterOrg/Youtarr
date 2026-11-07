const dns = require('dns');
const https = require('https');
const logger = require('../logger');

const EXISTENCE = Object.freeze({
  EXISTS: 'exists',
  REMOVED: 'removed',
  // No answer from YouTube (offline, timeout, or checks paused): callers
  // leave the video's checked-at time alone so the next page view retries.
  UNKNOWN: 'unknown',
});

const OEMBED_HOST = 'www.youtube.com';
// oEmbed answers 404 for a deleted video and 403 for a private one. Any
// other response, a redirect included, means the video is still there.
const REMOVED_STATUSES = new Set([403, 404]);
const REQUEST_TIMEOUT_MS = 10000;
// Lookups go through c-ares, which does not use libuv's threadpool. A plain
// dns.lookup that hangs while the internet is down holds one of the pool's
// few DNS slots for ~16 s, and the database host's lookup queues behind it
// (issue #921). With these settings an offline lookup fails in ~4-6 s.
// IPv4 and IPv6 addresses are both looked up (IPv4 listed first) and net
// tries the next address when one can't connect, so a host that reaches
// YouTube only over IPv6 still works, as it did through fetch().
const DNS_TIMEOUT_MS = 2000;
const DNS_TRIES = 2;
// After a request gets no answer, checks are skipped for this long; then
// one request at a time tests whether YouTube answers again.
const OFFLINE_COOLDOWN_MS = 5 * 60 * 1000;

class YoutubeExistenceCheck {
  constructor() {
    this.resolver = new dns.Resolver({ timeout: DNS_TIMEOUT_MS, tries: DNS_TRIES });
    this.offlineUntil = 0;
    this.probeInFlight = false;
    this.lookup = this.lookup.bind(this);
  }

  /**
   * Ask YouTube's oEmbed endpoint whether a video still exists.
   * @param {string} youtubeId - YouTube video ID
   * @returns {Promise<string>} One of EXISTENCE's values; never rejects
   */
  async check(youtubeId) {
    if (!this.admit()) {
      return EXISTENCE.UNKNOWN;
    }

    try {
      const status = await this.requestStatus(youtubeId);
      this.markReachable();
      return REMOVED_STATUSES.has(status) ? EXISTENCE.REMOVED : EXISTENCE.EXISTS;
    } catch (err) {
      this.markUnreachable(err, youtubeId);
      return EXISTENCE.UNKNOWN;
    }
  }

  admit() {
    if (this.offlineUntil === 0) {
      return true;
    }
    if (Date.now() < this.offlineUntil || this.probeInFlight) {
      return false;
    }
    this.probeInFlight = true;
    return true;
  }

  markReachable() {
    if (this.offlineUntil !== 0) {
      logger.info('YouTube is reachable again, resuming video existence checks');
    }
    this.offlineUntil = 0;
    this.probeInFlight = false;
  }

  markUnreachable(err, youtubeId) {
    const wasReachable = this.offlineUntil === 0;
    this.offlineUntil = Date.now() + OFFLINE_COOLDOWN_MS;
    this.probeInFlight = false;
    if (wasReachable) {
      logger.warn(
        { err, youtubeId, pausedForMs: OFFLINE_COOLDOWN_MS },
        'YouTube did not answer a video existence check, pausing the checks'
      );
    } else {
      logger.debug({ err, youtubeId }, 'YouTube still not answering video existence checks');
    }
  }

  /**
   * net.connect lookup hook backed by c-ares: A and AAAA records, asked in
   * parallel, IPv4 first. Fails only when neither family resolves.
   * @param {string} hostname
   * @param {Object} options - net passes { all: true } when it tries several
   *   addresses, and may limit the answer to one `family` (4 or 6)
   * @param {Function} callback
   */
  lookup(hostname, options, callback) {
    const requested = options && (options.family === 4 || options.family === 6)
      ? [options.family]
      : [4, 6];
    const answers = [];
    let pending = requested.length;

    const finish = () => {
      const addresses = answers.flatMap(({ family, found }) =>
        found.map((address) => ({ address, family })));
      if (addresses.length === 0) {
        const error = answers.map((answer) => answer.error).find(Boolean)
          || Object.assign(new Error(`No addresses for ${hostname}`), { code: dns.NOTFOUND });
        callback(error);
        return;
      }
      if (options && options.all) {
        callback(null, addresses);
        return;
      }
      callback(null, addresses[0].address, addresses[0].family);
    };

    requested.forEach((family, index) => {
      const query = family === 4 ? 'resolve4' : 'resolve6';
      this.resolver[query](hostname, (error, found) => {
        answers[index] = { family, error, found: error ? [] : found };
        pending -= 1;
        if (pending === 0) {
          finish();
        }
      });
    });
  }

  requestStatus(youtubeId) {
    return new Promise((resolve, reject) => {
      const req = https.request(
        {
          host: OEMBED_HOST,
          path: `/oembed?url=https://www.youtube.com/watch?v=${youtubeId}&format=json`,
          method: 'HEAD',
          lookup: this.lookup,
          timeout: REQUEST_TIMEOUT_MS,
        },
        (res) => {
          res.resume();
          resolve(res.statusCode);
        }
      );
      req.on('timeout', () => {
        req.destroy(new Error(`No response from YouTube within ${REQUEST_TIMEOUT_MS} ms`));
      });
      req.on('error', reject);
      req.end();
    });
  }
}

module.exports = new YoutubeExistenceCheck();
module.exports.EXISTENCE = EXISTENCE;
module.exports.OFFLINE_COOLDOWN_MS = OFFLINE_COOLDOWN_MS;
