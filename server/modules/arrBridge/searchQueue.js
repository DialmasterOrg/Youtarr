// Caps and caches the YouTube searches the bridge starts. Over the cap a
// search is held, not refused: Sonarr and Radarr wait up to 100 s for an
// indexer, while any refusal disables the indexer for minutes, during which
// every search silently returns nothing.

const DEFAULT_MAX_CONCURRENT = 2;
// About 21 searches a minute. The window must stay shorter than the hold
// limit: a call that waits for the window to move on is then always let in
// before its hold runs out, so a fast burst is slowed down, never refused.
const DEFAULT_MAX_PER_WINDOW = 7;
const DEFAULT_WINDOW_MS = 20 * 1000;
// Well under the apps' 100 s, so a reverse proxy does not cut the request first.
const DEFAULT_HOLD_LIMIT_MS = 30 * 1000;
const DEFAULT_CACHE_TTL_MS = 10 * 60 * 1000;
const DEFAULT_CACHE_MAX_ENTRIES = 200;

class SearchUnavailableError extends Error {
  /**
   * @param {'hold-timeout'|'search-failed'} reason
   * @param {Error} [cause]
   */
  constructor(reason, cause) {
    super(reason === 'hold-timeout' ? 'Search was held too long' : 'Search failed', { cause });
    this.name = 'SearchUnavailableError';
    this.reason = reason;
  }
}

function createSearchQueue({
  maxConcurrent = DEFAULT_MAX_CONCURRENT,
  maxPerWindow = DEFAULT_MAX_PER_WINDOW,
  windowMs = DEFAULT_WINDOW_MS,
  holdLimitMs = DEFAULT_HOLD_LIMIT_MS,
  cacheTtlMs = DEFAULT_CACHE_TTL_MS,
  cacheMaxEntries = DEFAULT_CACHE_MAX_ENTRIES,
} = {}) {
  const cache = new Map();
  const inFlight = new Map();
  const waiters = [];
  let starts = [];
  let running = 0;
  let windowTimer = null;

  function canStart() {
    const cutoff = Date.now() - windowMs;
    starts = starts.filter((startedAt) => startedAt > cutoff);
    return running < maxConcurrent && starts.length < maxPerWindow;
  }

  function takeSlot() {
    running += 1;
    starts.push(Date.now());
  }

  // A slot freed by a finished search wakes the queue itself; a full
  // rate window needs a timer for when its oldest start ages out.
  function scheduleWindowWake() {
    if (windowTimer || waiters.length === 0 || starts.length < maxPerWindow) return;
    const delay = Math.max(0, starts[0] + windowMs - Date.now()) + 1;
    windowTimer = setTimeout(() => {
      windowTimer = null;
      drain();
    }, delay);
    windowTimer.unref?.();
  }

  function drain() {
    while (waiters.length > 0 && canStart()) {
      const waiter = waiters.shift();
      clearTimeout(waiter.timer);
      takeSlot();
      waiter.resolve();
    }
    scheduleWindowWake();
  }

  function acquire() {
    if (waiters.length === 0 && canStart()) {
      takeSlot();
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const waiter = { resolve, timer: null };
      waiter.timer = setTimeout(() => {
        waiters.splice(waiters.indexOf(waiter), 1);
        reject(new SearchUnavailableError('hold-timeout'));
      }, holdLimitMs);
      waiter.timer.unref?.();
      waiters.push(waiter);
      scheduleWindowWake();
    });
  }

  function release() {
    running -= 1;
    drain();
  }

  function readCache(key) {
    const entry = cache.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt > Date.now()) return entry;
    cache.delete(key);
    return undefined;
  }

  function writeCache(key, value) {
    cache.delete(key);
    cache.set(key, { value, expiresAt: Date.now() + cacheTtlMs });
    while (cache.size > cacheMaxEntries) cache.delete(cache.keys().next().value);
  }

  async function execute(key, work) {
    await acquire();
    let value;
    try {
      value = await work();
    } catch (cause) {
      throw new SearchUnavailableError('search-failed', cause);
    } finally {
      release();
    }
    writeCache(key, value);
    return value;
  }

  /**
   * @param {string} key - Identifies the search; equal keys share one result
   * @param {Function} work - Starts the search
   * @returns {Promise<*>} Rejects with SearchUnavailableError when the search
   *   was held too long or failed; a failure is never cached
   */
  function run(key, work) {
    const cached = readCache(key);
    if (cached) return Promise.resolve(cached.value);
    const pending = inFlight.get(key);
    if (pending) return pending;
    const promise = execute(key, work);
    inFlight.set(key, promise);
    const forget = () => inFlight.delete(key);
    promise.then(forget, forget);
    return promise;
  }

  return { run };
}

module.exports = { createSearchQueue, SearchUnavailableError };
