// Settings and fixed values of the Sonarr/Radarr bridge. Pure: every function
// takes the config object, so hand-edited values are corrected on each read.
const crypto = require('crypto');
const { ARR_STAGING_DIR_NAME } = require('../filesystem/constants');
const { validateSubFolderName } = require('../filesystem/subfolderValidation');

// Sonarr and Radarr require a SABnzbd version of at least 0.7.0 in x.y.z form.
const SAB_VERSION = '4.3.0';
const KINDS = ['tv', 'movie'];
const KEY_BYTES = 32;
const MAX_CATEGORIES = 10;
const CATEGORY_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$/;
const DEFAULT_CATEGORIES = Object.freeze([
  Object.freeze({ name: 'tv', subfolder: null }),
  Object.freeze({ name: 'movies', subfolder: null }),
]);
// Sonarr refuses to import a file under 10 minutes for an ordinary series
// (its sample check), and Radarr needs 10 minutes too.
const DEFAULT_MIN_TV_MINUTES = 10;
const DEFAULT_MIN_MOVIE_MINUTES = 60;
const MAX_MIN_DURATION_MINUTES = 600;
const DEFAULT_RETENTION_DAYS = 7;
const MAX_RETENTION_DAYS = 365;
// A video whose grab failed is not offered again for this long. Sonarr's own
// blocklist needs an identical publish date, which a YouTube search cannot give.
const FAILED_GRAB_GUARD_DAYS = 7;
const MAX_EXCLUDE_TERMS = 100;
const MAX_EXCLUDE_TERM_LENGTH = 60;
const DEFAULT_EXCLUDE_TERMS = Object.freeze([
  'trailer', 'teaser', 'clip', 'clips', 'reaction', 'review', 'recap', 'behind the scenes',
  'interview', 'promo', 'preview', 'sneak peek', 'explained', 'breakdown', 'bloopers',
  'featurette', 'making of', 'soundtrack', 'theme song', 'highlights', 'best of',
  'compilation', 'deleted scene', 'deleted scenes', 'summary', 'analysis', 'commentary',
  'podcast',
]);
// Radarr's indexer Test needs its default categories to be present.
const NEWZNAB_CATEGORIES = Object.freeze([
  {
    id: 2000,
    name: 'Movies',
    subcategories: [
      { id: 2010, name: 'Movies/Foreign' },
      { id: 2020, name: 'Movies/Other' },
      { id: 2030, name: 'Movies/SD' },
      { id: 2040, name: 'Movies/HD' },
      { id: 2045, name: 'Movies/UHD' },
      { id: 2050, name: 'Movies/BluRay' },
      { id: 2060, name: 'Movies/3D' },
    ],
  },
  {
    id: 5000,
    name: 'TV',
    subcategories: [
      { id: 5030, name: 'TV/SD' },
      { id: 5040, name: 'TV/HD' },
    ],
  },
]);

const sha256 = (value) => crypto.createHash('sha256').update(value).digest();

// A category name is a folder under the staging root, so its characters are
// limited to ones that cannot form a path.
function isValidCategoryName(name) {
  return typeof name === 'string' && CATEGORY_NAME_PATTERN.test(name);
}

function normalizeSubfolder(value) {
  if (typeof value !== 'string' || value.trim() === '') return null;
  return validateSubFolderName(value).valid ? value.trim() : null;
}

function normalizeCategories(value) {
  if (!Array.isArray(value)) return DEFAULT_CATEGORIES;
  const seen = new Set();
  const categories = [];
  for (const entry of value) {
    const name = entry && typeof entry === 'object' ? entry.name : null;
    if (!isValidCategoryName(name)) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    categories.push({ name, subfolder: normalizeSubfolder(entry.subfolder) });
    if (categories.length === MAX_CATEGORIES) break;
  }
  return categories.length > 0 ? categories : DEFAULT_CATEGORIES;
}

function normalizeMinutes(value, fallback) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return fallback;
  return Math.min(value, MAX_MIN_DURATION_MINUTES);
}

