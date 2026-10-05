/**
 * Episode numbers for a channel's title shows, decided from the title matches
 * and the stored classifications (pure: no database, no Python).
 *
 * - A number taken from a title follows the title. The video holding it keeps
 *   it while it still claims it; among new claimants the earliest available
 *   upload wins and the others become duplicates (no number).
 * - Order numbers are allocated once, past the season's high-water mark,
 *   oldest upload first, and kept while the video stays in that season.
 * - Upload-time numbers (year seasons, date episodes) wait for the download;
 *   a downloaded video keeps the number it already holds in the show.
 * - "Not an episode" rows and manual assignments are never touched by
 *   classification; overrides (the user's assignments) come first.
 * - A video that no longer matches leaves its title show (its row is
 *   released), except order and manual numbers of a retired show, which stay
 *   while nothing else claims the video.
 */

const { MATCH_KIND } = require('./titleMatcher');
const { MIN_YEAR_SEASON } = require('./patternCompiler');

const ROW_STATUS = Object.freeze({
  ASSIGNED: 'assigned',
  PENDING: 'pending_number',
  DUPLICATE: 'duplicate',
  UNSUPPORTED: 'unsupported',
  OPTED_OUT: 'opted_out',
  ERROR: 'error',
});

const SOURCE = Object.freeze({ TITLE: 'title', ORDER: 'order', DATE: 'date', MANUAL: 'manual', ADOPTED: 'adopted' });
const DEFAULT_GAP_LIMIT = 50;

const numberKey = (showKey, season, episode) => `${showKey}|${season}|${episode}`;
const seasonKey = (showKey, season) => `${showKey}|${season}`;

function keepRow(row) {
  return {
    showKey: row.showKey,
    status: row.status,
    season: row.season,
    episode: row.episode,
    source: row.source,
    patternKey: row.patternKey || null,
    episodeTitle: row.episodeTitle || null,
    titleOptOut: Boolean(row.titleOptOut),
    keep: true,
  };
}

function newRow(values) {
  return {
    season: null, episode: null, source: null, patternKey: null, episodeTitle: null, titleOptOut: false, keep: false, ...values,
  };
}

function holdsNumber(row) {
  return row && row.status === ROW_STATUS.ASSIGNED && row.season !== null && row.episode !== null;
}

function sameNumber(a, b) {
  return a.showKey === b.showKey && a.season === b.season && a.episode === b.episode;
}

// The earliest available upload first; ids break ties so the result never
// depends on listing order.
function byUploadOrder(a, b) {
  if (a.available !== b.available) return a.available ? -1 : 1;
  if (a.publishedAtMs !== b.publishedAtMs) return a.publishedAtMs - b.publishedAtMs;
  return a.youtubeId < b.youtubeId ? -1 : a.youtubeId > b.youtubeId ? 1 : 0;
}

/**
 * @param {Object} params
 * @param {Array<{youtubeId: string, publishedAtMs: number, available: boolean, downloaded: boolean}>} params.videos
 * @param {Map<string, Object>} params.matches - titleMatcher results by youtube id (active title shows only)
 * @param {Map<string, Object>} params.stored - Stored rows by youtube id:
 *   { showKey, showKind, showActive, status, season, episode, source, titleOptOut, patternKey, episodeTitle }
 * @param {Map<string, number>} params.highWater - Order high-water marks by `${showKey}|${season}`
 * @param {Set<string>} [params.frozen] - Videos left exactly as stored (a listing refresh classifies only new videos)
 * @param {Map<string, Object>} [params.overrides] - By youtube id: { showKey, season, episode } (manual),
 *   { optOut: true } ("Not an episode") or { reset: true } (back to automatic classification)
 * @returns {{rows: Map<string, Object|null>, duplicates: Array<Object>, unsupported: Array<Object>, highWater: Map<string, number>}}
 *   rows: the row each video should have; null releases its stored row. Videos
 *   with neither a match nor a stored row are absent.
 */
