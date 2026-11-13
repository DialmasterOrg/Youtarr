/**
 * Shared registry of in-flight channel fetch/detection operations.
 * All channel sub-modules share this one instance so concurrency
 * guards work across module boundaries.
 */
// How long a finished refresh's result stays readable, so a client that
// checks after the refresh ended still learns what it found.
const LAST_RESULT_TTL_MS = 2 * 60 * 1000;

class FetchRegistry {
  constructor() {
    this.activeFetches = new Map();
    this.lastResults = new Map();
  }

  /**
   * End an in-flight operation and keep its result for LAST_RESULT_TTL_MS.
   * @param {string} key - Registry key (channelId:tabType)
   * @param {Object} result
   * @param {string} result.type - Operation type ('autoRefresh', 'feedCheck')
   * @param {number} result.newVideos - Rows the refresh added
   * @param {boolean} result.failed - Whether the refresh failed
   */
  finish(key, { type, newVideos, failed }) {
    this.activeFetches.delete(key);
    this.pruneLastResults();
    this.lastResults.set(key, {
      result: { type, newVideos, failed, finishedAt: new Date().toISOString() },
      expiresAt: Date.now() + LAST_RESULT_TTL_MS,
    });
  }

  /**
   * The result of the last finished refresh for a key, while it is still kept.
   * @param {string} key - Registry key (channelId:tabType)
   * @returns {Object|null}
   */
  getLastResult(key) {
    this.pruneLastResults();
    const entry = this.lastResults.get(key);
    return entry ? entry.result : null;
  }

  pruneLastResults() {
    const now = Date.now();
    for (const [key, entry] of this.lastResults.entries()) {
      if (entry.expiresAt <= now) this.lastResults.delete(key);
    }
  }

  has(key) {
    return this.activeFetches.has(key);
  }

  get(key) {
    return this.activeFetches.get(key);
  }

  set(key, value) {
    this.activeFetches.set(key, value);
    // A new fetch of the tab makes the previous refresh's result stale: left
    // in place, it would be read as the outcome of this fetch when it ends.
    this.lastResults.delete(key);
  }

  delete(key) {
    this.activeFetches.delete(key);
  }

  /**
   * Merge fields into an in-flight operation's record; a no-op once it has ended.
   * @param {string} key - Registry key (channelId:tabType)
   * @param {Object} fields - Fields to merge
   */
  update(key, fields) {
    const existing = this.activeFetches.get(key);
    if (existing) {
      this.activeFetches.set(key, { ...existing, ...fields });
    }
  }

  /**
   * Check if a fetch operation is currently in progress for a channel/tab combination
   * @param {string} channelId - Channel ID to check
   * @param {string} tabType - Tab type to check (optional, defaults to checking any tab)
   * @returns {Object} - Object with isFetching boolean and operation details if fetching
   */
  isFetchInProgress(channelId, tabType = null) {
    if (tabType) {
      // Check for specific tab
      const key = `${channelId}:${tabType}`;
      if (this.activeFetches.has(key)) {
        const activeOperation = this.activeFetches.get(key);
        return {
          isFetching: true,
          startTime: activeOperation.startTime,
          type: activeOperation.type,
          tabType: tabType,
          ...(activeOperation.progress ? { progress: activeOperation.progress } : {})
        };
      }
      const lastResult = this.getLastResult(key);
      if (lastResult) {
        return { isFetching: false, lastResult };
      }
    } else {
      // Check for any tab on this channel (legacy behavior)
      for (const [key, value] of this.activeFetches.entries()) {
        if (key.startsWith(`${channelId}:`)) {
          return {
            isFetching: true,
            startTime: value.startTime,
            type: value.type,
            tabType: key.split(':')[1]
          };
        }
      }
    }
    return { isFetching: false };
  }
}

module.exports = new FetchRegistry();
