// The real resolution of the videos a search offers, so a release is labeled
// with what its file will be rather than the download resolution, which is
// only a ceiling. Sources, in order: the library file's stored pixel size,
// the YouTube Data API's definition, earlier probes, a yt-dlp probe. A video
// none of them knows is left out, and its label stays at the ceiling.
// Probing is bounded, so a yt-dlp that cannot answer (a bot check, a
// timeout) never holds a search past the lookup's budget.
const { resolutionLabel } = require('./releaseNaming');

const PROBE_CONCURRENCY = 2;
const MAX_PROBES_PER_LOOKUP = 10;
// Over a rolling hour, so a bulk search in Sonarr cannot start hundreds of
// yt-dlp runs from the user's IP.
const MAX_PROBES_PER_HOUR = 100;
const PROBE_WINDOW_MS = 60 * 60 * 1000;
const LOOKUP_BUDGET_MS = 20000;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 2000;
const FAILURES_BEFORE_PAUSE = 3;
const PAUSE_MS = 15 * 60 * 1000;
const SD_TIER = 480;
// 'hd' only says 720 or more, so it settles a ceiling of 720 or lower.
const HD_TIER = 720;

const isTier = (value) => typeof value === 'number' && Number.isFinite(value) && value > 0;

/**
 * The resolution Sonarr and Radarr read from a file of this size. Their 576p
 * step has no web quality, so it counts as 480 here.
 * @param {number} width
 * @param {number} height
 * @returns {480|720|1080|2160}
 */
function tierOfPixels(width, height) {
  if (width >= 3200 || height >= 2100) return 2160;
  if (width >= 1800 || height >= 1000) return 1080;
  if (width >= 1200 || height >= 700) return 720;
  return 480;
}

function tierOfDefinition(definition, ceilingLabel) {
  if (definition === 'sd') return SD_TIER;
  if (definition === 'hd' && ceilingLabel <= HD_TIER) return HD_TIER;
  return null;
}

/**
 * @param {Object} deps
 * @param {Function} deps.libraryResolutions - (ids) => Promise<Map<id, tier>> of library files
 * @param {Function} deps.probe - (id) => Promise<number|null>, the highest resolution yt-dlp lists
 * @param {Object} deps.logger
 * @param {Function} [deps.now] - () => milliseconds
 */
