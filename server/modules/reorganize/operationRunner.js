/**
 * Runs reorganize operations. Only one runs at a time, and only while no
 * download job is In Progress and none of the tasks that read or write
 * downloaded files is running; while it runs, download jobs wait in the queue
 * and those tasks are refused (reorganizeLock).
 *
 * A run: snapshot the moving videos' watch state (after a sync, when the last
 * one is old), apply the settings change and pin its shows, move the videos
 * one by one (a failure never stops the others), then write show and channel
 * metadata and remove emptied folders. With the lock released, playlists are
 * re-synced, libraries refreshed and watch state pushed back. An operation a
 * restart interrupted resumes at startup.
 */

const configModule = require('../configModule');
const messageEmitter = require('../messageEmitter');
const logger = require('../../logger');
const watchStatusHolds = require('../mediaServers/watchStatusHolds');
const { getLayoutResolver } = require('../tvShows/libraryLayouts');
const reorganizeLock = require('./reorganizeLock');
const operationStore = require('./operationStore');
const { buildPlan, summarizePlan, applyRefusal } = require('./planner');
const { applySettings, rollbackSettings } = require('./settingsApplier');
const { executeItem } = require('./itemExecutor');
const followUp = require('./followUp');
const { OPERATION_STATUS, ITEM_STATUS, PROGRESS_MESSAGE_TYPE, CHANGE_CHANNEL, CHANGE_TITLE_SHOWS } = require('./constants');

// Changes made to one channel, which the lock covers from the start.
const CHANNEL_CHANGES = new Set([CHANGE_CHANNEL, CHANGE_TITLE_SHOWS]);

// Scheduled tasks that read or write downloaded files or their rows, refused
// while a reorganize runs (and which refuse a reorganize while they run).
const EXCLUSIVE_TASKS = Object.freeze({
  videoRescanFrequency: 'The filesystem rescan',
  archiveBackfillFrequency: 'Library repair',
  autoRemovalFrequency: 'Automatic video cleanup',
  watchStatusSyncFrequency: 'Watch status sync',
  ytdlpUpdateFrequency: 'The yt-dlp update',
});
const FRESH_SYNC_MAX_AGE_MS = 15 * 60 * 1000;
const FRESH_SYNC_TIMEOUT_MS = 2 * 60 * 1000;
const PROGRESS_INTERVAL_MS = 1000;
const RECOVERY_POLL_MS = 5000;
const RECOVERY_MAX_WAIT_MS = 30 * 60 * 1000;
const NOTHING_MOVED_MESSAGE = 'No video could be moved, so the settings change was undone.';
const INTERRUPTED_MESSAGE = 'A restart interrupted this reorganize and downloads were still busy when the server came up. Retry to finish it.';

function conflict(message, code = null) {
  const err = new Error(message);
  err.status = 409;
  if (code) err.code = code;
  return err;
}

function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function describeDone(item) {
  return {
    youtubeId: item.youtube_id,
    channelId: item.channel_id,
    plan: JSON.parse(item.files),
    classification: item.classification ? JSON.parse(item.classification) : null,
  };
}

class OperationRunner {
  constructor() {
    this.deps = null;
    this.lastProgressAt = 0;
  }

  /**
   * @param {Object} deps
   * @param {Object} deps.jobModule
   * @param {Object} deps.scheduledTaskManager
   * @param {Object} deps.videosModule
   * @param {Object} deps.mediaServerSync
   * @param {Object} deps.watchStatusSync
   */
  initialize(deps) {
    this.deps = deps;
  }

  /**
   * Why a reorganize can't start right now, or null.
   * @returns {{reason: string, message: string}|null}
   */
  blocker() {
    if (reorganizeLock.isActive()) {
      return { reason: 'reorganizing', message: 'Another reorganize is running. Try again when it finishes.' };
    }
    return this._activityBlocker();
  }

