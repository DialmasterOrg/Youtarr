// Only legacy timestamp cutoffs need a tolerance for second-precision DATETIME.
// New setups use an entry id captured after refreshing the playlist.
const BASELINE_TOLERANCE_MS = 1000;

function eligible(candidates) {
  return candidates.filter((c) => !c.downloaded && !c.unavailable && !c.ignored);
}

function publicationTime(value) {
  if (typeof value !== 'string' || !/^\d{8}$/.test(value)) return null;
  const iso = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  const time = Date.parse(`${iso}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().startsWith(iso) ? time : null;
}

function selectBatchEntries({ candidates, order, limit }) {
  const available = eligible(candidates);
  const missingDates = available.filter((c) => publicationTime(c.published_at) === null).length;
  // Unknown dates might be newest: require a positional or manual choice.
  if (order === 'published' && missingDates) return { selected: [], missingDates };
  const selected = available.slice().sort((a, b) => {
    if (order === 'published') {
      return publicationTime(b.published_at) - publicationTime(a.published_at) || a.position - b.position;
    }
    return order === 'desc' ? b.position - a.position : a.position - b.position;
  }).slice(0, limit);
  return { selected, missingDates };
}

function selectNewSinceBaseline({ candidates, baselineAt, baselineId, limit }) {
  const cutoff = new Date(baselineAt).getTime() + BASELINE_TOLERANCE_MS;
  const discoveries = [];
  const retries = [];
  for (const candidate of eligible(candidates)) {
    const isDiscovery = baselineId != null
      ? candidate.id > baselineId
      : candidate.added_at && new Date(candidate.added_at).getTime() > cutoff;
    // A selected video that is also new uses only the discovery allowance.
    if (isDiscovery) discoveries.push(candidate);
    else if (candidate.auto_download_requested) retries.push(candidate);
  }
  discoveries.sort((a, b) => {
    const bySeen = new Date(b.first_seen_at || b.added_at).getTime() - new Date(a.first_seen_at || a.added_at).getTime();
    return bySeen || a.position - b.position || a.id - b.id;
  });
  retries.sort((a, b) => {
    // Unknown attempts go first, still within the retry allowance. Older
    // attempts rotate ahead of requests selected on the last sweep.
    const attemptedA = a.auto_download_last_attempt_at ? new Date(a.auto_download_last_attempt_at).getTime() : 0;
    const attemptedB = b.auto_download_last_attempt_at ? new Date(b.auto_download_last_attempt_at).getTime() : 0;
    return attemptedA - attemptedB || a.id - b.id || a.position - b.position;
  });
  return { discoveries: discoveries.slice(0, limit), retries: retries.slice(0, limit) };
}

module.exports = { selectBatchEntries, selectNewSinceBaseline };
