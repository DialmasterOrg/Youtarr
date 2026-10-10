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

function describeReasons(reasons) {
  return reasons.map((reason) => reason.text).join('; ');
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
 * Owns the "downloads paused because storage is full" state. Two optional
 * triggers, both off by default: total size of downloaded videos over
 * downloadPauseUsageLimit, and free disk space under downloadPauseMinFreeSpace.
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

  async _evaluateAndApply({ includeUsage }) {
    const config = configModule.getConfig();
    const [usage, freeSpace] = await Promise.all([
      this._measureUsage(config, includeUsage),
      this._measureFreeSpace(config)
    ]);

    const reasons = [];
    if (usage.limitBytes !== null && usage.downloadedBytes !== null && usage.downloadedBytes > usage.limitBytes) {
      reasons.push(buildUsageReason(usage.downloadedBytes, usage.limit, usage.limitBytes));
    }
    if (freeSpace.limitBytes !== null && freeSpace.availableBytes !== null && freeSpace.availableBytes < freeSpace.limitBytes) {
      reasons.push(buildFreeSpaceReason(freeSpace.availableBytes, freeSpace.limit, freeSpace.limitBytes));
    }

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
      this._onTransition(paused);
    }
    // While paused the numbers in the banner change, so keep clients current.
    if (paused || paused !== wasPaused) {
      MessageEmitter.emitMessage('broadcast', null, 'download', 'downloadPauseChanged', { ...this.status });
    }

    return this.status;
  }

  _onTransition(paused) {
    if (paused) {
      logger.warn({ reasons: this.status.reasons.map((r) => r.text) }, 'Downloads paused: storage limit reached');
    } else {
      logger.info('Downloads resumed: storage is back within limits');
    }

    notificationModule.sendDownloadPauseNotification(this.status).catch((err) => {
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