  // The blocker without the lock itself: what else is touching downloads.
  _activityBlocker() {
    if (!this.deps) return { reason: 'starting', message: 'The server is still starting.' };
    const { jobModule, scheduledTaskManager, videosModule, mediaServerSync, watchStatusSync } = this.deps;
    if (jobModule.getInProgressJobId()) {
      return { reason: 'download-running', message: 'Wait for the current download to finish, then try again.' };
    }
    const running = Object.keys(EXCLUSIVE_TASKS).find((id) => scheduledTaskManager.isTaskRunningById(id));
    if (running) {
      return { reason: 'task-running', message: `${EXCLUSIVE_TASKS[running]} is running. Try again when it finishes.` };
    }
    if (videosModule.isBackfillRunning() || jobModule.isArchiveRepairRunning() || watchStatusSync.getStatus().running) {
      return { reason: 'task-running', message: 'A library scan or sync is running. Try again when it finishes.' };
    }
    if (mediaServerSync.isAnySyncInFlight()) {
      return { reason: 'task-running', message: 'A media server playlist sync is running. Try again in a moment.' };
    }
    return null;
  }

  /**
   * The dry run: everything that would move, without moving anything.
   * @param {Object} change
   */
  async preview(change) {
    const plan = await buildPlan(change);
    return summarizePlan(plan, { blocked: this.blocker() });
  }

  /**
   * Start a previewed reorganize in the background.
   *
   * @param {Object} change - The change the preview was for
   * @param {string} revision - The preview's revision token
   * @returns {Promise<{operationId: number|null, applied: boolean}>} operationId null
   *   when nothing had to move and the settings change was applied directly
   */
  async start(change, revision) {
    if (typeof revision !== 'string' || !revision) throw badRequest('revision is required');
    const blocked = this.blocker();
    if (blocked) throw conflict(blocked.message, blocked.reason);

    const token = reorganizeLock.acquire({ label: 'downloads' });
    let operation;
    let plan;
    try {
      if (change && change.channelId) reorganizeLock.setScope(token, { channelIds: [change.channelId] });
      plan = await buildPlan(change);
      if (plan.revision !== revision) {
        throw conflict('Files or settings changed since the preview. Review the move again.', 'STALE_PREVIEW');
      }
      // The plan can take a while on a large library, and a job admitted in
      // the moment before the lock was taken may have started meanwhile.
      const busy = this._activityBlocker();
      if (busy) throw conflict(busy.message, busy.reason);
      if (plan.items.length === 0) {
        const refusal = applyRefusal(plan);
        if (refusal) throw conflict(refusal.message, refusal.reason);
        await applySettings({ change: plan.context.stored, shows: plan.shows, layoutBefore: plan.context.layoutBefore });
        logger.info({ change: plan.context.stored }, 'Applied a layout change with no downloaded files to move');
        reorganizeLock.release(token);
        return { operationId: null, applied: true };
      }
      operation = await operationStore.createOperation(plan);
      reorganizeLock.setScope(token, {
        operationId: operation.id,
        label: plan.context.label,
        channelIds: [
          ...plan.items.map((item) => item.channelId),
          ...(CHANNEL_CHANGES.has(plan.context.type) ? [plan.context.channel.channel_id] : []),
        ],
        videoIds: plan.items.map((item) => item.videoId),
        youtubeIds: plan.items.map((item) => item.youtubeId),
      });
    } catch (err) {
      reorganizeLock.release(token);
      throw err;
    }

    logger.info({ operationId: operation.id, videos: operation.total_items }, 'Reorganize started');
    this._run(operation, token, { plan, freshSync: true }).catch((err) => {
      logger.error({ err, operationId: operation.id }, 'Reorganize failed');
    });
    return { operationId: operation.id, applied: false };
  }

  /**
   * Try an operation's failed videos again.
   * @returns {Promise<{operationId: number}>}
   */
  async retry(operationId) {
    const operation = await operationStore.findOperation(operationId);
    if (!operation) {
      const err = new Error('Reorganize not found');
      err.status = 404;
      throw err;
    }
    // A running operation holds the lock, which the blocker reports; a row
    // left "running" by a crash with the lock free is retried like any other.
    const blocked = this.blocker();
    if (blocked) throw conflict(blocked.message, blocked.reason);
    // Failed videos, plus any a stopped run never reached.
    const unfinished = await operationStore.itemsWithStatus(operation.id, [ITEM_STATUS.FAILED, ITEM_STATUS.PENDING]);
    if (unfinished.length === 0) throw badRequest('Nothing failed in this reorganize.');
    const channelIds = [...new Set(unfinished.map((item) => item.channel_id).filter(Boolean))];
    if (await operationStore.hasNewerOperationFor(operation.id, channelIds)) {
      throw conflict('A newer reorganize changed these channels. Review the move again from Channel Settings.');
    }

    const token = reorganizeLock.acquire({ label: operationStore.settingsOf(operation).label });
    try {
      reorganizeLock.setScope(token, {
        operationId: operation.id,
        channelIds,
        videoIds: unfinished.map((item) => item.video_id),
        youtubeIds: unfinished.map((item) => item.youtube_id),
      });
      await operationStore.resetFailedItems(operation.id);
      await operationStore.reopenOperation(operation);
    } catch (err) {
      reorganizeLock.release(token);
      throw err;
    }
    this._run(operation, token, { freshSync: true }).catch((err) => {
      logger.error({ err, operationId: operation.id }, 'Reorganize retry failed');
    });
    return { operationId: operation.id };
  }

