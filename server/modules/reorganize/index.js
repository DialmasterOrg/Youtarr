/**
 * Reorganize: move already-downloaded files to where changed settings say
 * they belong, when a channel, a library folder or the default subfolder
 * switches between the Videos and TV layouts.
 *
 * - reorganizeLock: the running reorganize; holds downloads, refuses tasks and changes
 * - changeContext: a settings change resolved into the world before and after it
 * - changeScope: which videos a change moves, and their owner channels
 * - showPlanner: destinations, and the shows a change creates or moves
 * - destinationPlanner: every video's files, names and episode numbers
 * - movieNameRenderer: movie-style names rendered by yt-dlp from stored info
 * - revision: the plan's revision token
 * - planner: the plan and the preview built from it
 * - operationStore: the persistent operation record
 * - settingsApplier: applying (and undoing) the settings change
 * - itemExecutor: moving one video
 * - followUp: metadata, cleanup, playlists, library refresh, push-back
 * - operationRunner: starting, running, retrying and resuming operations
 */

const reorganizeLock = require('./reorganizeLock');
const operationRunner = require('./operationRunner');
const operationStore = require('./operationStore');

const { EXCLUSIVE_TASKS } = operationRunner;

class ReorganizeModule {
  constructor() {
    this.lock = reorganizeLock;
  }

  /**
   * Wire the modules the runner checks and refuses. Call once at startup.
   * @param {Object} deps - jobModule, scheduledTaskManager, videosModule, mediaServerSync, watchStatusSync
   */
  initialize(deps) {
    operationRunner.initialize(deps);
    deps.scheduledTaskManager.setExclusiveBlocker((taskId) => (
      Object.prototype.hasOwnProperty.call(EXCLUSIVE_TASKS, taskId) ? reorganizeLock.runBlocker() : null
    ));
  }

  preview(change) {
    return operationRunner.preview(change);
  }

  start(change, revision) {
    return operationRunner.start(change, revision);
  }

  retry(operationId) {
    return operationRunner.retry(operationId);
  }

  getOperation(operationId) {
    return operationStore.getOperationView(operationId);
  }

  /** The running operation, or null. */
  async getActive() {
    const active = reorganizeLock.getActive();
    if (!active) return null;
    if (!active.operationId) return { id: null, label: active.label, status: 'starting' };
    return operationStore.getOperationView(active.operationId);
  }

  /**
   * A channel's reorganize state for Channel Settings.
   * @returns {Promise<{running: boolean, unmoved: Object|null}>}
   */
  async channelState(channelId) {
    return {
      running: reorganizeLock.coversChannel(channelId),
      unmoved: await operationStore.unmovedForChannel(channelId),
    };
  }

  recoverInterrupted() {
    return operationRunner.recover();
  }
}

module.exports = new ReorganizeModule();
