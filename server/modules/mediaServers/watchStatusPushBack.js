/**
 * Push held watch state back to the media servers after a reorganize. Each
 * pending hold's video is looked up on its server by its current path, that
 * user's state of the item is read, and the snapshot (played, or the resume
 * position) is written unless the item already shows as much or more. The hold itself ends only when a later sync sees the state on the
 * item at the new path (watchStatusHolds.applyHolds), so a push the server
 * ignored is simply retried.
 *
 * Servers index moved files on their own schedule, so a push finds no item
 * until the library scan reaches it: the reorganize retries a few times
 * shortly after it finishes, and every watch-status sync retries holds whose
 * last attempt is old enough. Until then the stale item at the old path is
 * what a lookup finds (same file name; between TV folders the same show and
 * season folders too), so an item is only taken when it matches the new path
 * better than the old one. An explicit retry pushes to whatever matches.
 */

const { Op } = require('sequelize');
const Video = require('../../models/video');
const WatchStatusHold = require('../../models/watchstatushold');
const configModule = require('../configModule');
const serverRegistry = require('./serverRegistry');
const logger = require('../../logger');
const { describeHttpError } = require('./adapters/baseAdapter');
const { HOLD_STATE } = require('./watchStatusHolds');
const { isAtLeast, isLaterWatch } = require('./watchStateCompare');
const libraryLocator = require('./libraryLocator');

// A sync retries a hold whose last push did not take at most this often.
const PUSH_RETRY_INTERVAL_MS = 60 * 60 * 1000;
// After a reorganize: pushes while the servers scan the moved files.
const FOLLOW_UP_DELAYS_MS = [60 * 1000, 5 * 60 * 1000, 15 * 60 * 1000];
const NOT_INDEXED_MESSAGE = 'The media server has not indexed the moved file yet.';
const NOT_CONFIGURED_MESSAGE = 'This media server is no longer configured.';

function errorMessage(err) {
  if (err && err.isAxiosError) {
    const described = describeHttpError(err);
    return described.status ? `HTTP ${described.status}` : (described.message || 'Request failed');
  }
  return (err && err.message) || 'Unknown error';
}

/**
 * @param {Object} hold
 * @param {string|null} error
 * @param {Date} now
 * @param {Object} [options]
 * @param {boolean} [options.wrote] - The state was written to the server (not
 *   found already there): the sync reads the server's time stamp of it as an echo
 */
async function recordAttempt(hold, error, now, { wrote = false } = {}) {
  await hold.update({
    attempts: hold.attempts + 1,
    last_attempt_at: now,
    last_error: error,
    ...(wrote ? { last_pushed_at: now } : {}),
  });
}

// The item at the video's new path, or null while the only match is the
// stale item at the old path: the same item answers for both paths and fits
// the old one at least as well. Two different items mean the new file is
// indexed, whether or not the old one is still listed.
function indexedItemId(matches, newPath, fromPath, { explicit }) {
  const current = newPath ? matches.get(newPath) : null;
  if (!current || !current.id) return null;
  const previous = fromPath ? matches.get(fromPath) : null;
  if (!explicit && previous && previous.id === current.id && previous.score >= current.score) return null;
  return current.id;
}

/**
 * Push pending holds' state to their servers.
 *
 * A hold is pushed once; after a successful push it is pushed again only
 * when a sync found the item at the new path without the state
 * (watchStatusHolds.applyHolds records that as its last error). Pushing the
 * snapshot blindly again could undo a watch made in between.
 *
 * @param {Object} [options]
 * @param {number[]} [options.holdIds] - Only these holds (an explicit retry); pushed before or not
 * @param {boolean} [options.onlyDue=true] - Skip holds attempted within the retry interval
 * @param {Date} [options.now]
 * @returns {Promise<{pushed: number, notIndexed: number, failed: number}>}
 */