  /**
   * Resume operations a restart interrupted. Waits for startup work that
   * touches downloads (library repair, a rescan) to finish first.
   */
  async recover() {
    const operations = await operationStore.findUnfinished();
    for (const operation of operations) {
      if (!(await this._waitUntilFree())) {
        // Not resumed alongside whatever is still busy: closed as unfinished,
        // so Retry (or the next start) can pick it up.
        logger.warn({ operationId: operation.id, blocker: this.blocker() }, 'Downloads are still busy; the interrupted reorganize was not resumed');
        const status = operation.settings_applied ? OPERATION_STATUS.PARTIAL : OPERATION_STATUS.FAILED;
        try {
          await operationStore.finishOperation(operation, status, INTERRUPTED_MESSAGE);
        } catch (err) {
          logger.error({ err, operationId: operation.id }, 'Could not record the interrupted reorganize');
        }
        continue;
      }
      const pending = await operationStore.itemsWithStatus(operation.id, [ITEM_STATUS.PENDING]);
      const token = reorganizeLock.acquire({ label: operationStore.settingsOf(operation).label });
      reorganizeLock.setScope(token, {
        operationId: operation.id,
        channelIds: pending.map((item) => item.channel_id),
        videoIds: pending.map((item) => item.video_id),
        youtubeIds: pending.map((item) => item.youtube_id),
      });
      logger.info({ operationId: operation.id, pending: pending.length }, 'Resuming an interrupted reorganize');
      await this._run(operation, token, { freshSync: false });
    }
  }

  /** @returns {Promise<boolean>} false when still blocked at the deadline */
  async _waitUntilFree() {
    const deadline = Date.now() + RECOVERY_MAX_WAIT_MS;
    while (this.blocker()) {
      if (Date.now() >= deadline) return false;
      await sleep(RECOVERY_POLL_MS);
    }
    return true;
  }

  async _refreshWatchState() {
    const { watchStatusSync } = this.deps;
    const config = configModule.getConfig() || {};
    if (config.watchStatusSyncEnabled === false) return;
    const { lastRun } = watchStatusSync.getStatus();
    const lastAt = lastRun && lastRun.completedAt ? new Date(lastRun.completedAt).getTime() : 0;
    if (Date.now() - lastAt < FRESH_SYNC_MAX_AGE_MS) return;
    let timer;
    try {
      await Promise.race([
        watchStatusSync.syncAll('reorganize'),
        new Promise((resolve) => { timer = setTimeout(resolve, FRESH_SYNC_TIMEOUT_MS); }),
      ]);
    } catch (err) {
      logger.warn({ err }, 'Watch status sync before a reorganize failed; holding the stored state');
    } finally {
      clearTimeout(timer);
    }
  }

  _broadcast(operation, force = false) {
    const now = Date.now();
    if (!force && now - this.lastProgressAt < PROGRESS_INTERVAL_MS) return;
    this.lastProgressAt = now;
    try {
      messageEmitter.emitMessage('broadcast', null, 'reorganize', PROGRESS_MESSAGE_TYPE, {
        operationId: operation.id,
        status: operation.status,
        total: operation.total_items,
        done: operation.done_items,
        failed: operation.failed_items,
        label: operationStore.settingsOf(operation).label,
      });
    } catch (err) {
      logger.debug({ err }, 'Could not broadcast reorganize progress');
    }
  }

