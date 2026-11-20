// The searches Sonarr and Radarr sent, kept in arr_bridge_searches for the
// Settings page. recentSearches builds each record; like it, this holds
// request fields, search results and release names only.
const { Op } = require('sequelize');
const { NOTE } = require('./recentSearches');
const { readListQuery } = require('./listQuery');

const RETENTION_DAYS = 30;
// A search with its results is around 10 KB, so this is about 20 MB.
const MAX_ROWS = 2000;
const PRUNE_INTERVAL_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const NEWEST_FIRST = [['at', 'DESC'], ['id', 'DESC']];
const NOTHING_ASKED = Object.freeze({
  text: null, textSource: null, season: null, episode: null, year: null, month: null, day: null, limit: null,
});

const pad2 = (value) => String(value).padStart(2, '0');

// What the list's search box matches: the name with its episode, season,
// air date or year, written as the row shows it, so text copied from a row
// finds that row. A movie's year is in brackets there.
function searchTextOf({ text, season, episode, year, month, day }) {
  const parts = [text];
  if (season !== null) {
    parts.push(episode !== null ? `S${pad2(season)}E${pad2(episode)}` : `S${pad2(season)} season ${season}`);
  }
  if (year !== null) parts.push(month !== null && day !== null ? `${year}-${pad2(month)}-${pad2(day)}` : `(${year})`);
  return parts.filter(Boolean).join(' ') || null;
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function searchView(row) {
  const asked = parseJson(row.asked);
  const stages = parseJson(row.stages);
  return {
    id: row.id,
    at: row.at,
    firstAt: row.first_at,
    count: row.count,
    kind: row.kind,
    shape: row.shape,
    asked: asked && typeof asked === 'object' ? asked : { ...NOTHING_ASKED },
    outcome: row.outcome,
    offered: row.offered,
    note: row.note,
    titleStageSkipped: row.title_stage_skipped,
    stages: Array.isArray(stages) ? stages : [],
  };
}

/**
 * @param {Object} deps
 * @param {Object} deps.models - { ArrBridgeSearch }
 * @param {Object} deps.logger
 * @param {Function} [deps.now]
 * @returns {{ record: Function, list: Function }}
 */
function createSearchHistory({ models, logger, now = () => new Date() }) {
  const { ArrBridgeSearch } = models;
  let writes = Promise.resolve();
  let prunedAt = null;

  // Sonarr and Radarr ask the no-query feed on every RSS sync, which would
  // bury every real search: those requests share one row per kind, counted.
  async function store(entry) {
    const folded = entry.note === NOTE.NO_QUERY
      ? await ArrBridgeSearch.findOne({ where: { note: NOTE.NO_QUERY, kind: entry.kind } })
      : null;
    if (folded) {
      await ArrBridgeSearch.update({ at: entry.at, count: folded.count + 1 }, { where: { id: folded.id } });
      return;
    }
    await ArrBridgeSearch.create({
      at: entry.at,
      first_at: entry.at,
      count: 1,
      kind: entry.kind,
      shape: entry.shape,
      outcome: entry.outcome,
      offered: entry.offered,
      note: entry.note,
      title_stage_skipped: entry.titleStageSkipped,
      search_text: searchTextOf(entry.asked),
      asked: JSON.stringify(entry.asked),
      stages: JSON.stringify(entry.stages),
    });
  }

  const keptSince = (current) => new Date(current.getTime() - RETENTION_DAYS * DAY_MS);

  async function prune() {
    const current = now();
    if (prunedAt !== null && current.getTime() - prunedAt < PRUNE_INTERVAL_MS) return;
    await ArrBridgeSearch.destroy({ where: { at: { [Op.lt]: keptSince(current) } } });
    const [lastKept] = await ArrBridgeSearch.findAll({
      attributes: ['at'], order: NEWEST_FIRST, offset: MAX_ROWS - 1, limit: 1, raw: true,
    });
    if (lastKept) await ArrBridgeSearch.destroy({ where: { at: { [Op.lt]: lastKept.at } } });
    prunedAt = current.getTime();
  }

  async function write(entry) {
    try {
      await store(entry);
    } catch (err) {
      logger.warn({ err }, 'Could not store a Sonarr/Radarr search');
      return;
    }
    try {
      await prune();
    } catch (err) {
      logger.warn({ err }, 'Could not prune the stored Sonarr/Radarr searches');
    }
  }

  /**
   * Stores one finished search. The answer to Sonarr or Radarr does not
   * wait for it, and a failed write is only logged. Writes run one at a
   * time, so two no-query requests cannot both create the shared row.
   * @param {Object} entry - From recentSearches
   * @returns {Promise<void>} Never rejects
   */
  function record(entry) {
    writes = writes.then(() => write(entry));
    return writes;
  }

  /**
   * Pruning only runs after a write, so the retention is applied here too:
   * with no searches coming in, an old row is still never listed.
   * @param {Object} [query] - { page, pageSize, q }, as listQuery reads them
   * @returns {Promise<{searches: Array<Object>, total: number, page: number, pageSize: number}>} Newest first
   */
  async function list(query) {
    const { page, pageSize, offset, patterns } = readListQuery(query);
    const { rows, count } = await ArrBridgeSearch.findAndCountAll({
      where: {
        at: { [Op.gte]: keptSince(now()) },
        ...(patterns.length > 0
          ? { [Op.and]: patterns.map((pattern) => ({ search_text: { [Op.like]: pattern } })) }
          : {}),
      },
      order: NEWEST_FIRST,
      limit: pageSize,
      offset,
      raw: true,
    });
    return { searches: rows.map(searchView), total: count, page, pageSize };
  }

  return { record, list };
}

module.exports = { createSearchHistory, RETENTION_DAYS, MAX_ROWS };