function planNumbers({ videos, matches, stored, highWater, overrides = new Map(), frozen = new Set() }) {
  const rows = new Map();
  const duplicates = [];
  const unsupported = [];
  const nextHighWater = new Map(highWater);
  const claims = new Map();
  const toAllocate = [];
  const taken = new Map();

  const take = (row, youtubeId) => taken.set(numberKey(row.showKey, row.season, row.episode), youtubeId);
  // A manual assignment takes its number from whichever video holds it.
  const overridden = new Map();
  for (const [youtubeId, override] of overrides) {
    if (override && !override.reset && !override.optOut) overridden.set(numberKey(override.showKey, override.season, override.episode), youtubeId);
  }
  const displacedBy = (row, youtubeId) => {
    if (!holdsNumber(row)) return false;
    const holder = overridden.get(numberKey(row.showKey, row.season, row.episode));
    return holder !== undefined && holder !== youtubeId;
  };
  const duplicateOf = (youtubeId, match, holderId) => {
    rows.set(youtubeId, newRow({
      showKey: match.showKey, status: ROW_STATUS.DUPLICATE, source: SOURCE.TITLE,
      patternKey: match.patternKey, episodeTitle: match.episodeTitle,
    }));
    duplicates.push({ youtubeId, showKey: match.showKey, season: match.season, episode: match.episode, duplicateOf: holderId });
  };

  for (const video of videos) {
    const { youtubeId } = video;
    if (frozen.has(youtubeId)) {
      const kept = stored.get(youtubeId);
      if (kept) {
        rows.set(youtubeId, keepRow(kept));
        if (holdsNumber(kept)) take(kept, youtubeId);
      }
      continue;
    }
    const override = overrides.get(youtubeId);
    const reset = Boolean(override && override.reset);
    let row = stored.get(youtubeId) || null;
    // Back to automatic classification: a manual number or "Not an episode"
    // is forgotten (a channel-show episode keeps its number).
    if (reset && row) row = row.showKind === 'channel' ? { ...row, titleOptOut: false } : null;
    // A holder whose number an override takes is classified as if it held nothing.
    const displaced = displacedBy(row, youtubeId);
    if (displaced) row = null;
    const match = matches.get(youtubeId) || null;

    if (override && override.optOut) {
      const showKey = (match && match.showKey) || (row && row.showKey);
      if (showKey) rows.set(youtubeId, newRow({ showKey, status: ROW_STATUS.OPTED_OUT, titleOptOut: true }));
      continue;
    }
    if (override && !reset) {
      const manual = newRow({
        showKey: override.showKey, status: ROW_STATUS.ASSIGNED, season: override.season, episode: override.episode,
        source: SOURCE.MANUAL, episodeTitle: (match && match.episodeTitle) || (row && row.episodeTitle) || null,
        titleOptOut: false,
      });
      rows.set(youtubeId, manual);
      take(manual, youtubeId);
      continue;
    }
    if (row && (row.titleOptOut || (row.source === SOURCE.MANUAL && row.showActive))) {
      rows.set(youtubeId, keepRow(row));
      if (holdsNumber(row)) take(row, youtubeId);
      continue;
    }

    if (!match) {
      if (!row) {
        if ((reset || displaced) && stored.has(youtubeId)) rows.set(youtubeId, null);
        continue;
      }
      const keepsRow = row.showKind === 'channel'
        || (!row.showActive && holdsNumber(row) && [SOURCE.ORDER, SOURCE.MANUAL].includes(row.source));
      if (keepsRow) {
        rows.set(youtubeId, keepRow(row));
        if (holdsNumber(row)) take(row, youtubeId);
      } else {
        rows.set(youtubeId, null);
      }
      continue;
    }

    const inShow = row && row.showKey === match.showKey && holdsNumber(row);
    if (match.kind === MATCH_KIND.UNSUPPORTED) {
      rows.set(youtubeId, newRow({
        showKey: match.showKey, status: ROW_STATUS.UNSUPPORTED, patternKey: match.patternKey, episodeTitle: match.episodeTitle,
      }));
      unsupported.push({
        youtubeId, showKey: match.showKey, reason: match.reason, season: match.season, episode: match.episode,
        episodeEnd: match.episodeEnd || null, part: match.part || null,
      });
    } else if (match.kind === MATCH_KIND.PENDING) {
      // A downloaded video's verdict was decided at its download, with the
      // upload time this plan lacks: a duplicate stays one.
      const decidedAtDownload = video.downloaded && row && row.showKey === match.showKey && row.status === ROW_STATUS.DUPLICATE;
      // A number held from an earlier pattern (a fixed season, another title
      // episode) doesn't fit an upload-year season: the video waits again.
      const fitsUploadTime = inShow && row.season >= MIN_YEAR_SEASON
        && (match.episode === null || match.episode === undefined || row.episode === match.episode);
      if (fitsUploadTime) {
        rows.set(youtubeId, { ...keepRow(row), patternKey: match.patternKey, keep: row.patternKey === match.patternKey });
        take(row, youtubeId);
      } else if (decidedAtDownload) {
        rows.set(youtubeId, keepRow(row));
      } else {
        // A title episode waits for the season its upload year gives (kept
        // for the reorganize; never stored).
        rows.set(youtubeId, newRow({
          showKey: match.showKey, status: ROW_STATUS.PENDING, patternKey: match.patternKey, episodeTitle: match.episodeTitle,
          titleEpisode: match.episode,
        }));
      }
    } else if (match.kind === MATCH_KIND.ORDER) {
      if (inShow && row.source === SOURCE.ORDER && row.season === match.season) {
        rows.set(youtubeId, { ...keepRow(row), patternKey: match.patternKey, episodeTitle: match.episodeTitle, keep: row.patternKey === match.patternKey && row.episodeTitle === match.episodeTitle });
        take(row, youtubeId);
      } else {
        toAllocate.push({ video, match });
      }
    } else {
      const key = numberKey(match.showKey, match.season, match.episode);
      if (!claims.has(key)) claims.set(key, []);
      claims.get(key).push({ video, match, row });
    }
  }

  for (const [key, claimants] of claims) {
    let winner = null;
    if (!taken.has(key)) {
      // The stored holder keeps its number while it can still be had.
      winner = claimants.find(({ video, row, match }) => holdsNumber(row) && row.source === SOURCE.TITLE && sameNumber(row, match)
        && (video.available || video.downloaded))
        || [...claimants].sort((a, b) => byUploadOrder(a.video, b.video))[0];
    }
    const holderId = winner ? winner.video.youtubeId : taken.get(key);
    for (const claimant of claimants) {
      const { video, match, row } = claimant;
      if (claimant !== winner) {
        duplicateOf(video.youtubeId, match, holderId);
        // A channel-show episode stays one; the conflict records the duplicate.
        if (row && row.showKind === 'channel') {
          rows.set(video.youtubeId, keepRow(row));
          if (holdsNumber(row)) take(row, video.youtubeId);
        }
        continue;
      }
      const unchanged = holdsNumber(row) && row.source === SOURCE.TITLE && sameNumber(row, match)
        && row.patternKey === match.patternKey && (row.episodeTitle || null) === (match.episodeTitle || null);
      rows.set(video.youtubeId, newRow({
        showKey: match.showKey, status: ROW_STATUS.ASSIGNED, season: match.season, episode: match.episode,
        source: SOURCE.TITLE, patternKey: match.patternKey, episodeTitle: match.episodeTitle, keep: unchanged,
      }));
      taken.set(key, video.youtubeId);
    }
  }

  toAllocate.sort((a, b) => byUploadOrder({ ...a.video, available: true }, { ...b.video, available: true }));
  for (const { video, match } of toAllocate) {
    const season = seasonKey(match.showKey, match.season);
    let episode = (nextHighWater.get(season) || 0) + 1;
    while (taken.has(numberKey(match.showKey, match.season, episode))) episode += 1;
    nextHighWater.set(season, episode);
    const allocated = newRow({
      showKey: match.showKey, status: ROW_STATUS.ASSIGNED, season: match.season, episode,
      source: SOURCE.ORDER, patternKey: match.patternKey, episodeTitle: match.episodeTitle,
    });
    rows.set(video.youtubeId, allocated);
    take(allocated, video.youtubeId);
  }

  return { rows, duplicates, unsupported, highWater: nextHighWater };
}

