/**
 * The single running reorganize, if any. While it runs, download jobs are
 * held, the file-touching scheduled tasks are refused, and changes to the
 * videos and channels it covers are refused with 409.
 *
 * Dependency-free (no models, no config) so jobModule, scheduledTaskManager
 * and the route layer can all consult it without import cycles.
 */

const { EventEmitter } = require('events');

const REORGANIZE_BLOCK_REASON = 'reorganizing';
const REORGANIZE_RUNNING_CODE = 'REORGANIZE_RUNNING';
const DEFAULT_MESSAGE = 'Downloads are being reorganized. Try again when that finishes.';

function conflictError(message) {
  const err = new Error(message || DEFAULT_MESSAGE);
  err.status = 409;
  err.code = REORGANIZE_RUNNING_CODE;
  return err;
}

class ReorganizeLock extends EventEmitter {
  constructor() {
    super();
    this.active = null;
  }

  /**
   * Take the lock. Throws a 409 error when a reorganize already holds it.
   * @param {Object} params
   * @param {string} params.label - What is being reorganized, for messages and logs
   * @returns {Object} The lock token, passed back to setScope and release
   */
  acquire({ label }) {
    if (this.active) throw conflictError();
    const token = {
      label: label || 'downloads',
      operationId: null,
      channelIds: new Set(),
      videoIds: new Set(),
      youtubeIds: new Set(),
      startedAt: new Date(),
    };
    this.active = token;
    return token;
  }

  /**
   * Record what the held lock covers once the operation is planned.
   * @param {Object} token - acquire's result
   * @param {Object} scope
   * @param {number} [scope.operationId]
   * @param {string} [scope.label]
   * @param {Iterable<string>} [scope.channelIds]
   * @param {Iterable<number>} [scope.videoIds] - Videos.id values
   * @param {Iterable<string>} [scope.youtubeIds]
   */
  setScope(token, { operationId, label, channelIds = [], videoIds = [], youtubeIds = [] }) {
    if (this.active !== token) return;
    if (operationId !== undefined) token.operationId = operationId;
    if (label) token.label = label;
    for (const id of channelIds) if (id) token.channelIds.add(id);
    for (const id of videoIds) if (id !== null && id !== undefined) token.videoIds.add(Number(id));
    for (const id of youtubeIds) if (id) token.youtubeIds.add(id);
  }

  release(token) {
    if (!this.active || this.active !== token) return;
    this.active = null;
    this.emit('released');
  }

  isActive() {
    return this.active !== null;
  }

  /** @returns {{operationId: number|null, label: string, startedAt: Date}|null} */
  getActive() {
    if (!this.active) return null;
    const { operationId, label, startedAt } = this.active;
    return { operationId, label, startedAt };
  }

  coversChannel(channelId) {
    return Boolean(this.active && channelId && this.active.channelIds.has(channelId));
  }

  /**
   * @param {Object} params
   * @param {Array<number|string>} [params.ids] - Videos.id values
   * @param {string[]} [params.youtubeIds]
   */
  coversAnyVideo({ ids = [], youtubeIds = [] } = {}) {
    if (!this.active) return false;
    return ids.some((id) => this.active.videoIds.has(Number(id)))
      || youtubeIds.some((id) => this.active.youtubeIds.has(id));
  }

  /** Scheduled-task blocker shape, or null when nothing is running. */
  runBlocker() {
    if (!this.active) return null;
    return { reason: REORGANIZE_BLOCK_REASON, message: `Waiting for the reorganize of ${this.active.label} to finish.` };
  }

  assertInactive(message) {
    if (this.active) throw conflictError(message);
  }

  assertChannelFree(channelId, message) {
    if (this.coversChannel(channelId)) {
      throw conflictError(message || 'This channel\'s downloads are being reorganized. Try again when that finishes.');
    }
  }

  assertVideosFree(params, message) {
    if (this.coversAnyVideo(params)) {
      throw conflictError(message || 'Some of these videos are being reorganized. Try again when that finishes.');
    }
  }
}

const lock = new ReorganizeLock();

module.exports = lock;
module.exports.REORGANIZE_BLOCK_REASON = REORGANIZE_BLOCK_REASON;
module.exports.REORGANIZE_RUNNING_CODE = REORGANIZE_RUNNING_CODE;
module.exports.ReorganizeLock = ReorganizeLock;
