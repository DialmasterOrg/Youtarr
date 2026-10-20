const ytDlpRunner = require('./ytDlpRunner');
const ytdlpCommandBuilder = require('./download/ytdlpCommandBuilder');
const logger = require('../logger');
const { applyLocalVideoStatus } = require('./videoLocalStatus');
const youtubeApi = require('./youtubeApi');

const SEARCH_TIMEOUT_MS = 60_000;
const ALLOWED_COUNTS = [10, 25, 50, 100];
const LIVE_STATUSES_TO_SKIP = new Set(['is_live', 'is_upcoming']);

class SearchCanceledError extends Error {
  constructor() { super('Search canceled'); this.name = 'SearchCanceledError'; }
}
class SearchTimeoutError extends Error {
  constructor() { super('Search timed out'); this.name = 'SearchTimeoutError'; }
}

class VideoSearchModule {
  async searchVideos(query, count, { signal } = {}) {
    if (!ALLOWED_COUNTS.includes(count)) {
      throw new Error(`count must be one of ${ALLOWED_COUNTS.join(', ')}`);
    }

    let results = null;
    let source = null;

    if (youtubeApi.isAvailable()) {
      try {
        const apiKey = youtubeApi.getApiKey();
        const apiResults = await youtubeApi.client.searchVideos(apiKey, query, count, { signal });
        results = apiResults;
        source = 'youtube-api';
      } catch (apiErr) {
        if (apiErr?.code === youtubeApi.YoutubeApiErrorCode.CANCELED) {
          throw new SearchCanceledError();
        }
        logger.warn(
          { err: apiErr, query, code: apiErr?.code },
          'YouTube API searchVideos failed, falling back to yt-dlp'
        );
      }
    }

    if (results === null) {
      const args = ytdlpCommandBuilder.buildSearchArgs(query, count);
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

    // Results stay in the order the source returned them: YouTube's relevance
    // ranking is the one thing a client cannot recompute, so every other order
    // is the client's to apply.
    if (results.length > 0) await this._applyLocalStatus(results);
    logger.info({ query, count, resultCount: results.length, source }, 'video search complete');
    return results;
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
        // The API path drops these too; a download would record a live stream indefinitely.
        if (LIVE_STATUSES_TO_SKIP.has(entry.live_status)) continue;
        const normalized = this._normalize(entry);
        if (normalized.youtubeId && seenIds.has(normalized.youtubeId)) continue;
        if (normalized.youtubeId) seenIds.add(normalized.youtubeId);
        results.push(normalized);
      } catch (err) {
        logger.warn({ err, query, line: trimmed.slice(0, 200) }, 'skipping unparseable yt-dlp line');
      }
    }
    return results;
  }

  _normalize(entry) {
    const thumbnailUrl = entry.thumbnail
      || (Array.isArray(entry.thumbnails) && entry.thumbnails.length
        ? entry.thumbnails[entry.thumbnails.length - 1].url
        : null);
    const publishedAt = this._derivePublishedAt(entry);
    return {
      youtubeId: entry.id,
      title: entry.title || '',
      channelName: entry.channel || entry.uploader || '',
      channelId: entry.channel_id || null,
      duration: typeof entry.duration === 'number' ? entry.duration : null,
      thumbnailUrl,
      publishedAt,
      viewCount: typeof entry.view_count === 'number' ? entry.view_count : null,
      status: 'never_downloaded',
    };
  }

  _derivePublishedAt(entry) {
    if (typeof entry.timestamp === 'number' && entry.timestamp > 0) {
      return new Date(entry.timestamp * 1000).toISOString();
    }
    if (typeof entry.release_timestamp === 'number' && entry.release_timestamp > 0) {
      return new Date(entry.release_timestamp * 1000).toISOString();
    }
    if (typeof entry.upload_date === 'string' && /^\d{8}$/.test(entry.upload_date)) {
      const y = entry.upload_date.slice(0, 4);
      const m = entry.upload_date.slice(4, 6);
      const d = entry.upload_date.slice(6, 8);
      const iso = `${y}-${m}-${d}T00:00:00.000Z`;
      const parsed = new Date(iso);
      if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
    }
    return null;
  }

  async _applyLocalStatus(results) {
    await applyLocalVideoStatus(results);
  }
}

module.exports = new VideoSearchModule();
module.exports.SearchCanceledError = SearchCanceledError;
module.exports.SearchTimeoutError = SearchTimeoutError;
module.exports.ALLOWED_COUNTS = ALLOWED_COUNTS;
