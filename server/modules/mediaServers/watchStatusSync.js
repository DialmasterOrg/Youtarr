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
const { Video, VideoWatchStatus, MediaServerUser, WatchStatusSyncCursor } = require('../../models');

// Rows per bulk upsert statement; keeps a 10k-video library from producing one
// giant INSERT.
const UPSERT_CHUNK_SIZE = 500;

// Pulled back from the stored history cursor when computing the Plex
// incremental watermark, so an event on the boundary second is never missed.
const WATERMARK_OVERLAP_MS = 60_000;

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

  // Pulls watch state from every enabled media server and upserts one row per
  // (video, server, user). Only items actually returned by a server are
  // written: a failed fetch or an unmatched file leaves existing rows
  // untouched, so a missing/stale row means "unknown", never "unwatched".
  // Never rejects for per-server failures; they are captured in the returned
  // summary.
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
        try {
          const opts = serverType === 'plex' ? await this._plexFetchOpts() : {};
          const { entries, users, historyCursor } = await adapter.fetchWatchStates(opts);
          const matches = this._matchVideos(videos, entries);
          const rowsWritten = await this._persist(serverType, matches);
          // Advance the durable cursor only after rows persisted, and only
          // when the adapter reports a safely-scanned-through time (null means
          // the window must be rescanned, e.g. a section listing failed).
          if (historyCursor) {
            await WatchStatusSyncCursor.upsert({ server_type: serverType, cursor: historyCursor });
          }
          // Store accounts LAST: an account becomes "known" (and therefore
          // stops triggering the full-history backfill) only once its rows and
          // the cursor are durably written. If anything above fails, the next
          // sync still sees the account as new and repeats the full pull;
          // every write here is an idempotent upsert, so repeats are safe.
          await this._upsertUsers(serverType, users);
          // `updated` is user-facing: distinct videos, not (video, user) rows.
          const updated = new Set(matches.map((m) => m.video.id)).size;
          summary.servers[serverType] = { updated };
          logger.info(
            { serverType, updated, rowsWritten, entries: entries.length, users: users.length },
            'Watch status sync completed for server'
          );
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

  // Fetch options for the Plex history pull: the durable cursor (the newest
  // history event previously scanned, matched or not, pulled back by
  // WATERMARK_OVERLAP_MS so a boundary event is never missed) plus the stored
  // account ids so the adapter can detect a new account and backfill it with
  // a full pull. since is null on the first run (full history pull); deleting
  // the cursor row forces a full re-scan.
  async _plexFetchOpts() {
    const row = await WatchStatusSyncCursor.findOne({ where: { server_type: 'plex' } });
    const since = row && row.cursor
      ? new Date(new Date(row.cursor).getTime() - WATERMARK_OVERLAP_MS)
      : null;
    const knownUsers = await MediaServerUser.findAll({
      where: { server_type: 'plex' },
      attributes: ['server_user_id'],
      raw: true,
    });
    return { since, knownUserIds: knownUsers.map((u) => u.server_user_id) };
  }

  // Account directory upsert; adapters return [] in single-user mode so
  // stored names are never clobbered.
  async _upsertUsers(serverType, users) {
    if (!users || users.length === 0) return;
    const rows = users.map((u) => ({
      server_type: serverType,
      server_user_id: String(u.id),
      server_user_name: u.name || null,
    }));
    await MediaServerUser.bulkCreate(rows, {
      updateOnDuplicate: ['server_user_name', 'updatedAt'],
    });
  }

  // Basename matching with trailing-segment disambiguation, the same strategy
  // the adapters use for file resolution (mount views differ between Youtarr
  // and the servers; YouTube ids in filenames are globally unique). Entries
  // are grouped by path first: several users' entries share one path, and a
  // video must match ALL entries of its best-scoring path, not just one.
  _matchVideos(videos, entries) {
    const entriesByPath = new Map();
    for (const entry of entries) {
      if (!entriesByPath.has(entry.path)) entriesByPath.set(entry.path, []);
      entriesByPath.get(entry.path).push(entry);
    }
    const candidatesByBasename = new Map(); // base -> [{ path, segments }]
    for (const path of entriesByPath.keys()) {
      const base = extractBasename(path);
      if (!base) continue;
      if (!candidatesByBasename.has(base)) candidatesByBasename.set(base, []);
      candidatesByBasename.get(base).push({ path, segments: pathSegments(path) });
    }
    const matches = [];
    for (const video of videos) {
      const candidates = candidatesByBasename.get(extractBasename(video.filePath));
      if (!candidates) continue;
      const targetSegments = pathSegments(video.filePath);
      let best = null;
      for (const candidate of candidates) {
        const score = trailingSegmentMatch(targetSegments, candidate.segments);
        if (!best || score > best.score) best = { path: candidate.path, score };
      }
      for (const entry of entriesByPath.get(best.path)) {
        matches.push({ video, entry });
      }
    }
    return matches;
  }

  async _persist(serverType, matches) {
    if (matches.length === 0) return 0;
    const now = new Date();
    const rows = matches.map(({ video, entry }) => ({
      video_id: video.id,
      server_type: serverType,
      server_user_id: entry.serverUserId,
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
          'played', 'play_count', 'position_ms',
          'percent_watched', 'last_watched_at', 'last_synced_at', 'updatedAt',
        ],
      });
    }
    return rows.length;
  }
}

module.exports = new WatchStatusSync();
