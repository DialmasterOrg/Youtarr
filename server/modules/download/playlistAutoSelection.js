/**
 * Pure selection logic for playlist auto-downloads (seed-then-track).
 *
 * Playlist `position` is whatever order YouTube serves, which the playlist
 * owner controls (bottom-append, newest-at-top, most-popular, ...). It is NOT
 * a recency signal, so tracking runs select by added_at - the first time the
 * refresh saw the row - which is ordering-proof. The one-time seed run selects
 * the latest N by position so subscribing still downloads immediately.
 */

// added_at is a second-precision DATETIME; rows inserted by the seed run's own
// refresh can share the baseline's second, so require strictly-greater with a
// one-second margin (same rationale as ADDED_AT_TOLERANCE_MS in playlistModule).
const BASELINE_TOLERANCE_MS = 1000;

// Channel uploads playlists (UUxxxx) are served newest-first by construction,
// so their "latest N" seed comes from the head. Regular playlists seed from
// the tail: their serve direction is unknowable, so the tail is the safe
// default.
function isUploadsPlaylist(playlistId) {
  return typeof playlistId === 'string' && playlistId.startsWith('UU');
}

function eligible(candidates) {
  return candidates.filter((c) => !c.downloaded && !c.unavailable);
}

function selectSeedEntries({ candidates, playlistId, limit }) {
  const headFirst = isUploadsPlaylist(playlistId);
  return eligible(candidates)
    .slice()
    .sort((a, b) => (headFirst ? a.position - b.position : b.position - a.position))
    .slice(0, limit);
}

function selectNewSinceBaseline({ candidates, baselineAt, limit }) {
  const cutoff = new Date(baselineAt).getTime() + BASELINE_TOLERANCE_MS;
  return eligible(candidates)
    .filter((c) => c.added_at && new Date(c.added_at).getTime() > cutoff)
    .sort((a, b) => {
      const byAdded = new Date(b.added_at).getTime() - new Date(a.added_at).getTime();
      return byAdded !== 0 ? byAdded : a.position - b.position;
    })
    .slice(0, limit);
}

module.exports = {
  BASELINE_TOLERANCE_MS,
  isUploadsPlaylist,
  selectSeedEntries,
  selectNewSinceBaseline,
};
