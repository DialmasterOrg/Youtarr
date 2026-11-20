// What grabExecutor remembers while YouTube blocks downloads (issue #1048).
// A block usually covers the whole IP address, so it is one state, not one
// per grab: waiting grabs are tried one an hour until one gets through.
// `blocked_at` on the grab row survives a restart; everything here is in
// memory, so after a restart the next try is due at once.
const BLOCK_RETRY_MS = 60 * 60 * 1000;
const BLOCK_GIVE_UP_MS = 24 * 60 * 60 * 1000;

/**
 * @param {Object} deps
 * @param {Function} [deps.now]
 * @param {Function} [deps.getCookieKey] - () => what identifies the cookie file in use, or null
 */
function createBlockWait({ now = () => new Date(), getCookieKey = () => null } = {}) {
  let nextTry = 0;
  // When a download was last blocked; 0 once one got through since.
  let lastBlocked = 0;
  // When a download last got through; 0 when none has since the server started.
  let lastSuccess = 0;
  let cookieKeyAtBlock = null;
  let active = false;
  // Grabs the user asked to try again now, until that try ends.
  const forced = new Set();
  // Grabs that were offered the try that is due and could not take it.
  const passed = new Set();

  // A cookie file that cannot be read is no reason to try early.
  function readCookieKey() {
    try {
      return getCookieKey() ?? null;
    } catch {
      return cookieKeyAtBlock;
    }
  }

  /** A download was just blocked: the next try is an hour from now. */
  function recordBlocked() {
    lastBlocked = now().getTime();
    nextTry = lastBlocked + BLOCK_RETRY_MS;
    cookieKeyAtBlock = readCookieKey();
  }

  /** A download got through, so the block is over: the waiting grabs need not wait out the hour. */
  function recordSuccess() {
    nextTry = 0;
    lastBlocked = 0;
    lastSuccess = now().getTime();
  }

  /**
   * Whether a download got through after the given moment. A grab that has
   * not been tried since then was not blocked all that time: it only waited
   * its turn, and must not be failed for it.
   * @param {Date|string} since
   */
  function gotThroughSince(since) {
    return lastSuccess > new Date(since).getTime();
  }

  /**
   * Whether YouTube may still be blocking: the last word from it was a block
   * and no download got through since. So grabs keep going one at a time
   * also when the blocked grab itself has left the queue. Forgotten after a
   * day without another blocked download.
   */
  function isSuspected() {
    return lastBlocked > 0 && now().getTime() - lastBlocked < BLOCK_GIVE_UP_MS;
  }

  /**
   * Whether a waiting grab may be tried. New or removed cookies are the fix
   * the block's advice names, so a changed cookie file makes a try due.
   */
  function isDue() {
    if (now().getTime() >= nextTry) return true;
    if (readCookieKey() === cookieKeyAtBlock) return false;
    nextTry = 0;
    return true;
  }

  /** @returns {Date|null} When the next automatic try is; null when one is due. */
  function nextTryAt() {
    return nextTry > now().getTime() ? new Date(nextTry) : null;
  }

  /** A grab is failed once its first block is this old and it is blocked still. */
  function isExpired(grab) {
    if (!grab.blocked_at) return false;
    return now().getTime() - new Date(grab.blocked_at).getTime() >= BLOCK_GIVE_UP_MS;
  }

  return {
    recordBlocked,
    recordSuccess,
    isSuspected,
    isDue,
    nextTryAt,
    isExpired,
    gotThroughSince,
    force: (grabId) => forced.add(grabId),
    isForced: (grabId) => forced.has(grabId),
    release: (grabId) => forced.delete(grabId),
    // The try that is due goes to one grab per sweep. One that cannot take
    // it (its file cannot be checked, say) is skipped until another did.
    passTry: (grabId) => passed.add(grabId),
    hasPassedTry: (grabId) => passed.has(grabId),
    resetPassedTries: () => passed.clear(),
    setActive: (value) => {
      active = value;
    },
    isActive: () => active,
  };
}

module.exports = { createBlockWait, BLOCK_RETRY_MS, BLOCK_GIVE_UP_MS };
