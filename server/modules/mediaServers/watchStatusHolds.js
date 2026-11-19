/**
 * Watch-state holds. When a reorganize moves a video's files, the media
 * servers see a new item: unwatched until Youtarr pushes the state back, and
 * until they rescan they still list the old path, which the sync's
 * current-copy rule rejects (resetting the row). A hold snapshots each
 * (video, server, user) row with watch state before the move and, while it
 * is active, the sync does not downgrade that row.
 *
 * A hold ends (restored) when the server reports state at least equal to the
 * snapshot, or a newer state, for the item at the video's current path. One
 * not restored within 14 days is marked failed; it keeps protecting the row
 * until the user dismisses it.
 *
 * Plex accounts other than the owner come from play history, which a move
 * never resets, so they get no hold.
 */

const { Op } = require('sequelize');
const WatchStatusHold = require('../../models/watchstatushold');
const VideoWatchStatus = require('../../models/videowatchstatus');
const Video = require('../../models/video');
const MediaServerUser = require('../../models/mediaserveruser');
const logger = require('../../logger');
const { pathSegments, trailingSegmentMatch } = require('./adapters/baseAdapter');
const { PLEX_OWNER_ACCOUNT_ID } = require('./adapters/plexAdapter');
const { timeOf, isAtLeast, isLaterWatch } = require('./watchStateCompare');

const HOLD_STATE = Object.freeze({
  PENDING: 'pending',
  RESTORED: 'restored',
  FAILED: 'failed',
  DISMISSED: 'dismissed',
});
// Holds that still protect their row.
const ACTIVE_STATES = [HOLD_STATE.PENDING, HOLD_STATE.FAILED];
const HOLD_TTL_MS = 14 * 24 * 60 * 60 * 1000;
// A server item is at the video's current path when its file and parent
// folder match (the sync's current-copy rule) and it matches the path the
// video came from less well: until the server rescans, the stale item at the
// old path shares the file name, and between two TV folders the show and
// season folders too.
const CURRENT_PATH_MIN_SEGMENTS = 2;
// A push stamps the server item with the push time as its last-watched time.
// A time this close to a successful push is that echo, not a new watch, so
// Youtarr's row keeps its historical play count and last-watched time.
const PUSH_ECHO_WINDOW_MS = 10 * 60 * 1000;
const EXPIRED_MESSAGE = 'The media server did not show this video as watched within 14 days of the move.';
const NOT_TAKEN_MESSAGE = 'The media server shows less than the held state; the push is repeated.';

function holdKey(videoId, serverUserId) {
  return `${videoId}:${serverUserId}`;
}

/**
 * Whether a stored watch-status row has state worth protecting.
 * @param {{server_type: string, server_user_id: string, played: boolean, position_ms: number|null}} row
 */
function isHoldable(row) {
  if (row.server_type === 'plex' && String(row.server_user_id) !== PLEX_OWNER_ACCOUNT_ID) return false;
  return Boolean(row.played) || Number(row.position_ms) > 0;
}

/**
 * @param {Object} row - video_watch_status row
 * @param {string|null} [fromPath] - The video's file path before the move
 */
function snapshotOf(row, fromPath = null) {
  return {
    played: Boolean(row.played),
    playCount: row.play_count || 0,
    positionMs: row.position_ms !== null && row.position_ms !== undefined ? Number(row.position_ms) : null,
    percentWatched: row.percent_watched !== null && row.percent_watched !== undefined ? Number(row.percent_watched) : null,
    lastWatchedAt: row.last_watched_at ? new Date(row.last_watched_at).toISOString() : null,
    fromPath: fromPath || null,
  };
}

