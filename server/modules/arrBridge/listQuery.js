// The page and search text of the Settings page's grab and search lists.
// Lenient on purpose: a value that cannot be read falls back to its default.
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;
const MAX_PAGE = 100000;
const MAX_QUERY_LENGTH = 100;
const MAX_WORDS = 5;

function readNumber(value, fallback, max) {
  const parsed = typeof value === 'string' || typeof value === 'number' ? Number.parseInt(value, 10) : NaN;
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

const likePattern = (word) => `%${word.replace(/[\\%_]/g, '\\$&')}%`;

/**
 * @param {Object} [query]
 * @param {unknown} [query.page] - 1-based
 * @param {unknown} [query.pageSize]
 * @param {unknown} [query.q] - Search text; a row must match every word
 * @returns {{page: number, pageSize: number, offset: number, patterns: string[]}}
 *   `patterns` holds one escaped LIKE pattern per word
 */
function readListQuery({ page, pageSize, q } = {}) {
  const pageNumber = readNumber(page, 1, MAX_PAGE);
  const size = readNumber(pageSize, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const words = typeof q === 'string' ? q.slice(0, MAX_QUERY_LENGTH).split(/\s+/).filter(Boolean) : [];
  return {
    page: pageNumber,
    pageSize: size,
    offset: (pageNumber - 1) * size,
    patterns: words.slice(0, MAX_WORDS).map(likePattern),
  };
}

module.exports = { readListQuery, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE };
