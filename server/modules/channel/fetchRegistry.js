/**
 * Shared registry of in-flight channel fetch/detection operations.
 * All channel sub-modules share this one instance so concurrency
 * guards work across module boundaries.
 */
class FetchRegistry {
  constructor() {
    this.activeFetches = new Map();
  }

  has(key) {
    return this.activeFetches.has(key);
  }

  get(key) {
    return this.activeFetches.get(key);
  }

  set(key, value) {
    this.activeFetches.set(key, value);
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
