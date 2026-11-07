// Why a videos row has no file, layered on the `removed` flag.
//
// `removed` stays the single "no file" flag every query reads. The reason
// columns say who removed it: a removed row whose reason is 'not_found' is
// MISSING (Youtarr expected a file and could not find it); a removed row with
// any other reason, including none (rows removed before the reason was
// recorded), is DELETED (Youtarr removed the file, or the user said it is gone).
const { Op } = require('sequelize');

const REMOVAL_REASONS = {
  USER_DELETED: 'user_deleted',
  AUTO_REMOVAL: 'auto_removal',
  NOT_FOUND: 'not_found',
  MARKED_DELETED: 'marked_deleted',
};

const REMOVAL_STATES = {
  PRESENT: 'present',
  DELETED: 'deleted',
  MISSING: 'missing',
};

const REMOVAL_COLUMNS = ['removed', 'removed_reason', 'removed_at', 'removed_detail'];

const KNOWN_REASONS = new Set(Object.values(REMOVAL_REASONS));

/**
 * @param {Object} row - A videos row (raw or model instance); `removed` may be 0/1 or boolean
 * @returns {string} One of REMOVAL_STATES
 */
function removalState(row) {
  if (!row.removed) return REMOVAL_STATES.PRESENT;
  return row.removed_reason === REMOVAL_REASONS.NOT_FOUND ? REMOVAL_STATES.MISSING : REMOVAL_STATES.DELETED;
}

/**
 * Columns to write when a row loses its file.
 * @param {string} reason - One of REMOVAL_REASONS
 * @param {{ detail?: string|null, at?: Date }} [options] - detail: the rule, for automatic cleanup
 */
function removedColumns(reason, { detail = null, at = new Date() } = {}) {
  if (!KNOWN_REASONS.has(reason)) {
    throw new Error(`Unknown removal reason: ${reason}`);
  }
  return { removed: true, removed_reason: reason, removed_at: at, removed_detail: detail };
}

/** Columns to write when a row's file is on disk (again). */
function presentColumns() {
  return { removed: false, removed_reason: null, removed_at: null, removed_detail: null };
}

function assertFilterableState(state) {
  if (state !== REMOVAL_STATES.DELETED && state !== REMOVAL_STATES.MISSING) {
    throw new Error(`Unknown removal state: ${state}`);
  }
}

/** Sequelize `where` matching rows in the given state ('deleted' | 'missing'). */
function stateWhere(state) {
  assertFilterableState(state);
  if (state === REMOVAL_STATES.MISSING) {
    return { removed: true, removed_reason: REMOVAL_REASONS.NOT_FOUND };
  }
  return {
    removed: true,
    [Op.or]: [{ removed_reason: null }, { removed_reason: { [Op.ne]: REMOVAL_REASONS.NOT_FOUND } }],
  };
}

/** Sequelize `where` matching every row NOT in the given state, for 'exclude' filters. */
function notStateWhere(state) {
  assertFilterableState(state);
  if (state === REMOVAL_STATES.MISSING) {
    return {
      [Op.or]: [
        { removed: false },
        { removed_reason: null },
        { removed_reason: { [Op.ne]: REMOVAL_REASONS.NOT_FOUND } },
      ],
    };
  }
  return { [Op.or]: [{ removed: false }, { removed_reason: REMOVAL_REASONS.NOT_FOUND }] };
}

module.exports = {
  REMOVAL_REASONS,
  REMOVAL_STATES,
  REMOVAL_COLUMNS,
  removalState,
  removedColumns,
  presentColumns,
  stateWhere,
  notStateWhere,
};
