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

// last_watched_at is a DATETIME without fractional seconds (MariaDB truncates,
// MySQL rounds), and percent_watched is a single-precision FLOAT the adapters
// round to one decimal; differences inside these tolerances are storage
// noise, not a change.
const LAST_WATCHED_TOLERANCE_MS = 1000;
const PERCENT_TOLERANCE = 0.05;

// Pulled back from the stored history cursor when computing the Plex
// incremental watermark, so an event on the boundary second is never missed.
const WATERMARK_OVERLAP_MS = 60_000;

// Trailing "[<youtube-id>].<ext>" token every Youtarr download carries
// (see filesystem/constants.js); same pattern the filesystem rescan uses.
const YOUTUBE_ID_SUFFIX_RE = /\[([^[\]]+)\]\.[a-z0-9]+$/i;

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

function sameNumber(stored, incoming, tolerance = 0) {
  if (stored == null || incoming == null) return stored == null && incoming == null;
  return Math.abs(Number(stored) - Number(incoming)) <= tolerance;
}

function sameTime(stored, incoming) {
  if (stored == null || incoming == null) return stored == null && incoming == null;
  return Math.abs(new Date(stored).getTime() - new Date(incoming).getTime()) < LAST_WATCHED_TOLERANCE_MS;
}

function hasWatchState(row) {
  return row.played
    || row.play_count > 0
    || row.position_ms > 0
    || row.percent_watched > 0
    || row.last_watched_at != null;
}

// Compares a row about to be written with the stored one as read back from
// the database (BOOLEAN as 0/1, BIGINT as a string). A missing row already
// reads as unwatched, so a first-seen row counts only if it records some
// watch state.
function rowChanged(stored, row) {
  if (!stored) return hasWatchState(row);
  return !!stored.played !== row.played
    || !sameNumber(stored.play_count, row.play_count)
    || !sameNumber(stored.position_ms, row.position_ms)
    || !sameNumber(stored.percent_watched, row.percent_watched, PERCENT_TOLERANCE)
    || !sameTime(stored.last_watched_at, row.last_watched_at);
}

const rowKey = (videoId, serverUserId) => `${videoId}:${serverUserId}`;

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

      // Missing (removed) videos are candidates too: the file may have moved
      // out of Youtarr's view but still exist on a media server and keep
      // accruing watch state.
      const videos = await Video.findAll({
        where: { filePath: { [Op.ne]: null } },
        attributes: ['id', 'youtubeId', 'filePath'],
        raw: true,
      });
      logger.info({ trigger, videoCount: videos.length, serverCount: adapters.length }, 'Starting watch status sync');

      // Across servers, so a video on two servers counts once.
      const checkedIds = new Set();
      const changedIds = new Set();
      for (const adapter of adapters) {
        const serverType = adapter.serverType;
        try {
          const opts = serverType === 'plex' ? await this._plexFetchOpts() : {};
          const { entries, users, historyCursor } = await adapter.fetchWatchStates(opts);
          const matches = this._matchVideos(videos, entries);
          const { rowsWritten, changedVideoIds } = await this._persist(serverType, matches);
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
          // User-facing counts are distinct videos, not (video, user) rows.
          const serverCheckedIds = new Set(matches.map((m) => m.video.id));
          serverCheckedIds.forEach((id) => checkedIds.add(id));
          changedVideoIds.forEach((id) => changedIds.add(id));
          const checked = serverCheckedIds.size;
          const changed = changedVideoIds.size;
          summary.servers[serverType] = { checked, changed };
          logger.info(
            { serverType, checked, changed, rowsWritten, entries: entries.length, users: users.length },
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
      summary.totals = { checked: checkedIds.size, changed: changedIds.size };
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

  // Match primarily by the trailing "[<youtube-id>].<ext>" filename token
  // (ids are globally unique), so files moved or renamed on the server side
  // still match; basename is the fallback. Ties go to the path closest to
  // the stored filePath (mount views differ between Youtarr and the
  // servers). A video matches ALL user entries of its best-scoring path,
  // not just one.
  _matchVideos(videos, entries) {
    const entriesByPath = new Map();
    for (const entry of entries) {
      if (!entriesByPath.has(entry.path)) entriesByPath.set(entry.path, []);
      entriesByPath.get(entry.path).push(entry);
    }
    const candidatesByBasename = new Map(); // base -> [{ path, segments }]
    const candidatesById = new Map(); // youtube id -> [{ path, segments }]
    for (const path of entriesByPath.keys()) {
      const base = extractBasename(path);
      if (!base) continue;
      const candidate = { path, segments: pathSegments(path) };
      if (!candidatesByBasename.has(base)) candidatesByBasename.set(base, []);
      candidatesByBasename.get(base).push(candidate);
      const idMatch = base.match(YOUTUBE_ID_SUFFIX_RE);
      if (idMatch) {
        if (!candidatesById.has(idMatch[1])) candidatesById.set(idMatch[1], []);
        candidatesById.get(idMatch[1]).push(candidate);
      }
    }
    const matches = [];
    for (const video of videos) {
      const candidates = candidatesById.get(video.youtubeId)
        || candidatesByBasename.get(extractBasename(video.filePath));
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

  // Returns the ids of videos with at least one new or changed row. Every row
  // is still written, so last_synced_at stays current.
  async _persist(serverType, matches) {
    if (matches.length === 0) return { rowsWritten: 0, changedVideoIds: new Set() };
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
    const changedVideoIds = await this._findChangedVideoIds(serverType, rows);
    for (let i = 0; i < rows.length; i += UPSERT_CHUNK_SIZE) {
      await VideoWatchStatus.bulkCreate(rows.slice(i, i + UPSERT_CHUNK_SIZE), {
        updateOnDuplicate: [
          'played', 'play_count', 'position_ms',
          'percent_watched', 'last_watched_at', 'last_synced_at', 'updatedAt',
        ],
      });
    }
    return { rowsWritten: rows.length, changedVideoIds };
  }

  // Read before any write, so a (video, user) key repeated across upsert
  // chunks is compared with its state from before this sync. A repeated key
  // is judged by its last row, the one the upsert keeps.
  async _findChangedVideoIds(serverType, rows) {
    const incoming = new Map(rows.map((row) => [rowKey(row.video_id, row.server_user_id), row]));
    const videoIds = [...new Set(rows.map((row) => row.video_id))];
    const stored = new Map();
    for (let i = 0; i < videoIds.length; i += UPSERT_CHUNK_SIZE) {
      const existing = await VideoWatchStatus.findAll({
        where: { server_type: serverType, video_id: { [Op.in]: videoIds.slice(i, i + UPSERT_CHUNK_SIZE) } },
        attributes: [
          'video_id', 'server_user_id', 'played', 'play_count',
          'position_ms', 'percent_watched', 'last_watched_at',
        ],
        raw: true,
      });
      for (const row of existing) stored.set(rowKey(row.video_id, row.server_user_id), row);
    }
    const changed = new Set();
    for (const [key, row] of incoming) {
      if (rowChanged(stored.get(key), row)) changed.add(row.video_id);
    }
    return changed;
  }
}

module.exports = new WatchStatusSync();