// The stronger of two snapshots; the earlier hold's origin path is kept,
// since the stale item the servers may still list is the one at that path.
function mergeSnapshots(a, b) {
  const later = (x, y) => {
    if (!x) return y;
    if (!y) return x;
    return timeOf(x) >= timeOf(y) ? x : y;
  };
  const max = (x, y) => (x === null || x === undefined ? y : y === null || y === undefined ? x : Math.max(x, y));
  return {
    played: Boolean(a.played || b.played),
    playCount: max(a.playCount, b.playCount) || 0,
    positionMs: max(a.positionMs, b.positionMs),
    percentWatched: max(a.percentWatched, b.percentWatched),
    lastWatchedAt: later(a.lastWatchedAt, b.lastWatchedAt),
    fromPath: a.fromPath || b.fromPath || null,
  };
}

// When the hold's state was last written to the server, or null. An attempt
// that found the state already there wrote nothing and leaves no echo.
function pushedAt(hold) {
  return hold.last_pushed_at ? timeOf(hold.last_pushed_at) : null;
}

// The entry's last-watched time is the server echoing a push, not a watch.
function isPushEcho(entry, hold) {
  const pushTime = pushedAt(hold);
  const entryTime = timeOf(entry.lastWatchedAt);
  return pushTime !== null && entryTime !== null && Math.abs(entryTime - pushTime) <= PUSH_ECHO_WINDOW_MS;
}

// A real change made after the snapshot: finished, or watched later, the
// server's echo of Youtarr's own push excepted.
function isNewer(entry, snapshot, hold = null) {
  if (entry.played && !snapshot.played) return true;
  if (hold && isPushEcho(entry, hold)) return false;
  return isLaterWatch(entry, snapshot);
}

// The entry with the row's history: a restored state carries the server's
// count of one and the push time, which must not replace the real ones.
function withHistory(entry, snapshot) {
  return {
    ...entry,
    playCount: Math.max(entry.playCount || 0, snapshot.playCount || 0),
    lastWatchedAt: snapshot.lastWatchedAt || entry.lastWatchedAt || null,
  };
}

function isAtCurrentPath(entry, video, fromPath) {
  if (!entry.path || !video.filePath) return false;
  const entrySegments = pathSegments(entry.path);
  const current = trailingSegmentMatch(entrySegments, pathSegments(video.filePath));
  if (current < CURRENT_PATH_MIN_SEGMENTS) return false;
  return !fromPath || current > trailingSegmentMatch(entrySegments, pathSegments(fromPath));
}

/**
 * Snapshot the watch state of videos about to move.
 *
 * @param {Object} params
 * @param {number|null} params.operationId
 * @param {number[]} params.videoIds - Videos.id values
 * @param {Date} [params.now]
 * @returns {Promise<number>} Holds created or refreshed
 */
async function createHolds({ operationId, videoIds, now = new Date() }) {
  if (videoIds.length === 0) return 0;
  const rows = (await VideoWatchStatus.findAll({
    where: { video_id: videoIds, [Op.or]: [{ played: true }, { position_ms: { [Op.gt]: 0 } }] },
    raw: true,
  })).filter(isHoldable);
  if (rows.length === 0) return 0;

  const heldVideoIds = [...new Set(rows.map((row) => row.video_id))];
  const [existing, videos] = await Promise.all([
    WatchStatusHold.findAll({ where: { video_id: heldVideoIds } }),
    Video.findAll({ where: { id: heldVideoIds }, attributes: ['id', 'filePath'], raw: true }),
  ]);
  const existingByKey = new Map(existing.map((hold) => [`${hold.server_type}:${holdKey(hold.video_id, hold.server_user_id)}`, hold]));
  const pathBefore = new Map(videos.map((video) => [video.id, video.filePath]));
  const expiresAt = new Date(now.getTime() + HOLD_TTL_MS);
  for (const row of rows) {
    const snapshot = snapshotOf(row, pathBefore.get(row.video_id));
    const hold = existingByKey.get(`${row.server_type}:${holdKey(row.video_id, row.server_user_id)}`);
    if (hold) {
      // A hold still active from an earlier move keeps the stronger state:
      // the row it protected may be all that is left of it. Its push record
      // starts over: the files move again, so an earlier push (to the
      // earlier location) says nothing about the new one, and a hold pushed
      // successfully once would otherwise never be pushed again.
      const merged = ACTIVE_STATES.includes(hold.state) ? mergeSnapshots(JSON.parse(hold.snapshot), snapshot) : snapshot;
      await hold.update({
        snapshot: JSON.stringify(merged), state: HOLD_STATE.PENDING, operation_id: operationId,
        expires_at: expiresAt, attempts: 0, last_attempt_at: null, last_pushed_at: null, last_error: null,
      });
    } else {
      await WatchStatusHold.create({
        video_id: row.video_id,
        server_type: row.server_type,
        server_user_id: String(row.server_user_id),
        operation_id: operationId,
        snapshot: JSON.stringify(snapshot),
        state: HOLD_STATE.PENDING,
        expires_at: expiresAt,
      });
    }
  }
  return rows.length;
}

