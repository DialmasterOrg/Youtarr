/**
 * The persistent record of a reorganize: the approved change and every
 * video's planned moves, so a restart can finish it and failed videos can be
 * retried. Item files and classifications are stored as JSON.
 */

const { Op } = require('sequelize');
const { sequelize } = require('../../db');
const TvReorganizeOperation = require('../../models/tvreorganizeoperation');
const TvReorganizeItem = require('../../models/tvreorganizeitem');
const { OPERATION_STATUS, ITEM_STATUS } = require('./constants');

const FAILED_ITEM_LIST_LIMIT = 200;
const MAX_ERROR_LENGTH = 1000;

function itemPayload(item) {
  return {
    files: item.files.map(({ from, to }) => ({ from, to })),
    nfoSources: item.nfoSources,
    sourceDirs: item.sourceDirs,
    destDir: item.destDir,
    oldVideoPath: item.oldVideoPath,
    newVideoPath: item.newVideoPath,
    oldAudioPath: item.oldAudioPath,
    newAudioPath: item.newAudioPath,
    layout: item.layout,
    libraryFolder: item.libraryFolder,
    fromLayout: item.fromLayout,
    fromLibraryFolder: item.fromLibraryFolder,
  };
}

function truncate(message) {
  const text = String(message || '');
  return text.length > MAX_ERROR_LENGTH ? `${text.slice(0, MAX_ERROR_LENGTH - 3)}...` : text;
}

/**
 * Record a planned reorganize as running.
 * @param {Object} plan - planner.buildPlan's result
 * @returns {Promise<Object>} The operation row
 */
async function createOperation(plan) {
  const { context } = plan;
  return sequelize.transaction(async (transaction) => {
    const operation = await TvReorganizeOperation.create({
      change_type: context.type,
      scope: String(context.scope || ''),
      settings_change: JSON.stringify({
        change: context.stored,
        label: context.label,
        shows: plan.shows,
        ...(plan.snapshot ? { snapshot: plan.snapshot } : {}),
      }),
      settings_applied: false,
      revision: plan.revision,
      status: OPERATION_STATUS.RUNNING,
      total_items: plan.items.length,
      started_at: new Date(),
    }, { transaction });
    if (plan.items.length > 0) {
      await TvReorganizeItem.bulkCreate(plan.items.map((item) => ({
        operation_id: operation.id,
        youtube_id: item.youtubeId,
        video_id: item.videoId,
        channel_id: item.channelId,
        title: item.title ? String(item.title).slice(0, 512) : null,
        files: JSON.stringify(itemPayload(item)),
        classification: item.classification ? JSON.stringify(item.classification) : null,
        status: ITEM_STATUS.PENDING,
      })), { transaction });
    }
    return operation;
  });
}

/** @returns {{change: Object, label: string, shows: Array<Object>, snapshot?: Object}} */
function settingsOf(operation) {
  return JSON.parse(operation.settings_change);
}

async function markSettingsApplied(operation, shows, { transaction = null } = {}) {
  const settings = settingsOf(operation);
  await operation.update({
    settings_change: JSON.stringify({ ...settings, shows }),
    settings_applied: true,
  }, { transaction });
}

async function itemsWithStatus(operationId, statuses) {
  return TvReorganizeItem.findAll({ where: { operation_id: operationId, status: statuses }, order: [['id', 'ASC']] });
}

/**
 * @param {Object} item - tv_reorganize_items row
 * @param {string} status
 * @param {string|null} [error]
 * @param {Object} [options]
 * @param {boolean} [options.filesMoved] - Where a failed item's files are:
 *   true at their destination (the video counts as moved), false verified
 *   back at their sources, undefined when the attempt never reached them
 *   (what is stored stands). A done item's files are always moved.
 */
async function markItem(item, status, error = null, { filesMoved } = {}) {
  await item.update({
    status,
    error: error ? truncate(error) : null,
    files_moved: status === ITEM_STATUS.DONE || filesMoved === true
      || (filesMoved === undefined && Boolean(item.files_moved)),
  });
}

/**
 * Recount the operation's items into its row.
 * @returns {Promise<{done: number, failed: number, pending: number, moved: number}>}
 *   moved: items whose files are at their destination, done or not
 */
