const { Op } = require('sequelize');
const logger = require('../../logger');
const configModule = require('../configModule');
const serverRegistry = require('./serverRegistry');
const {
  extractBasename,
  pathSegments,
  trailingSegmentMatch,
  describeHttpError,
  MediaServerUnavailableError,
  WatchStateFetchError,
} = require('./adapters/baseAdapter');
const { Video, VideoWatchStatus } = require('../../models');

// Config key holding the account whose watch state we read. Plex has no entry:
// its state belongs to the admin token's account, recorded as null.
const SERVER_USER_CONFIG_KEY = {
  jellyfin: 'jellyfinUserId',
  emby: 'embyUserId',
};

// Rows per bulk upsert statement; keeps a 10k-video library from producing one
// giant INSERT.
const UPSERT_CHUNK_SIZE = 500;

// Reduce an arbitrary sync failure to a message safe to render in the UI.
// Adapter-produced errors are already user-presentable; raw HTTP failures keep
// only their status; anything else (Sequelize, programming errors) is
// genericized so implementation details never reach the summary. The caller
// logs the full error object alongside.
function clientErrorMessage(err) {
  if (err instanceof MediaServerUnavailableError) return 'server not reachable or not responding';
  if (err instanceof WatchStateFetchError) return err.message;
  if (err && err.isAxiosError) {
    const status = err.response?.status;
    return status ? `request failed (HTTP ${status})` : `request failed (${err.code || 'network error'})`;
  }
  return 'internal error during sync; check Youtarr logs';
}

class WatchStatusSync {
  constructor() {
    this._running = false;
    this._lastRun = null;
  }

  getStatus() {
    return { running: this._running, lastRun: this._lastRun };
  }

  // Watch-status rows for one video, shaped for the API. Returns [] for an
  // unknown video. Rows are deliberately retained even after a video stops
  // being observed on a server (deleted, moved, server disconnected): like
  // `removed` Videos rows, stale watch history is still a true observation,
  // and last_synced_at records its freshness.
  async getStatusesForVideo(youtubeId) {
    const video = await Video.findOne({ where: { youtubeId }, attributes: ['id'] });
    if (!video) return [];
    const rows = await VideoWatchStatus.findAll({
      where: { video_id: video.id },
      order: [['server_type', 'ASC']],
    });
    return rows.map((row) => ({
      server: row.server_type,
      played: !!row.played,
      playCount: row.play_count,
      percentWatched: row.percent_watched,
      lastWatchedAt: row.last_watched_at,
      lastSyncedAt: row.last_synced_at,
    }));
  }

  // Pulls watch state from every enabled media server and upserts one row per
  // (video, server). Only items actually returned by a server are written:
  // a failed fetch or an unmatched file leaves existing rows untouched, so a
  // missing/stale row means "unknown", never "unwatched". Never rejects for
  // per-server failures; they are captured in the returned summary.
  async syncAll(trigger = 'scheduled') {
    if (this._running) {
      return { skipped: 'already running', trigger };
    }
    this._running = true;
    const summary = { trigger, startedAt: new Date().toISOString(), completedAt: null, servers: {} };
    try {
      const config = configModule.getConfig();
      const adapters = serverRegistry.getEnabledAdapters(config);
      if (adapters.length === 0) {
        summary.skipped = 'no media servers configured';
        return summary;
      }

      const videos = await Video.findAll({
        where: { removed: false, filePath: { [Op.ne]: null } },
        attributes: ['id', 'filePath'],
        raw: true,
      });
      logger.info({ trigger, videoCount: videos.length, serverCount: adapters.length }, 'Starting watch status sync');

      for (const adapter of adapters) {
        const serverType = adapter.serverType;
        const userKey = SERVER_USER_CONFIG_KEY[serverType];
        const serverUserId = userKey ? config[userKey] || null : null;
        try {
          const entries = await adapter.fetchWatchStates();
          const matches = this._matchVideos(videos, entries);
          const updated = await this._persist(serverType, serverUserId, matches);
          summary.servers[serverType] = { updated };
          logger.info({ serverType, updated, entries: entries.length }, 'Watch status sync completed for server');
        } catch (err) {
          const message = clientErrorMessage(err);
          summary.servers[serverType] = { error: message };
          // Raw axios errors carry the request config (API tokens in
          // headers/params), which the default err serializer would dump into
          // the logs; log the compact log-safe view for those. Non-HTTP
          // errors keep full fidelity.
          const logErr = err && err.isAxiosError ? describeHttpError(err) : err;
          logger.warn({ err: logErr, serverType }, 'Watch status sync failed for server');
        }
      }
      return summary;
    } catch (err) {
      const logErr = err && err.isAxiosError ? describeHttpError(err) : err;
      logger.error({ err: logErr, trigger }, 'Watch status sync failed');
      summary.error = clientErrorMessage(err);
      return summary;
    } finally {
      summary.completedAt = new Date().toISOString();
      this._lastRun = summary;
      this._running = false;
    }
  }

  // Basename matching with trailing-segment disambiguation, the same strategy
  // the adapters use for file resolution (mount views differ between Youtarr
  // and the servers; YouTube ids in filenames are globally unique).
  _matchVideos(videos, entries) {
    const candidatesByBasename = new Map();
    for (const entry of entries) {
      const base = extractBasename(entry.path);
      if (!base) continue;
      if (!candidatesByBasename.has(base)) candidatesByBasename.set(base, []);
      candidatesByBasename.get(base).push({ entry, segments: pathSegments(entry.path) });
    }
    const matches = [];
    for (const video of videos) {
      const candidates = candidatesByBasename.get(extractBasename(video.filePath));
      if (!candidates) continue;
      const targetSegments = pathSegments(video.filePath);
      let best = null;
      for (const candidate of candidates) {
        const score = trailingSegmentMatch(targetSegments, candidate.segments);
        if (!best || score > best.score) best = { entry: candidate.entry, score };
      }
      matches.push({ video, entry: best.entry });
    }
    return matches;
  }

  async _persist(serverType, serverUserId, matches) {
    if (matches.length === 0) return 0;
    const now = new Date();
    const rows = matches.map(({ video, entry }) => ({
      video_id: video.id,
      server_type: serverType,
      server_user_id: serverUserId,
      played: !!entry.played,
      play_count: entry.playCount || 0,
      position_ms: entry.positionMs != null ? entry.positionMs : null,
      percent_watched: entry.percentWatched != null ? entry.percentWatched : null,
      last_watched_at: entry.lastWatchedAt || null,
      last_synced_at: now,
    }));
    for (let i = 0; i < rows.length; i += UPSERT_CHUNK_SIZE) {
      await VideoWatchStatus.bulkCreate(rows.slice(i, i + UPSERT_CHUNK_SIZE), {
        updateOnDuplicate: [
          'server_user_id', 'played', 'play_count', 'position_ms',
          'percent_watched', 'last_watched_at', 'last_synced_at', 'updatedAt',
        ],
      });
    }
    return rows.length;
  }
}

module.exports = new WatchStatusSync();
