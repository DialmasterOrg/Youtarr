const https = require('https');
const configModule = require('../configModule');
const youtubeExistenceCheck = require('../youtubeExistenceCheck');
const { CHANNEL_ID_PATTERN } = require('../youtubeApi/constants');

const FEED_HOST = 'www.youtube.com';
const FEED_PATH = '/feeds/videos.xml';
const REQUEST_TIMEOUT_MS = 15000;
const MAX_FEED_BYTES = 1024 * 1024;
const HTTP_OK = 200;
// A generic reader identity: nothing about this install goes to YouTube.
const USER_AGENT = 'Mozilla/5.0 (compatible; feed-reader)';

const CHANNEL_ID_PREFIX_LENGTH = 2;
const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const FEED_CHANNEL_ID_PATTERN = /<yt:channelId>([^<]*)<\/yt:channelId>/;
const ENTRY_VIDEO_ID_PATTERN = /<yt:videoId>([^<]*)<\/yt:videoId>/;
const ENTRY_OPEN_TAG = '<entry>';
const FEED_CLOSE_TAG = '</feed>';
const SHORTS_LINK = 'href="https://www.youtube.com/shorts/';

const IP_FAMILY_BY_SETTING = { ipv4: 4, ipv6: 6 };
const DEFAULT_IP_FAMILY_SETTING = 'ipv4';

const REASON = Object.freeze({
  INVALID_CHANNEL_ID: 'invalid-channel-id',
  HTTP_ERROR: 'http-error',
  TIMEOUT: 'timeout',
  NETWORK: 'network',
  TOO_LARGE: 'too-large',
  WRONG_CHANNEL: 'wrong-channel',
  PARSE_ERROR: 'parse-error',
});

/**
 * Reads a channel's YouTube RSS feed (its 15 newest public uploads of every
 * kind) to learn which video ids exist. The feed is only ever a hint: any
 * answer other than a valid feed for the requested channel is "no
 * information" (`ok: false`), never an empty channel.
 */
class ChannelFeedClient {
  /**
   * Extract video ids from a feed body. The body is untrusted: only ids of
   * the expected shape are taken, and nothing else is read from it.
   * @param {string} xml - Response body
   * @param {string} channelId - The channel the feed was requested for
   * @returns {{ok: true, entries: Array<{youtubeId: string, isShort: boolean}>}|{ok: false, reason: string}}
   */
  parseFeed(xml, channelId) {
    const firstEntryAt = xml.indexOf(ENTRY_OPEN_TAG);
    const header = firstEntryAt === -1 ? xml : xml.slice(0, firstEntryAt);
    const feedChannel = FEED_CHANNEL_ID_PATTERN.exec(header);
    if (!feedChannel || !xml.includes(FEED_CLOSE_TAG)) {
      return { ok: false, reason: REASON.PARSE_ERROR };
    }

    // The channel_id feed names its channel without the UC prefix; playlist
    // feeds keep it. Either form of the requested id is this channel.
    const feedChannelId = feedChannel[1].trim();
    if (feedChannelId !== channelId && feedChannelId !== channelId.slice(CHANNEL_ID_PREFIX_LENGTH)) {
      return { ok: false, reason: REASON.WRONG_CHANNEL };
    }

    const entries = [];
    for (const entryXml of xml.split(ENTRY_OPEN_TAG).slice(1)) {
      const videoId = ENTRY_VIDEO_ID_PATTERN.exec(entryXml);
      if (!videoId || !VIDEO_ID_PATTERN.test(videoId[1])) continue;
      entries.push({ youtubeId: videoId[1], isShort: entryXml.includes(SHORTS_LINK) });
    }
    return { ok: true, entries };
  }

  /**
   * Whether an id is a `UC...` channel id, the only kind that has this feed.
   * @param {*} channelId
   * @returns {boolean}
   */
  supportsChannel(channelId) {
    return typeof channelId === 'string' && CHANNEL_ID_PATTERN.test(channelId);
  }

  /**
   * Fetch and parse one channel's feed.
   * @param {string} channelId - A `UC...` channel id
   * @returns {Promise<{ok: true, entries: Array<{youtubeId: string, isShort: boolean}>}|{ok: false, reason: string, status?: number}>}
   *   Never rejects.
   */
  async fetchChannelFeed(channelId) {
    if (!this.supportsChannel(channelId)) {
      return { ok: false, reason: REASON.INVALID_CHANNEL_ID };
    }

    let response;
    try {
      response = await this.requestFeed(channelId);
    } catch (err) {
      return { ok: false, reason: REASON.NETWORK };
    }
    if (response.reason) {
      return { ok: false, reason: response.reason };
    }
    if (response.status !== HTTP_OK) {
      return { ok: false, reason: REASON.HTTP_ERROR, status: response.status };
    }
    return this.parseFeed(response.body, channelId);
  }

  /**
   * @param {string} channelId - A validated channel id
   * @returns {Promise<{status: number, body: string}|{reason: string}>}
   */
  requestFeed(channelId) {
    const ipFamilySetting = configModule.getConfig().ytdlpIpFamily || DEFAULT_IP_FAMILY_SETTING;
    const family = IP_FAMILY_BY_SETTING[ipFamilySetting];

    return new Promise((resolve) => {
      let timedOut = false;
      const req = https.request(
        {
          host: FEED_HOST,
          path: `${FEED_PATH}?channel_id=${channelId}`,
          method: 'GET',
          headers: { 'User-Agent': USER_AGENT },
          // c-ares, off libuv's threadpool: an offline lookup must not hold
          // the DNS slots the database connection needs (issue #921).
          lookup: youtubeExistenceCheck.lookup,
          timeout: REQUEST_TIMEOUT_MS,
          ...(family ? { family } : {}),
        },
        (res) => {
          if (res.statusCode !== HTTP_OK) {
            res.resume();
            resolve({ status: res.statusCode, body: '' });
            return;
          }

          const chunks = [];
          let receivedBytes = 0;
          res.on('data', (chunk) => {
            receivedBytes += chunk.length;
            if (receivedBytes > MAX_FEED_BYTES) {
              res.destroy();
              resolve({ reason: REASON.TOO_LARGE });
              return;
            }
            chunks.push(chunk);
          });
          res.on('end', () => {
            resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') });
          });
          res.on('error', () => {
            resolve({ reason: REASON.NETWORK });
          });
        }
      );
      req.on('timeout', () => {
        timedOut = true;
        req.destroy(new Error(`No response from YouTube within ${REQUEST_TIMEOUT_MS} ms`));
      });
      req.on('error', () => {
        resolve({ reason: timedOut ? REASON.TIMEOUT : REASON.NETWORK });
      });
      req.end();
    });
  }
}

module.exports = new ChannelFeedClient();
