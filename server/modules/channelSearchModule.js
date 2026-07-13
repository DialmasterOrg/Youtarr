const ytDlpRunner = require('./ytDlpRunner');
const ytdlpCommandBuilder = require('./download/ytdlpCommandBuilder');
const logger = require('../logger');
const { Channel } = require('../models');
const youtubeApi = require('./youtubeApi');

const SEARCH_TIMEOUT_MS = 60_000;
const ALLOWED_COUNTS = [10, 25, 50, 100];

class SearchCanceledError extends Error {
  constructor() { super('Search canceled'); this.name = 'SearchCanceledError'; }
}
class SearchTimeoutError extends Error {
  constructor() { super('Search timed out'); this.name = 'SearchTimeoutError'; }
}

class ChannelSearchModule {
  async searchChannels(query, count, { signal } = {}) {
    if (!ALLOWED_COUNTS.includes(count)) {
      throw new Error(`count must be one of ${ALLOWED_COUNTS.join(', ')}`);
    }

    let results = null;
    let source = null;

    if (youtubeApi.isAvailable()) {
      try {
        const apiKey = youtubeApi.getApiKey();
        results = await youtubeApi.client.searchChannels(apiKey, query, count, { signal });
        source = 'youtube-api';
      } catch (apiErr) {
        if (apiErr?.code === youtubeApi.YoutubeApiErrorCode.CANCELED) {
          throw new SearchCanceledError();
        }
        logger.warn(
          { err: apiErr, query, code: apiErr?.code },
          'YouTube API searchChannels failed, falling back to yt-dlp'
        );
      }
    }

    if (results === null) {
      const args = ytdlpCommandBuilder.buildChannelSearchArgs(query, count);
      let stdout;
      try {
        stdout = await ytDlpRunner.run(args, { timeoutMs: SEARCH_TIMEOUT_MS, signal });
      } catch (err) {
        if (err.name === 'AbortError') throw new SearchCanceledError();
        if (err.code === 'YTDLP_TIMEOUT') throw new SearchTimeoutError();
        throw err;
      }
      results = this._parseNdjson(stdout, query);
      source = 'yt-dlp';
    }

    // Results keep YouTube's relevance order; publish-date sorting does not
    // apply to channels.
    const withUrls = results.map((r) => ({
      ...r,
      url: `https://www.youtube.com/channel/${r.channelId}`,
    }));
    await this._applySubscriptionStatus(withUrls);
    logger.info({ query, count, resultCount: withUrls.length, source }, 'channel search complete');
    return withUrls;
  }

  _parseNdjson(stdout, query) {
    const lines = stdout.split('\n');
    const results = [];
    const seenIds = new Set();
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const entry = JSON.parse(trimmed);
        const normalized = this._normalize(entry);
        if (!normalized.channelId || seenIds.has(normalized.channelId)) continue;
        seenIds.add(normalized.channelId);
        results.push(normalized);
      } catch (err) {
        logger.warn({ err, query, line: trimmed.slice(0, 200) }, 'skipping unparseable yt-dlp line');
      }
    }
    return results;
  }

  _normalize(entry) {
    let thumbnailUrl = Array.isArray(entry.thumbnails) && entry.thumbnails.length
      ? entry.thumbnails[entry.thumbnails.length - 1].url
      : null;
    if (thumbnailUrl && thumbnailUrl.startsWith('//')) {
      thumbnailUrl = `https:${thumbnailUrl}`;
    }
    const handle = typeof entry.uploader_id === 'string' && entry.uploader_id.startsWith('@')
      ? entry.uploader_id
      : null;
    return {
      channelId: entry.channel_id || entry.id || null,
      name: entry.channel || entry.title || entry.uploader || '',
      handle,
      thumbnailUrl,
      subscriberCount: typeof entry.channel_follower_count === 'number' ? entry.channel_follower_count : null,
      videoCount: typeof entry.playlist_count === 'number' ? entry.playlist_count : null,
      description: typeof entry.description === 'string' ? entry.description : null,
    };
  }

  async _applySubscriptionStatus(results) {
    for (const r of results) r.subscribed = false;
    const channelIds = results.map((r) => r.channelId).filter(Boolean);
    if (channelIds.length === 0) return;
    const existing = await Channel.findAll({
      where: { channel_id: channelIds, enabled: true },
      attributes: ['channel_id'],
    });
    const subscribedIds = new Set(existing.map((c) => c.channel_id));
    for (const r of results) {
      r.subscribed = subscribedIds.has(r.channelId);
    }
  }
}

module.exports = new ChannelSearchModule();
module.exports.SearchCanceledError = SearchCanceledError;
module.exports.SearchTimeoutError = SearchTimeoutError;
module.exports.ALLOWED_COUNTS = ALLOWED_COUNTS;
