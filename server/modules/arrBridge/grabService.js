// Reads and writes of the grab table for the SABnzbd surface. The slow work
// (queueing the download, staging the file) belongs to grabExecutor.
const crypto = require('crypto');
const { Op } = require('sequelize');
const { FAILED_GRAB_GUARD_DAYS, isValidCategoryName } = require('./arrBridgeConfig');
const { readListQuery } = require('./listQuery');

const WAITING_STATUSES = ['pending', 'queued'];
const FINISHED_STATUSES = ['completed', 'failed'];
// A release in one of these states owns its staging folder.
const ACTIVE_STATUSES = ['pending', 'queued', 'completed'];
const MAX_QUEUE_ROWS = 200;
const DEFAULT_HISTORY_LIMIT = 60;
const MAX_HISTORY_LIMIT = 200;
const DAY_MS = 24 * 60 * 60 * 1000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isGrabId = (id) => typeof id === 'string' && UUID_PATTERN.test(id);

function clampLimit(limit, fallback, max) {
  const parsed = Number.parseInt(limit, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

const clampHistoryLimit = (limit) => clampLimit(limit, DEFAULT_HISTORY_LIMIT, MAX_HISTORY_LIMIT);

/**
 * What a grab row means to the user. The app removes a history item after
 * it imported the file and also when the user removed it there, with the
 * same call, so a removed grab that completed is "handed off", not "imported".
 * A failed one is removed within a minute and keeps its failure message.
 * A pending grab is "blocked" while YouTube blocks downloads: its own was
 * blocked, or another grab's was and this one waits with it.
 * @param {Object} row - An arr_bridge_grabs row
 * @param {Object} [options]
 * @param {boolean} [options.blockActive] - grabExecutor.blockStatus().active
 * @returns {'waiting'|'blocked'|'downloading'|'ready'|'failed'|'handed-off'|'cancelled'}
 */
function grabState(row, { blockActive = false } = {}) {
  if (row.status === 'pending') return row.blocked_at || blockActive ? 'blocked' : 'waiting';
  if (row.status === 'queued') return 'downloading';
  if (row.status === 'completed') return 'ready';
  if (row.status === 'failed' || row.fail_message) return 'failed';
  return row.completed_at ? 'handed-off' : 'cancelled';
}

/**
 * @param {Object} deps
 * @param {Object} deps.models - { ArrBridgeGrab, Video }
 * @param {Function} deps.getSettings - () => arrBridgeConfig.readSettings(config)
 * @param {Object} deps.staging
 * @param {Function} deps.wakeExecutor - Runs a new grab without waiting for the sweep
 * @param {Function} [deps.onHandedOff] - (grab) => Promise; the app took a completed grab out of its history
 * @param {Function} [deps.now]
 * @param {Object} deps.logger
 * @param {Function} [deps.newId]
 */
function createGrabService({
  models, getSettings, staging, wakeExecutor, onHandedOff = async () => {}, now = () => new Date(), logger,
  newId = crypto.randomUUID,
}) {
  const { ArrBridgeGrab, Video } = models;

  const categoryFilter = (category) => (typeof category === 'string' && category ? { category } : {});

  /**
   * @param {Object} grab
   * @param {Object} grab.fields - Validated fields from the carrier NZB
   * @param {string} grab.category - The SABnzbd category the client sent
   * @returns {Promise<{id: string}|{error: string}>}
   */
  async function addGrab({ fields, category }) {
    if (!getSettings().categories.some((entry) => entry.name === category)) {
      const shown = isValidCategoryName(category) ? ` ${category}` : '';
      return { error: `Category${shown} is not configured in Youtarr` };
    }
    // One staging folder per category and release title, so a release that
    // is already on its way answers with the grab it has. Another video
    // under the same name is refused: answering with the first grab would
    // silently swap the video the user picked.
    const existing = await ArrBridgeGrab.findOne({
      where: { category, release_title: fields.releaseTitle, status: { [Op.in]: ACTIVE_STATUSES } },
    });
    if (existing) {
      return existing.youtube_id === fields.youtubeId
        ? { id: existing.id }
        : { error: 'A release with this name is already downloading in Youtarr' };
    }

    const timestamp = now();
    const id = newId();
    await ArrBridgeGrab.create({
      id,
      youtube_id: fields.youtubeId,
      kind: fields.kind,
      category,
      release_title: fields.releaseTitle,
      status: 'pending',
      estimated_bytes: fields.estimatedBytes,
      created_at: timestamp,
      updated_at: timestamp,
    });
    logger.info({ grabId: id, youtubeId: fields.youtubeId, category }, 'Sonarr/Radarr grab added');
    wakeExecutor();
    return { id };
  }

  function listQueue(category) {
    return ArrBridgeGrab.findAll({
      where: { status: { [Op.in]: WAITING_STATUSES }, ...categoryFilter(category) },
      order: [['created_at', 'ASC'], ['id', 'ASC']],
      limit: MAX_QUEUE_ROWS,
    });
  }

  function listHistory(category, limit) {
    return ArrBridgeGrab.findAll({
      where: { status: { [Op.in]: FINISHED_STATUSES }, ...categoryFilter(category) },
      order: [['completed_at', 'DESC'], ['id', 'DESC']],
      limit: clampHistoryLimit(limit),
    });
  }

  // The video columns are named as the table has them: Sequelize does not
  // translate an attribute name inside a `$...$` reference.
  const matchesGrab = (pattern) => ({
    [Op.or]: [
      { release_title: { [Op.like]: pattern } },
      { youtube_id: { [Op.like]: pattern } },
      { '$video.youtube_video_name$': { [Op.like]: pattern } },
      { '$video.youtube_channel_name$': { [Op.like]: pattern } },
    ],
  });

  /**
   * One page of the Settings page's grab list: every status, removed grabs
   * too, each with the video Youtarr holds for it as `video`, if any.
   * @param {Object} [query] - { page, pageSize, q }, as listQuery reads them
   * @returns {Promise<{rows: Array<Object>, total: number, page: number, pageSize: number}>} Newest first
   */
  async function listRecent(query) {
    const { page, pageSize, offset, patterns } = readListQuery(query);
    const { rows, count } = await ArrBridgeGrab.findAndCountAll({
      where: patterns.length > 0 ? { [Op.and]: patterns.map(matchesGrab) } : {},
      include: [{
        model: Video,
        as: 'video',
        attributes: ['youTubeVideoName', 'youTubeChannelName', 'removed', 'filePath'],
        required: false,
      }],
      order: [['created_at', 'DESC'], ['id', 'DESC']],
      limit: pageSize,
      offset,
    });
    return { rows, total: count, page, pageSize };
  }

  function markRemoved(id, fromStatuses) {
    const timestamp = now();
    return ArrBridgeGrab.update(
      { status: 'removed', removed_at: timestamp, updated_at: timestamp },
      { where: { id, status: { [Op.in]: fromStatuses } } }
    );
  }

  /**
   * The Youtarr download, if one is queued or running, is left to finish as
   * an ordinary download; the executor never stages for a removed grab.
   */
  async function removeFromQueue(id) {
    if (!isGrabId(id)) return;
    await markRemoved(id, WAITING_STATUSES);
  }

  /**
   * Removes the grab and its staged folder. The library copy is only ever
   * touched by libraryCopyRemover, which this hands a completed grab to.
   */
  async function removeFromHistory(id) {
    if (!isGrabId(id)) return;
    const grab = await ArrBridgeGrab.findOne({ where: { id, status: { [Op.in]: FINISHED_STATUSES } } });
    if (!grab) return;
    const [removed] = await markRemoved(id, FINISHED_STATUSES);
    // Only a completed grab owns a staged folder. The folder of a failed
    // one, if it exists, belongs to a later grab of the same release.
    if (grab.status !== 'completed') return;
    try {
      await staging.remove({ category: grab.category, releaseTitle: grab.release_title });
    } catch (error) {
      logger.warn({ err: error, grabId: id }, 'Could not remove a staged Sonarr/Radarr folder');
    }
    if (removed !== 1) return;
    await onHandedOff(grab);
    wakeExecutor();
  }

  /**
   * Videos whose grab failed lately. Keyed on the failure message, not the
   * status: the app deletes a failed history item within a minute, which
   * turns the row into `removed` before it searches again.
   * A video that is in the library is left out: a grab hands its file over
   * without a download, so the user can download it in Youtarr and search again.
   * @param {string[]} youtubeIds
   * @returns {Promise<Set<string>>}
   */
  async function recentlyFailedIds(youtubeIds) {
    if (youtubeIds.length === 0) return new Set();
    const rows = await ArrBridgeGrab.findAll({
      attributes: ['youtube_id'],
      where: {
        youtube_id: { [Op.in]: youtubeIds },
        fail_message: { [Op.ne]: null },
        completed_at: { [Op.gte]: new Date(now().getTime() - FAILED_GRAB_GUARD_DAYS * DAY_MS) },
      },
      raw: true,
    });
    const failedIds = new Set(rows.map((row) => row.youtube_id));
    if (failedIds.size === 0) return failedIds;
    const inLibrary = await Video.findAll({
      attributes: ['youtubeId'],
      where: { youtubeId: { [Op.in]: [...failedIds] }, removed: false, filePath: { [Op.ne]: null } },
      raw: true,
    });
    inLibrary.forEach((video) => failedIds.delete(video.youtubeId));
    return failedIds;
  }

  /**
   * Until when recentlyFailedIds keeps a grab's video out of searches.
   * @param {Object} row - A grab row with its `video`, as listRecent returns it
   * @returns {Date|null} null when the video is not hidden
   */
  function hiddenUntilOf(row) {
    if (!row.fail_message || !row.completed_at) return null;
    const until = new Date(new Date(row.completed_at).getTime() + FAILED_GRAB_GUARD_DAYS * DAY_MS);
    if (until <= now()) return null;
    const inLibrary = Boolean(row.video) && !row.video.removed && Boolean(row.video.filePath);
    return inLibrary ? null : until;
  }

  return {
    addGrab, listQueue, listHistory, listRecent, removeFromQueue, removeFromHistory, recentlyFailedIds, hiddenUntilOf,
  };
}

module.exports = { createGrabService, grabState, isGrabId };