/**
 * Missing episode numbers per title- or order-numbered season (1 up to the
 * highest number held). Seasons holding date-numbered episodes have none:
 * they are sparse by design.
 *
 * @param {Array<{showKey: string, status: string, season: number, episode: number, source: string}>} rows
 * @param {{limit?: number}} [options]
 * @returns {Array<{showKey: string, season: number, have: number, highest: number, missing: number[], truncated: boolean}>}
 */
function computeGaps(rows, { limit = DEFAULT_GAP_LIMIT } = {}) {
  const seasons = new Map();
  for (const row of rows) {
    if (!holdsNumber(row)) continue;
    const key = seasonKey(row.showKey, row.season);
    if (!seasons.has(key)) seasons.set(key, { showKey: row.showKey, season: row.season, episodes: new Set(), dated: false });
    const entry = seasons.get(key);
    entry.episodes.add(row.episode);
    if (row.source === SOURCE.DATE) entry.dated = true;
  }
  const gaps = [];
  for (const { showKey, season, episodes, dated } of seasons.values()) {
    // A year season holds a year's uploads, not a run of the series' numbers.
    // Seasons from MIN_YEAR_SEASON up only come from the upload year or a
    // hand assignment: a season read from a title stays within 0..199
    // (patternCompiler.MAX_SEASON; titleMatcher marks a larger one unsupported).
    if (dated || season >= MIN_YEAR_SEASON) continue;
    const highest = Math.max(...episodes);
    const missing = [];
    let truncated = false;
    for (let episode = 1; episode < highest; episode += 1) {
      if (episodes.has(episode)) continue;
      if (missing.length >= limit) {
        truncated = true;
        break;
      }
      missing.push(episode);
    }
    gaps.push({ showKey, season, have: episodes.size, highest, missing, truncated });
  }
  return gaps.sort((a, b) => (a.showKey === b.showKey ? a.season - b.season : a.showKey < b.showKey ? -1 : 1));
}

module.exports = {
  ROW_STATUS,
  SOURCE,
  planNumbers,
  computeGaps
};