function createVideoResolution({ libraryResolutions, probe, logger, now = Date.now }) {
  const cache = new Map();
  // One probe per video, shared by every lookup that asks while it runs.
  const inFlight = new Map();
  // The probe slots are shared by all lookups; a freed slot passes straight
  // to the next waiter.
  const slotWaiters = [];
  let running = 0;
  let failuresInRow = 0;
  let pausedUntil = 0;
  // When each probe in the last hour started, oldest first.
  const probeStarts = [];

  const isPaused = () => pausedUntil > now();

  function readCache(id) {
    const entry = cache.get(id);
    if (!entry) return null;
    if (entry.expiresAt > now()) return entry.tier;
    cache.delete(id);
    return null;
  }

  function writeCache(id, tier) {
    cache.delete(id);
    cache.set(id, { tier, expiresAt: now() + CACHE_TTL_MS });
    while (cache.size > CACHE_MAX_ENTRIES) cache.delete(cache.keys().next().value);
  }

  function hourlyCapReached() {
    const cutoff = now() - PROBE_WINDOW_MS;
    while (probeStarts.length > 0 && probeStarts[0] <= cutoff) probeStarts.shift();
    return probeStarts.length >= MAX_PROBES_PER_HOUR;
  }

  // Only answers are cached: a failed probe is asked again next time.
  function recordAnswer(id, tier) {
    if (tier !== null) {
      failuresInRow = 0;
      writeCache(id, tier);
      return;
    }
    failuresInRow += 1;
    if (failuresInRow < FAILURES_BEFORE_PAUSE) return;
    failuresInRow = 0;
    pausedUntil = now() + PAUSE_MS;
    logger.warn(
      { failedInRow: FAILURES_BEFORE_PAUSE, pauseMinutes: PAUSE_MS / 60000 },
      'Sonarr/Radarr resolution probes paused: yt-dlp gave no answer'
    );
  }

  // Resolves false when the lookup ended before a slot was free.
  function takeSlot(lookupState) {
    if (running < PROBE_CONCURRENCY) {
      running += 1;
      return Promise.resolve(true);
    }
    return new Promise((resolve) => slotWaiters.push({ resolve, lookupState }));
  }

  function freeSlot() {
    const next = slotWaiters.shift();
    if (next) next.resolve(true);
    else running -= 1;
  }

  function dropWaiters(lookupState) {
    for (let index = slotWaiters.length - 1; index >= 0; index -= 1) {
      if (slotWaiters[index].lookupState === lookupState) slotWaiters.splice(index, 1)[0].resolve(false);
    }
  }

  // Never rejects. A probe still running when its lookup gives up keeps its
  // slot until it settles, and its answer still fills the cache.
  function startProbe(id) {
    probeStarts.push(now());
    const settled = Promise.resolve()
      .then(() => probe(id))
      .then((tier) => (isTier(tier) ? tier : null), () => null)
      .then((tier) => {
        recordAnswer(id, tier);
        return tier;
      })
      .finally(() => {
        inFlight.delete(id);
        freeSlot();
      });
    inFlight.set(id, settled);
    return settled;
  }

  async function probeOnce(id, lookupState) {
    const pending = inFlight.get(id);
    if (pending) return pending;
    if (!(await takeSlot(lookupState))) return null;
    if (lookupState.done || isPaused()) {
      freeSlot();
      return null;
    }
    // Another lookup may have probed it, or still be probing it, while this
    // one waited for a slot.
    const answered = readCache(id);
    const started = inFlight.get(id);
    if (answered !== null || started) {
      freeSlot();
      return answered ?? started;
    }
    if (hourlyCapReached()) {
      freeSlot();
      lookupState.probed -= 1;
      lookupState.skippedForHourlyCap += 1;
      return null;
    }
    return startProbe(id);
  }

  async function probeQueue(queue, tiers, lookupState) {
    while (queue.length > 0 && !lookupState.done && !isPaused()) {
      const id = queue.shift();
      lookupState.probed += 1;
      // eslint-disable-next-line no-await-in-loop
      const tier = await probeOnce(id, lookupState);
      if (tier !== null && !lookupState.done) tiers.set(id, tier);
    }
  }

  async function readLibrary(ids) {
    try {
      return await libraryResolutions(ids);
    } catch (err) {
      logger.warn({ err }, 'Sonarr/Radarr resolution lookup could not read the library');
      return new Map();
    }
  }

  async function fill(byId, ceilingLabel, tiers, lookupState) {
    const library = await readLibrary([...byId.keys()]);
    if (lookupState.done) return;
    const unknown = [];
    for (const [id, candidate] of byId) {
      const libraryTier = library.get(id);
      const tier = (isTier(libraryTier) ? libraryTier : null)
        ?? tierOfDefinition(candidate.definition, ceilingLabel)
        ?? readCache(id);
      if (tier !== null) tiers.set(id, tier);
      else unknown.push(id);
    }
    if (isPaused()) return;
    const queue = unknown.slice(0, MAX_PROBES_PER_LOOKUP);
    await Promise.all(Array.from({ length: PROBE_CONCURRENCY }, () => probeQueue(queue, tiers, lookupState)));
  }

  /**
   * @param {Array<{youtubeId: string, definition?: string|null}>} candidates - Search results
   * @param {Object} options
   * @param {unknown} options.ceiling - The highest label any answer can give
   * @param {number} [options.budgetMs] - How long the lookup may take
   * @returns {Promise<Map<string, number>>} The resolution of each video that is known.
   *   Answers within budgetMs with whatever is known by then.
   */
  async function lookup(candidates, { ceiling, budgetMs = LOOKUP_BUDGET_MS } = {}) {
    const tiers = new Map();
    const byId = new Map(candidates.map((candidate) => [candidate.youtubeId, candidate]));
    const ceilingLabel = resolutionLabel(ceiling);
    // Under a 480 ceiling every label is 480, whatever the video is.
    if (byId.size === 0 || ceilingLabel <= SD_TIER) return tiers;
    const lookupState = { done: false, probed: 0, skippedForHourlyCap: 0 };
    let timer;
    const budget = new Promise((resolve) => {
      timer = setTimeout(resolve, budgetMs);
      timer.unref?.();
    });
    try {
      await Promise.race([fill(byId, ceilingLabel, tiers, lookupState), budget]);
    } finally {
      lookupState.done = true;
      clearTimeout(timer);
      dropWaiters(lookupState);
    }
    if (lookupState.probed > 0 || lookupState.skippedForHourlyCap > 0) {
      logger.info(
        {
          probed: lookupState.probed,
          known: tiers.size,
          unknown: byId.size - tiers.size,
          ...(lookupState.skippedForHourlyCap > 0 && { skippedForHourlyCap: lookupState.skippedForHourlyCap }),
        },
        'Sonarr/Radarr resolution lookup probed videos'
      );
    }
    return tiers;
  }

  return { lookup };
}

module.exports = {
  PROBE_CONCURRENCY,
  MAX_PROBES_PER_LOOKUP,
  MAX_PROBES_PER_HOUR,
  LOOKUP_BUDGET_MS,
  CACHE_TTL_MS,
  CACHE_MAX_ENTRIES,
  FAILURES_BEFORE_PAUSE,
  PAUSE_MS,
  tierOfPixels,
  createVideoResolution,
};