/**
 * Filter a sync's matches for one server before they are written: drop
 * downgrades of held rows, end holds the server now reports as restored,
 * ask for another push where a pushed state did not take, and keep the row's
 * history (play count, last watched) where the server only echoes a push,
 * for restored holds too.
 *
 * @param {string} serverType
 * @param {Array<{video: {id: number, filePath: string}, entry: Object}>} matches
 * @returns {Promise<Array<Object>>} The matches to write
 */
async function applyHolds(serverType, matches) {
  if (matches.length === 0) return matches;
  const holds = await WatchStatusHold.findAll({
    where: {
      server_type: serverType,
      state: [...ACTIVE_STATES, HOLD_STATE.RESTORED],
      video_id: [...new Set(matches.map(({ video }) => video.id))],
    },
  });
  if (holds.length === 0) return matches;

  const holdsByKey = new Map(holds.map((hold) => [holdKey(hold.video_id, hold.server_user_id), hold]));
  const restored = [];
  const notTaken = [];
  const kept = [];
  for (const match of matches) {
    const hold = holdsByKey.get(holdKey(match.video.id, String(match.entry.serverUserId)));
    if (!hold) {
      kept.push(match);
      continue;
    }
    const snapshot = JSON.parse(hold.snapshot);
    const { entry } = match;
    const newer = isNewer(entry, snapshot, hold);
    const written = newer ? entry : withHistory(entry, snapshot);
    if (hold.state === HOLD_STATE.RESTORED) {
      kept.push(written === entry ? match : { ...match, entry: written });
      continue;
    }
    const atCurrentPath = isAtCurrentPath(entry, match.video, snapshot.fromPath);
    if (atCurrentPath && (isAtLeast(entry, snapshot) || newer)) {
      restored.push(hold.id);
      kept.push(written === entry ? match : { ...match, entry: written });
    } else if (newer || isAtLeast(entry, snapshot)) {
      kept.push(match);
    } else if (atCurrentPath && hold.attempts > 0 && !hold.last_error) {
      // The item at the new path shows less than the state an attempt found
      // or wrote there: it is pushed again.
      notTaken.push(hold.id);
    }
    // Anything else would lower the protected state: Youtarr keeps its row.
  }
  if (restored.length > 0) {
    await WatchStatusHold.update(
      { state: HOLD_STATE.RESTORED, last_error: null },
      { where: { id: [...new Set(restored)] } }
    );
    logger.info({ serverType, restored: restored.length }, 'Watch state restored on the media server after a reorganize');
  }
  if (notTaken.length > 0) {
    await WatchStatusHold.update({ last_error: NOT_TAKEN_MESSAGE }, { where: { id: [...new Set(notTaken)] } });
  }
  return kept;
}

/**
 * Release the holds an operation took for videos it did not move: their
 * files are where the servers already know them, so the servers' state is
 * accurate again.
 * @param {Object} params
 * @param {number} params.operationId
 * @param {number[]} params.videoIds - Videos.id values
 * @returns {Promise<number>}
 */
async function releaseUnmovedHolds({ operationId, videoIds }) {
  if (videoIds.length === 0) return 0;
  const [count] = await WatchStatusHold.update(
    { state: HOLD_STATE.DISMISSED },
    { where: { operation_id: operationId, video_id: videoIds, state: ACTIVE_STATES } }
  );
  return count;
}

