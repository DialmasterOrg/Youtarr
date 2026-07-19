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
          tabType: tabType
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