async function refreshCounts(operation) {
  const rows = await TvReorganizeItem.findAll({
    where: { operation_id: operation.id },
    attributes: ['status', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
    group: ['status'],
    raw: true,
  });
  const count = (status) => Number((rows.find((row) => row.status === status) || {}).count || 0);
  const moved = await TvReorganizeItem.count({ where: { operation_id: operation.id, files_moved: true } });
  const counts = { done: count(ITEM_STATUS.DONE), failed: count(ITEM_STATUS.FAILED), pending: count(ITEM_STATUS.PENDING), moved };
  await operation.update({ done_items: counts.done, failed_items: counts.failed });
  return counts;
}

async function finishOperation(operation, status, error = null) {
  await operation.update({ status, error: error ? truncate(error) : null, finished_at: new Date() });
}

async function reopenOperation(operation) {
  await operation.update({ status: OPERATION_STATUS.RUNNING, error: null, finished_at: null });
}

async function findUnfinished() {
  return TvReorganizeOperation.findAll({ where: { status: OPERATION_STATUS.RUNNING }, order: [['id', 'ASC']] });
}

async function findOperation(id) {
  return TvReorganizeOperation.findByPk(id);
}

function describeOperation(operation, failedItems = []) {
  const settings = settingsOf(operation);
  return {
    id: operation.id,
    changeType: operation.change_type,
    change: settings.change,
    label: settings.label,
    status: operation.status,
    total: operation.total_items,
    done: operation.done_items,
    failed: operation.failed_items,
    error: operation.error,
    startedAt: operation.started_at,
    finishedAt: operation.finished_at,
    failedItems: failedItems.map((item) => ({
      id: item.id, youtubeId: item.youtube_id, title: item.title, channelId: item.channel_id, error: item.error,
      filesMoved: Boolean(item.files_moved),
    })),
  };
}

// The items a retry would take up: failed ones, plus the pending ones of an
// operation that ended before reaching them (a running one is still on them).
function unfinishedStatuses(operation) {
  return operation.status === OPERATION_STATUS.RUNNING
    ? [ITEM_STATUS.FAILED]
    : [ITEM_STATUS.FAILED, ITEM_STATUS.PENDING];
}

/**
 * The operation's state for the API, with the videos it did not move.
 * @returns {Promise<Object|null>}
 */
async function getOperationView(id) {
  const operation = await findOperation(id);
  if (!operation) return null;
  const unfinished = await TvReorganizeItem.findAll({
    where: { operation_id: id, status: unfinishedStatuses(operation) },
    order: [['id', 'ASC']],
    limit: FAILED_ITEM_LIST_LIMIT,
  });
  return describeOperation(operation, unfinished);
}

/**
 * The newest operation that left videos of this channel unmoved.
 * @returns {Promise<{operationId: number, failed: number, status: string}|null>}
 */
async function unmovedForChannel(channelId) {
  const latest = await TvReorganizeItem.findOne({
    where: { channel_id: channelId, status: [ITEM_STATUS.FAILED, ITEM_STATUS.PENDING] },
    order: [['operation_id', 'DESC']],
    attributes: ['operation_id'],
  });
  if (!latest) return null;
  const operation = await findOperation(latest.operation_id);
  if (!operation) return null;
  const failed = await TvReorganizeItem.count({
    where: { operation_id: latest.operation_id, channel_id: channelId, status: unfinishedStatuses(operation) },
  });
  if (failed === 0) return null;
  return { operationId: operation.id, failed, status: operation.status };
}

/**
 * The newest operations, for the activity list.
 */
async function listRecent(limit = 10) {
  const operations = await TvReorganizeOperation.findAll({ order: [['id', 'DESC']], limit });
  return operations.map((operation) => describeOperation(operation));
}

/**
 * Failed items go back to pending for a retry.
 * @returns {Promise<number>}
 */
async function resetFailedItems(operationId) {
  const [count] = await TvReorganizeItem.update(
    { status: ITEM_STATUS.PENDING, error: null },
    { where: { operation_id: operationId, status: ITEM_STATUS.FAILED } }
  );
  return count;
}

/**
 * Whether a newer operation covers any of these channels, which makes an
 * older operation's stored plan stale for a retry.
 */
async function hasNewerOperationFor(operationId, channelIds) {
  if (channelIds.length === 0) return false;
  const newer = await TvReorganizeItem.findOne({
    where: { operation_id: { [Op.gt]: operationId }, channel_id: channelIds },
    attributes: ['id'],
  });
  return Boolean(newer);
}

module.exports = {
  createOperation,
  settingsOf,
  markSettingsApplied,
  itemsWithStatus,
  markItem,
  refreshCounts,
  finishOperation,
  reopenOperation,
  findUnfinished,
  findOperation,
  getOperationView,
  unmovedForChannel,
  listRecent,
  resetFailedItems,
  hasNewerOperationFor
};
