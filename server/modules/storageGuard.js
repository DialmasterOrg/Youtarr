const EventEmitter = require('events');
const logger = require('../logger');
const configModule = require('./configModule');
const storageUsage = require('./storageUsage');
const notificationModule = require('./notificationModule');
const MessageEmitter = require('./messageEmitter');

const DOWNLOADS_PAUSED_CODE = 'DOWNLOADS_PAUSED';
// While paused, re-measure periodically so space freed outside Youtarr
// (files deleted on the share, another app cleaning up) resumes downloads.
const PAUSED_RECHECK_INTERVAL_MS = 5 * 60 * 1000;
// Every job start, download request and pause banner load refreshes the
// guard, so the downloads folder check is reused for this long...
const LIBRARY_CHECK_CACHE_MS = 30 * 1000;
// ...and given this long to answer. A share that hangs instead of failing
// would otherwise stall the guard's queue and every job start behind it.
const LIBRARY_CHECK_TIMEOUT_MS = 10 * 1000;
const TIMED_OUT = Symbol('timed out');
const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];
const BYTES_PER_UNIT = 1024;

function formatBytes(bytes) {
  let value = bytes;
  let unitIndex = 0;
  while (value >= BYTES_PER_UNIT && unitIndex < BYTE_UNITS.length - 1) {
    value /= BYTES_PER_UNIT;
    unitIndex += 1;
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${BYTE_UNITS[unitIndex]}`;
}

// "500GB" -> "500 GB"
function formatLimit(limit) {
  return String(limit).replace(/^(\d+)(MB|GB|TB)$/, '$1 $2');
}

function buildUsageReason(downloadedBytes, limit, limitBytes) {
  return {
    type: 'usage',
    currentBytes: downloadedBytes,
    limitBytes,
    text: `downloaded videos use ${formatBytes(downloadedBytes)}, over the ${formatLimit(limit)} limit`
  };
}

function buildFreeSpaceReason(availableBytes, limit, limitBytes) {
  return {
    type: 'freeSpace',
    currentBytes: availableBytes,
    limitBytes,
    text: `only ${formatBytes(availableBytes)} of disk space is free, below the ${formatLimit(limit)} minimum`
  };
}

// From a library check failure ("The downloads folder is empty."), in the
// lower-case clause form the other reasons use.
function buildLibraryReason(libraryCheck) {
  const message = (libraryCheck.message || 'the downloads folder is unavailable').replace(/\.$/, '');
  return {
    type: 'library',
    libraryReason: libraryCheck.reason,
    text: message.charAt(0).toLowerCase() + message.slice(1)
  };
}

function describeReasons(reasons) {
  return reasons.map((reason) => reason.text).join('; ');
}

// The promise's value, or TIMED_OUT if it takes longer than `ms`.
function withinTime(promise, ms) {
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve(TIMED_OUT), ms);
    if (typeof timer.unref === 'function') timer.unref();
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

class DownloadsPausedError extends Error {
  constructor(status) {
    super(`Downloads are paused: ${describeReasons(status.reasons)}`);
    this.name = 'DownloadsPausedError';
    this.code = DOWNLOADS_PAUSED_CODE;
    this.status = status;
  }
}

function initialStatus() {
  return {
    paused: false,
    pausedSince: null,
    reasons: [],
    usage: { limit: null, limitBytes: null, downloadedBytes: null },
    freeSpace: { limit: null, limitBytes: null, availableBytes: null },
    checkedAt: null
  };
}

/**
 * Owns the "downloads paused" state. Two optional storage triggers, both off
 * by default: total size of downloaded videos over downloadPauseUsageLimit,
 * and free disk space under downloadPauseMinFreeSpace. A third, always on once
 * wired (setLibraryCheck): the downloads folder looks unmounted or is not the
 * library, so new files would land somewhere the library is not.
 * A measurement that fails never pauses downloads (fail open).
 *
 * Emits 'resumed' when downloads are allowed again, so the job queue can start
 * the jobs it held. Broadcasts downloadPauseChanged over WebSocket and sends a
 * notification whenever the paused state flips.
 */
class StorageGuard extends EventEmitter {
  constructor() {
    super();
    this.status = initialStatus();
    this.queue = Promise.resolve();
    this.recheckTimer = null;
    this.initialized = false;
    this.checkLibrary = null;
    // The last answer ({ at, block }), the check still running, and when it started.
    this.libraryCheckCache = null;
    this.libraryCheckInFlight = null;
    this.libraryCheckStartedAt = 0;
    this.libraryCheckHangReported = false;
  }

  /**
   * Wire the downloads folder check (server.js, once the database is ready).
   * Passed in rather than required: this module is loaded by downloadModule,
   * whose tests cannot load the models the check reads.
   * @param {function(): Promise<Object|null>} checkLibrary - the failing library check that should hold
   *   downloads, or null (libraryRootCheck.downloadsFolderBlock)
   */
  setLibraryCheck(checkLibrary) {
    this.checkLibrary = checkLibrary;
    this.libraryCheckCache = null;
  }

  /**
   * Check the downloads folder again now instead of within the cache window,
   * e.g. after a rescan repaired the stored paths a pause was based on.
   * @returns {Promise<object>} The fresh status
   */
  recheckLibrary() {
    this.libraryCheckCache = null;
    return this.refresh();
  }

  /**
   * Take the first measurement and re-evaluate whenever the config changes.
   * @returns {Promise<object>} The initial status
   */
  initialize() {
    if (!this.initialized) {
      this.initialized = true;
      configModule.onConfigChange(() => {
        this.refresh().catch((err) => {
          logger.error({ err }, 'Failed to re-check download pause state after config change');
        });
      });
    }
    return this.refresh();
  }

  /**
   * The last evaluated status. May be stale; call refresh() for a fresh one.
   * @returns {object}
   */
  getStatus() {
    return this.status;
  }

  /**
   * Re-measure and apply the result. Calls are serialized so state
   * transitions (and their notifications) never interleave.
   * @param {object} [options]
   * @param {boolean} [options.includeUsage=false] - Measure the downloaded
   *   total even without a usage limit (for display); otherwise it is only
   *   measured when a limit needs it, keeping the hot path cheap.
   * @returns {Promise<object>} The fresh status
   */
  refresh({ includeUsage = false } = {}) {
    const run = this.queue.then(() => this._evaluateAndApply({ includeUsage }));
    this.queue = run.catch(() => {});
    return run;
  }

  /**
   * Throw a DownloadsPausedError when downloads are currently paused.
   * @returns {Promise<void>}
   */
  async assertDownloadsAllowed() {
    const status = await this.refresh();
    if (status.paused) {
      throw new DownloadsPausedError(status);
    }
  }

  /**
   * @param {*} err
   * @returns {boolean} True when err was thrown because downloads are paused
   */
  isPausedError(err) {
    return Boolean(err && err.code === DOWNLOADS_PAUSED_CODE);
  }

  /**
   * Human-readable reason text, e.g. for a skipped scheduled run.
   * @param {object} status
   * @returns {string}
   */
  describe(status) {
    return `Downloads are paused: ${describeReasons(status.reasons)}`;
  }

  async _measureUsage(config, includeUsage) {
    const limit = config.downloadPauseUsageLimit || null;
    const limitBytes = limit ? configModule.convertStorageThresholdToBytes(limit) : null;
    let downloadedBytes = null;
    if (limitBytes === null && !includeUsage) {
      return { limit, limitBytes, downloadedBytes };
    }
    try {
      downloadedBytes = await storageUsage.getDownloadedBytes();
    } catch (err) {
      logger.warn({ err }, 'Could not measure downloaded video size; usage limit not enforced for this check');
    }
    return { limit, limitBytes, downloadedBytes };
  }

  async _measureFreeSpace(config) {
    const limit = config.downloadPauseMinFreeSpace || null;
    const limitBytes = limit ? configModule.convertStorageThresholdToBytes(limit) : null;
    if (limitBytes === null) {
      return { limit, limitBytes, availableBytes: null };
    }
    const storageStatus = await configModule.getStorageStatus();
    const availableBytes = storageStatus && Number.isFinite(storageStatus.available)
      ? storageStatus.available
      : null;
    return { limit, limitBytes, availableBytes };
  }

  // The downloads folder check, cached briefly and one at a time. A check that
  // does not answer in time keeps the last answer: a dead share often answers
  // slowly, and reading that as "fine" would resume downloads into it, then
  // pause again when the late answer lands, on every re-check of the outage.
  // Only with no earlier answer (first check, or right after recheckLibrary)
  // does it fail open. A check that hangs keeps its slot: starting another
  // would only block another listing on the same share, so callers stop
  // waiting for it once its time is up.
  async _measureLibrary() {
    if (!this.checkLibrary) return null;
    if (this.libraryCheckCache && Date.now() - this.libraryCheckCache.at < LIBRARY_CHECK_CACHE_MS) {
      return this.libraryCheckCache.block;
    }
    if (!this.libraryCheckInFlight) this._startLibraryCheck();

    const remaining = this.libraryCheckStartedAt + LIBRARY_CHECK_TIMEOUT_MS - Date.now();
    const outcome = remaining > 0 ? await withinTime(this.libraryCheckInFlight, remaining) : TIMED_OUT;
    if (outcome !== TIMED_OUT) return outcome;

    const previous = this.libraryCheckCache ? this.libraryCheckCache.block : null;
    if (!this.libraryCheckHangReported) {
      this.libraryCheckHangReported = true;
      logger.warn(
        { timeoutMs: LIBRARY_CHECK_TIMEOUT_MS, keptPreviousAnswer: this.libraryCheckCache !== null },
        this.libraryCheckCache
          ? 'The downloads folder did not answer in time; keeping its last answer until it does'
          : 'The downloads folder did not answer in time; downloads are not held for it until it does'
      );
    }
    return previous;
  }

  _startLibraryCheck() {
    this.libraryCheckStartedAt = Date.now();
    this.libraryCheckHangReported = false;
    this.libraryCheckInFlight = Promise.resolve()
      .then(() => this.checkLibrary())
      .then(
        (block) => {
          this.libraryCheckCache = { at: Date.now(), block };
          return block;
        },
        (err) => {
          logger.warn({ err }, 'Could not check the downloads folder; downloads are not held for it');
          return null;
        }
      )
      .finally(() => {
        this.libraryCheckInFlight = null;
      });
  }

  async _evaluateAndApply({ includeUsage }) {
    const config = configModule.getConfig();
    const [usage, freeSpace, libraryBlock] = await Promise.all([
      this._measureUsage(config, includeUsage),
      this._measureFreeSpace(config),
      this._measureLibrary()
    ]);

    const reasons = [];
    if (libraryBlock) {
      reasons.push(buildLibraryReason(libraryBlock));
    }
    if (usage.limitBytes !== null && usage.downloadedBytes !== null && usage.downloadedBytes > usage.limitBytes) {
      reasons.push(buildUsageReason(usage.downloadedBytes, usage.limit, usage.limitBytes));
    }
    if (freeSpace.limitBytes !== null && freeSpace.availableBytes !== null && freeSpace.availableBytes < freeSpace.limitBytes) {
      reasons.push(buildFreeSpaceReason(freeSpace.availableBytes, freeSpace.limit, freeSpace.limitBytes));
    }

    const previousReasons = this.status.reasons;
    const wasPaused = this.status.paused;
    const paused = reasons.length > 0;
    this.status = {
      paused,
      pausedSince: paused ? (this.status.pausedSince || new Date().toISOString()) : null,
      reasons,
      usage,
      freeSpace,
      checkedAt: new Date().toISOString()
    };

    if (paused !== wasPaused) {
      this._onTransition(paused, previousReasons);
    }
    // While paused the numbers in the banner change, so keep clients current.
    if (paused || paused !== wasPaused) {
      MessageEmitter.emitMessage('broadcast', null, 'download', 'downloadPauseChanged', { ...this.status });
    }

    return this.status;
  }

  _onTransition(paused, previousReasons = []) {
    if (paused) {
      logger.warn({ reasons: this.status.reasons.map((r) => r.text) }, 'Downloads paused');
    } else {
      logger.info({ pausedFor: previousReasons.map((r) => r.text) }, 'Downloads resumed');
    }

    // A resume says what cleared, so the notification can name it.
    const notified = paused ? this.status : { ...this.status, resumedFrom: previousReasons };
    notificationModule.sendDownloadPauseNotification(notified).catch((err) => {
      logger.error({ err }, 'Failed to send download pause notification');
    });

    this._setRecheckTimer(paused);

    if (!paused) {
      this.emit('resumed');
    }
  }

  _setRecheckTimer(paused) {
    if (this.recheckTimer) {
      clearInterval(this.recheckTimer);
      this.recheckTimer = null;
    }
    if (!paused) {
      return;
    }
    this.recheckTimer = setInterval(() => {
      this.refresh().catch((err) => {
        logger.error({ err }, 'Periodic download pause re-check failed');
      });
    }, PAUSED_RECHECK_INTERVAL_MS);
    if (typeof this.recheckTimer.unref === 'function') {
      this.recheckTimer.unref();
    }
  }
}

module.exports = new StorageGuard();
module.exports.DownloadsPausedError = DownloadsPausedError;
module.exports.PAUSED_RECHECK_INTERVAL_MS = PAUSED_RECHECK_INTERVAL_MS;
module.exports.LIBRARY_CHECK_CACHE_MS = LIBRARY_CHECK_CACHE_MS;
module.exports.LIBRARY_CHECK_TIMEOUT_MS = LIBRARY_CHECK_TIMEOUT_MS;
