// The opt-in "remove after import" setting: once Sonarr or Radarr has a grab's
// file in its own library, Youtarr removes the copy it downloaded for that
// grab. The app sends the same history delete after an import and after a
// removal there, so the only proof of an import is the app's own history,
// read through the connection the user set up. Without that proof the copy
// is kept. A video that was in the library before the grab is never touched.
const { Op } = require('sequelize');
const { REMOVAL_REASONS } = require('../videoRemovalState');

// A grab that cannot be settled (the app does not answer, the delete is
// refused) is looked at again on later sweeps for this long, then keeps its copy.
const GIVE_UP_MS = 24 * 60 * 60 * 1000;
const BATCH_SIZE = 20;
// Grabs in these states still need the library file to stage from.
const WAITING_STATUSES = ['pending', 'queued'];
const APPS = { tv: { key: 'sonarr', name: 'Sonarr' }, movie: { key: 'radarr', name: 'Radarr' } };

// arr_bridge_grabs.library_copy. Null: the video was in the library before
// the grab, or the grab never downloaded.
const LIBRARY_COPY = Object.freeze({
  OWNED: 'owned',
  REMOVE: 'remove',
  REMOVED: 'removed',
  KEPT: 'kept',
});
const SETTLED = new Set([LIBRARY_COPY.REMOVED, LIBRARY_COPY.KEPT]);
const WAIT = Symbol('wait');
const SETTLED_MESSAGES = {
  [LIBRARY_COPY.REMOVED]: 'Removed the library copy of an imported Sonarr/Radarr grab',
  [LIBRARY_COPY.KEPT]: 'Kept the library copy of a Sonarr/Radarr grab',
  null: 'The video of a Sonarr/Radarr grab had already left the library',
};

/**
 * What the Settings page shows about a grab's library copy.
 * @param {Object} row - An arr_bridge_grabs row
 * @returns {'checking'|'removed'|'kept'|null} Null when nothing was asked of it
 */
function libraryCopyView(row) {
  if (row.library_copy === LIBRARY_COPY.REMOVE) return 'checking';
  return SETTLED.has(row.library_copy) ? row.library_copy : null;
}

/**
 * @param {Object} deps
 * @param {Object} deps.models - { ArrBridgeGrab, Video }
 * @param {Object} deps.client - arrClient
 * @param {Function} deps.getSettings - () => arrBridgeConfig.readSettings(config)
 * @param {Function} deps.removeVideo - (youtubeId, removal) => Promise<boolean>; true when the copy is gone
 * @param {Function} [deps.now]
 * @param {Object} deps.logger
 */
function createLibraryCopyRemover({ models, client, getSettings, removeVideo, now = () => new Date(), logger }) {
  const { ArrBridgeGrab, Video } = models;

  const settle = (grab, libraryCopy) => ArrBridgeGrab.update(
    { library_copy: libraryCopy, updated_at: now() },
    { where: { id: grab.id, library_copy: LIBRARY_COPY.REMOVE } }
  );

  /**
   * Called once the app took a completed grab out of its history, or the
   * grab's staged file expired.
   * @param {Object} grab - The arr_bridge_grabs row, now removed
   */
  async function request(grab) {
    if (!getSettings().removeAfterImport || grab.library_copy !== LIBRARY_COPY.OWNED) return;
    await ArrBridgeGrab.update(
      { library_copy: LIBRARY_COPY.REMOVE, updated_at: now() },
      { where: { id: grab.id, status: 'removed', library_copy: LIBRARY_COPY.OWNED } }
    );
  }

  // Whether the app that grabs this kind recorded an import of the grab.
  async function importVerdict(grab, unreachableApps) {
    const app = APPS[grab.kind].key;
    const connection = getSettings()[app];
    if (!connection) return 'unconfirmed';
    // An app that does not answer is asked once in a run, not once per grab:
    // each attempt can take the client's full time limit.
    if (unreachableApps.has(app)) return 'unknown';
    try {
      return (await client.fetchImported(connection, grab.id)) ? 'imported' : 'unconfirmed';
    } catch (error) {
      unreachableApps.add(app);
      // Never the error object: an HTTP client's error holds the key.
      logger.info({ grabId: grab.id, reason: error?.reason }, 'Could not ask Sonarr/Radarr whether a grab was imported');
      return 'unknown';
    }
  }

  // The library_copy value to record, or WAIT to look again on a later sweep.
  async function decide(grab, unreachableApps) {
    if (!getSettings().removeAfterImport) return LIBRARY_COPY.KEPT;
    const video = await Video.findOne({
      where: { youtubeId: grab.youtube_id, removed: false },
      attributes: ['youtubeId'],
    });
    // The video already left the library some other way: nothing to remove,
    // and nothing to say about this grab.
    if (!video) return null;

    const waiting = await ArrBridgeGrab.findAll({
      where: {
        youtube_id: grab.youtube_id,
        id: { [Op.ne]: grab.id },
        status: { [Op.in]: WAITING_STATUSES },
      },
      attributes: ['id'],
    });
    if (waiting.length > 0) return WAIT;

    const verdict = await importVerdict(grab, unreachableApps);
    if (verdict === 'unknown') return WAIT;
    if (verdict === 'unconfirmed') return LIBRARY_COPY.KEPT;

    const removed = await removeVideo(grab.youtube_id, {
      reason: REMOVAL_REASONS.AUTO_REMOVAL,
      detail: `after ${APPS[grab.kind].name} imported it`,
    });
    return removed ? LIBRARY_COPY.REMOVED : WAIT;
  }

  async function settleGrab(grab, unreachableApps) {
    let libraryCopy = await decide(grab, unreachableApps);
    if (libraryCopy === WAIT) {
      const waited = now().getTime() - new Date(grab.removed_at).getTime();
      if (!(waited >= GIVE_UP_MS)) {
        // To the back of the line, so grabs that wait cannot starve the rest.
        await ArrBridgeGrab.update(
          { updated_at: now() },
          { where: { id: grab.id, library_copy: LIBRARY_COPY.REMOVE } }
        );
        return;
      }
      libraryCopy = LIBRARY_COPY.KEPT;
    }
    if ((await settle(grab, libraryCopy))[0] !== 1) return;
    logger.info({ grabId: grab.id, youtubeId: grab.youtube_id, libraryCopy }, SETTLED_MESSAGES[libraryCopy]);
  }

  /** Settles the grabs waiting for a verdict. Runs at the end of each executor sweep. */
  async function run() {
    const grabs = await ArrBridgeGrab.findAll({
      where: { library_copy: LIBRARY_COPY.REMOVE },
      order: [['updated_at', 'ASC'], ['id', 'ASC']],
      limit: BATCH_SIZE,
    });
    const unreachableApps = new Set();
    for (const grab of grabs) {
      try {
        await settleGrab(grab, unreachableApps);
      } catch (error) {
        logger.warn({ err: error, grabId: grab.id }, 'Could not remove the library copy of a Sonarr/Radarr grab');
      }
    }
  }

  return { request, run };
}

module.exports = { createLibraryCopyRemover, libraryCopyView, LIBRARY_COPY };