  async _run(operation, token, { plan = null, freshSync }) {
    const settings = operationStore.settingsOf(operation);
    let shows = settings.shows;
    let status = OPERATION_STATUS.COMPLETED;
    let error = null;
    let items = [];
    // Items whose files reached their destination, in this run or an earlier
    // attempt, finished or not: their settings stay applied and their watch
    // state stays held.
    const moved = new Set();
    // Every done item of the operation, earlier runs included, for the follow-up.
    let finished = [];
    try {
      this._broadcast(operation, true);
      items = await operationStore.itemsWithStatus(operation.id, [ITEM_STATUS.PENDING]);
      for (const item of items) if (item.files_moved) moved.add(item.id);
      if (freshSync) await this._refreshWatchState();
      await watchStatusHolds.createHolds({ operationId: operation.id, videoIds: items.map((item) => item.video_id) });

      if (!operation.settings_applied) {
        const layoutBefore = plan ? plan.context.layoutBefore : await getLayoutResolver();
        shows = await applySettings({ change: settings.change, shows, layoutBefore });
        await operationStore.markSettingsApplied(operation, shows);
      }
      // A channel show by its owner channel, a title show by its key.
      const showIds = new Map(shows.map((show) => [show.key || show.ownerChannelId, show.showId]));

      for (const item of items) {
        try {
          await executeItem(item, { showIdFor: (owner) => showIds.get(owner) || null });
          moved.add(item.id);
          await operationStore.markItem(item, ITEM_STATUS.DONE);
        } catch (err) {
          // true: at the destination; false: verified back home; undefined:
          // the attempt never reached the files, so what we knew stands.
          const { filesMoved } = err;
          if (filesMoved === true) moved.add(item.id);
          else if (filesMoved === false) moved.delete(item.id);
          logger.warn({ err, operationId: operation.id, youtubeId: item.youtube_id, filesMoved }, 'Could not move a video');
          await operationStore.markItem(item, ITEM_STATUS.FAILED, err.message, { filesMoved });
        }
        await operationStore.refreshCounts(operation);
        this._broadcast(operation);
      }

      const counts = await operationStore.refreshCounts(operation);
      if (counts.moved === 0 && counts.failed > 0) {
        await rollbackSettings({ change: settings.change, shows, snapshot: settings.snapshot || null });
        await operation.update({ settings_applied: false });
        status = OPERATION_STATUS.FAILED;
        error = NOTHING_MOVED_MESSAGE;
      } else if (counts.failed > 0) {
        status = OPERATION_STATUS.PARTIAL;
      }
      finished = (await operationStore.itemsWithStatus(operation.id, [ITEM_STATUS.DONE])).map(describeDone);
      try {
        await followUp.finishFiles({
          items: finished,
          shows,
          titleShowChannelId: settings.change.type === CHANGE_TITLE_SHOWS ? settings.change.channelId : null,
        });
      } catch (err) {
        logger.warn({ err, operationId: operation.id }, 'Could not finish the metadata and folders after a reorganize');
      }
    } catch (err) {
      logger.error({ err, operationId: operation.id }, 'Reorganize stopped');
      status = OPERATION_STATUS.FAILED;
      error = err.message;
      if (operation.settings_applied && moved.size === 0) {
        try {
          await rollbackSettings({ change: settings.change, shows, snapshot: settings.snapshot || null });
          await operation.update({ settings_applied: false });
        } catch (rollbackErr) {
          logger.error({ err: rollbackErr, operationId: operation.id }, 'Could not undo the settings change of a failed reorganize');
        }
      }
    } finally {
      // Videos whose files stayed put are where the servers know them.
      try {
        await watchStatusHolds.releaseUnmovedHolds({
          operationId: operation.id,
          videoIds: items.filter((item) => !moved.has(item.id)).map((item) => item.video_id),
        });
      } catch (err) {
        logger.warn({ err, operationId: operation.id }, 'Could not release the watch-state holds of unmoved videos');
      }
      try {
        await operationStore.refreshCounts(operation);
        await operationStore.finishOperation(operation, status, error);
      } catch (err) {
        logger.error({ err, operationId: operation.id }, 'Could not record the end of a reorganize');
      }
      reorganizeLock.release(token);
      this._broadcast(operation, true);
      logger.info({ operationId: operation.id, status, done: operation.done_items, failed: operation.failed_items }, 'Reorganize finished');
    }
    if (finished.length > 0) {
      await followUp.finishServers({ items: finished }).catch((err) => {
        logger.warn({ err, operationId: operation.id }, 'Could not refresh media servers after a reorganize');
      });
    }
  }
}

module.exports = new OperationRunner();
module.exports.EXCLUSIVE_TASKS = EXCLUSIVE_TASKS;
module.exports.OperationRunner = OperationRunner;