function normalizeExcludeTerms(value) {
  if (!Array.isArray(value)) return DEFAULT_EXCLUDE_TERMS;
  return value
    .filter((term) => typeof term === 'string')
    .map((term) => term.trim().toLowerCase())
    .filter((term) => term.length > 0 && term.length <= MAX_EXCLUDE_TERM_LENGTH)
    .slice(0, MAX_EXCLUDE_TERMS);
}

function normalizeStagingPath(value) {
  if (typeof value !== 'string' || !value.startsWith('/')) return null;
  if (value.split('/').includes('..')) return null;
  const trimmed = value.replace(/\/+$/, '');
  return trimmed || null;
}

function normalizeRetentionDays(value) {
  if (!Number.isInteger(value) || value < 1 || value > MAX_RETENTION_DAYS) return DEFAULT_RETENTION_DAYS;
  return value;
}

/**
 * @param {Object} config - The full config object
 * @returns {{enabled: boolean, apiKey: string|null, categories: Array<{name: string, subfolder: string|null}>,
 *   looseMatching: boolean, excludeTerms: string[], minTvSeconds: number, minMovieSeconds: number,
 *   stagingPath: string|null, retentionDays: number}}
 */
function readSettings(config) {
  const source = config && typeof config === 'object' ? config : {};
  const apiKey = typeof source.arrBridgeApiKey === 'string' && source.arrBridgeApiKey ? source.arrBridgeApiKey : null;
  return {
    enabled: source.arrBridgeEnabled === true,
    apiKey,
    categories: normalizeCategories(source.arrBridgeCategories),
    looseMatching: source.arrBridgeLooseMatching === true,
    excludeTerms: normalizeExcludeTerms(source.arrBridgeExcludeTerms),
    minTvSeconds: normalizeMinutes(source.arrBridgeMinTvMinutes, DEFAULT_MIN_TV_MINUTES) * 60,
    minMovieSeconds: normalizeMinutes(source.arrBridgeMinMovieMinutes, DEFAULT_MIN_MOVIE_MINUTES) * 60,
    stagingPath: normalizeStagingPath(source.arrBridgeStagingPath),
    retentionDays: normalizeRetentionDays(source.arrBridgeStagingRetentionDays),
  };
}

function isEnabled(config) {
  return Boolean(config) && config.arrBridgeEnabled === true;
}

/**
 * A wrong key and a disabled bridge look the same to the caller.
 * @param {Object} config
 * @param {unknown} candidate - The apikey query parameter
 * @returns {boolean}
 */
function isAuthorized(config, candidate) {
  const { enabled, apiKey } = readSettings(config);
  if (!enabled || !apiKey || typeof candidate !== 'string') return false;
  return crypto.timingSafeEqual(sha256(candidate), sha256(apiKey));
}

function generateKey() {
  return crypto.randomBytes(KEY_BYTES).toString('hex');
}

/**
 * The request's categories decide whether it is about a movie or a TV show.
 * @param {number[]} categories - Newznab category ids
 * @param {string} t - The Newznab function
 * @returns {'tv'|'movie'|null}
 */
function kindForCategories(categories, t) {
  if (categories.some((id) => id >= 2000 && id < 3000)) return 'movie';
  if (categories.some((id) => id >= 5000 && id < 6000)) return 'tv';
  if (t === 'movie') return 'movie';
  if (t === 'tvsearch') return 'tv';
  return null;
}

module.exports = {
  ARR_STAGING_DIR_NAME,
  SAB_VERSION,
  KINDS,
  DEFAULT_CATEGORIES,
  DEFAULT_EXCLUDE_TERMS,
  DEFAULT_MIN_TV_MINUTES,
  DEFAULT_MIN_MOVIE_MINUTES,
  DEFAULT_RETENTION_DAYS,
  FAILED_GRAB_GUARD_DAYS,
  MAX_CATEGORIES,
  NEWZNAB_CATEGORIES,
  isValidCategoryName,
  readSettings,
  isEnabled,
  isAuthorized,
  generateKey,
  kindForCategories,
};