async function pushPendingHolds({ holdIds = null, onlyDue = true, now = new Date() } = {}) {
  const where = { state: HOLD_STATE.PENDING };
  if (holdIds) {
    where.id = holdIds;
  } else {
    const retry = { last_error: { [Op.ne]: null } };
    if (onlyDue) retry.last_attempt_at = { [Op.lt]: new Date(now.getTime() - PUSH_RETRY_INTERVAL_MS) };
    where[Op.or] = [{ last_attempt_at: null }, retry];
  }
  const holds = await WatchStatusHold.findAll({ where });
  const result = { pushed: 0, notIndexed: 0, failed: 0 };
  if (holds.length === 0) return result;

  const adapters = new Map(serverRegistry.getEnabledAdapters(configModule.getConfig())
    .map((adapter) => [adapter.serverType, adapter]));
  const videos = await Video.findAll({
    where: { id: [...new Set(holds.map((hold) => hold.video_id))] },
    attributes: ['id', 'filePath'],
    raw: true,
  });
  const pathOf = new Map(videos.map((video) => [video.id, video.filePath]));
  const fromPathOf = (hold) => JSON.parse(hold.snapshot).fromPath || null;
  const explicit = Boolean(holdIds);

  const byServer = new Map();
  for (const hold of holds) {
    if (!byServer.has(hold.server_type)) byServer.set(hold.server_type, []);
    byServer.get(hold.server_type).push(hold);
  }

  for (const [serverType, serverHolds] of byServer) {
    const adapter = adapters.get(serverType);
    if (!adapter) {
      for (const hold of serverHolds) await recordAttempt(hold, NOT_CONFIGURED_MESSAGE, now);
      result.failed += serverHolds.length;
      continue;
    }
    let matches;
    try {
      const paths = [...new Set(serverHolds.flatMap((hold) => [pathOf.get(hold.video_id), fromPathOf(hold)]).filter(Boolean))];
      // Only the libraries that hold Youtarr's folders, not every item on the server.
      matches = await adapter.resolveItemMatchesByPaths(paths, { libraryIds: await libraryLocator.scopeFor(adapter) });
    } catch (err) {
      logger.warn({ err: err && err.isAxiosError ? describeHttpError(err) : err, serverType }, 'Could not look up moved files on the media server');
      for (const hold of serverHolds) await recordAttempt(hold, errorMessage(err), now);
      result.failed += serverHolds.length;
      continue;
    }
    for (const hold of serverHolds) {
      const itemId = indexedItemId(matches, pathOf.get(hold.video_id), fromPathOf(hold), { explicit });
      if (!itemId) {
        await recordAttempt(hold, NOT_INDEXED_MESSAGE, now);
        result.notIndexed += 1;
        continue;
      }
      try {
        const snapshot = JSON.parse(hold.snapshot);
        // Never write over a state at least as watched, or watched since the
        // snapshot (the item was indexed and someone has watched it already).
        const current = await adapter.getWatchState(itemId, hold.server_user_id);
        const wrote = !current || !(isAtLeast(current, snapshot) || isLaterWatch(current, snapshot));
        if (wrote) await adapter.setWatchState(itemId, hold.server_user_id, snapshot);
        await recordAttempt(hold, null, now, { wrote });
        result.pushed += 1;
      } catch (err) {
        await recordAttempt(hold, errorMessage(err), now);
        result.failed += 1;
      }
    }
  }
  logger.info({ ...result }, 'Pushed held watch state to the media servers');
  return result;
}

/**
 * Push again a few times after a reorganize while the servers scan the
 * moved files. Timers are unref'd so they never hold the process open.
 *
 * @param {Object} [options]
 * @param {number[]} [options.delaysMs]
 * @param {(fn: Function, ms: number) => Object} [options.schedule]
 */
function scheduleFollowUps({ delaysMs = FOLLOW_UP_DELAYS_MS, schedule = setTimeout } = {}) {
  for (const delay of delaysMs) {
    const timer = schedule(() => {
      pushPendingHolds({ onlyDue: false }).catch((err) => {
        logger.error({ err }, 'Watch state push after a reorganize failed');
      });
    }, delay);
    if (timer && typeof timer.unref === 'function') timer.unref();
  }
}

module.exports = {
  PUSH_RETRY_INTERVAL_MS,
  FOLLOW_UP_DELAYS_MS,
  pushPendingHolds,
  scheduleFollowUps
};
