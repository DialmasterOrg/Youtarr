/**
 * Comparisons between a media server's watch state of an item and a held
 * snapshot of Youtarr's row. Pure, so push-back can decide before writing
 * what the sync decides after reading (watchStatusHolds).
 */

// Last-watched times compare with a little slack: servers round them.
const WATCHED_AT_TOLERANCE_MS = 1000;

function timeOf(value) {
  return value ? new Date(value).getTime() : null;
}

/**
 * The server reports at least the held state: played when the snapshot was,
 * else played or a resume position no earlier than the snapshot's.
 */
function isAtLeast(entry, snapshot) {
  if (snapshot.played) return Boolean(entry.played);
  return Boolean(entry.played) || (entry.positionMs || 0) >= (snapshot.positionMs || 0);
}

/**
 * A watch made after the snapshot: finished when the snapshot wasn't, or a
 * later last-watched time. Finishing resets the position to zero, which
 * "played" covers.
 */
function isLaterWatch(entry, snapshot) {
  if (entry.played && !snapshot.played) return true;
  const entryTime = timeOf(entry.lastWatchedAt);
  const snapshotTime = timeOf(snapshot.lastWatchedAt);
  return entryTime !== null && snapshotTime !== null && entryTime > snapshotTime + WATCHED_AT_TOLERANCE_MS;
}

module.exports = {
  WATCHED_AT_TOLERANCE_MS,
  timeOf,
  isAtLeast,
  isLaterWatch
};