/**
 * Mark pending holds past their deadline as failed restores.
 * @returns {Promise<number>}
 */
async function expireHolds(now = new Date()) {
  const [count] = await WatchStatusHold.update(
    { state: HOLD_STATE.FAILED, last_error: EXPIRED_MESSAGE },
    { where: { state: HOLD_STATE.PENDING, expires_at: { [Op.lt]: now } } }
  );
  return count;
}

/**
 * @param {Object} [options]
 * @param {string[]} [options.states] - Defaults to the active states
 * @param {number} [options.limit]
 */
async function listHolds({ states = ACTIVE_STATES, limit = 500 } = {}) {
  return WatchStatusHold.findAll({ where: { state: states }, order: [['updated_at', 'DESC']], limit });
}

/**
 * Holds for the restore list: each with its video's title and the server
 * user's name.
 * @param {Object} [options] - listHolds options
 */
async function describeHolds(options = {}) {
  const holds = await listHolds(options);
  if (holds.length === 0) return [];
  const [videos, users] = await Promise.all([
    Video.findAll({
      where: { id: [...new Set(holds.map((hold) => hold.video_id))] },
      attributes: ['id', 'youtubeId', 'youTubeVideoName', 'youTubeChannelName'],
      raw: true,
    }),
    MediaServerUser.findAll({ attributes: ['server_type', 'server_user_id', 'server_user_name'], raw: true }),
  ]);
  const videoById = new Map(videos.map((video) => [video.id, video]));
  const userName = new Map(users.map((user) => [`${user.server_type}:${user.server_user_id}`, user.server_user_name]));
  return holds.map((hold) => {
    const video = videoById.get(hold.video_id) || {};
    const snapshot = JSON.parse(hold.snapshot);
    return {
      id: hold.id,
      state: hold.state,
      serverType: hold.server_type,
      serverUserId: hold.server_user_id,
      serverUserName: userName.get(`${hold.server_type}:${hold.server_user_id}`) || null,
      youtubeId: video.youtubeId || null,
      title: video.youTubeVideoName || null,
      channelName: video.youTubeChannelName || null,
      played: Boolean(snapshot.played),
      positionMs: snapshot.positionMs,
      attempts: hold.attempts,
      lastAttemptAt: hold.last_attempt_at,
      lastError: hold.last_error,
      expiresAt: hold.expires_at,
    };
  });
}

async function countHolds() {
  const rows = await WatchStatusHold.findAll({
    where: { state: ACTIVE_STATES },
    attributes: ['state'],
    raw: true,
  });
  return {
    pending: rows.filter((row) => row.state === HOLD_STATE.PENDING).length,
    failed: rows.filter((row) => row.state === HOLD_STATE.FAILED).length,
  };
}

/**
 * Stop protecting a row: the user accepts the server's state.
 * @returns {Promise<boolean>} false when the hold does not exist
 */
async function dismissHold(id) {
  const hold = await WatchStatusHold.findByPk(id);
  if (!hold) return false;
  await hold.update({ state: HOLD_STATE.DISMISSED });
  return true;
}

/**
 * Give a failed restore another 14 days and make it due for a push now.
 * @returns {Promise<Object|null>} The hold, or null when it does not exist
 */
async function reopenHold(id, now = new Date()) {
  const hold = await WatchStatusHold.findByPk(id);
  if (!hold) return null;
  await hold.update({
    state: HOLD_STATE.PENDING, last_error: null, last_attempt_at: null,
    expires_at: new Date(now.getTime() + HOLD_TTL_MS),
  });
  return hold;
}

module.exports = {
  HOLD_STATE,
  ACTIVE_STATES,
  HOLD_TTL_MS,
  isHoldable,
  snapshotOf,
  mergeSnapshots,
  isAtLeast,
  isNewer,
  createHolds,
  applyHolds,
  releaseUnmovedHolds,
  expireHolds,
  listHolds,
  describeHolds,
  countHolds,
  dismissHold,
  reopenHold
};
