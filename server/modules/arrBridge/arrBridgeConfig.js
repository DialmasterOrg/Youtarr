// Settings and fixed values of the Sonarr/Radarr bridge. Pure: every function
// takes the config object, so hand-edited values are corrected on each read.
const crypto = require('crypto');
const { isDeepStrictEqual } = require('util');
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
const MAX_STAGING_PATH_LENGTH = 500;
// The resolutions Sonarr and Radarr have a quality for. An empty setting
// follows preferredResolution.
const RESOLUTIONS = Object.freeze(['2160', '1080', '720', '480']);
const FOLLOW_PREFERRED_RESOLUTION = '';
// The highest resolution a release is labeled with. It only lowers the label;
// the download resolution stays as it is.
const LABEL_LIMITS = Object.freeze(['1080', '720', '480']);
const NO_LABEL_LIMIT = '';
// A video whose grab failed is not offered again for this long. Sonarr's own
// blocklist needs an identical publish date, which a YouTube search cannot give.
const FAILED_GRAB_GUARD_DAYS = 7;
// The optional read-only connections to the user's own Sonarr and Radarr.
const MAX_ARR_URL_LENGTH = 500;
// Printable ASCII without spaces: the key travels in a request header.
const ARR_API_KEY_PATTERN = /^[\x21-\x7E]{1,128}$/;
const MAX_EXCLUDE_TERMS = 100;
const MAX_EXCLUDE_TERM_LENGTH = 60;
const DEFAULT_EXCLUDE_TERMS = Object.freeze([
  'trailer', 'teaser', 'clip', 'clips', 'reaction', 'review', 'recap', 'behind the scenes',
  'interview', 'promo', 'preview', 'sneak peek', 'explained', 'breakdown', 'bloopers',
  'featurette', 'making of', 'soundtrack', 'theme song', 'highlights', 'best of',
  'compilation', 'deleted scene', 'deleted scenes', 'summary', 'analysis', 'commentary',
  'podcast', 'parody', 'abridged',
]);
// The config keys of each connection. A URL and its key are server-owned
// and only ever change together, through the settings routes.
const CONNECTION_KEYS = Object.freeze({
  sonarr: Object.freeze({ url: 'arrBridgeSonarrUrl', apiKey: 'arrBridgeSonarrApiKey' }),
  radarr: Object.freeze({ url: 'arrBridgeRadarrUrl', apiKey: 'arrBridgeRadarrApiKey' }),
});
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
  const terms = value
    .filter((term) => typeof term === 'string')
    .map((term) => term.trim().toLowerCase())
    .filter((term) => term.length > 0 && term.length <= MAX_EXCLUDE_TERM_LENGTH);
  return [...new Set(terms)].slice(0, MAX_EXCLUDE_TERMS);
}

function normalizeStagingPath(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith('/') || trimmed.length > MAX_STAGING_PATH_LENGTH) return null;
  if (trimmed.split('/').includes('..')) return null;
  // Slashes and the spaces between them together, so the result is final.
  return trimmed.replace(/[\s/]+$/, '') || null;
}

function normalizeRetentionDays(value) {
  if (!Number.isInteger(value) || value < 1 || value > MAX_RETENTION_DAYS) return DEFAULT_RETENTION_DAYS;
  return value;
}

// The base URL of a Sonarr or Radarr, with its URL Base path if it has one.
// Credentials in the URL would end up in logs, and a query or fragment is a
// paste mistake, so each makes the connection read as not configured.
function normalizeArrUrl(value) {
  if (typeof value !== 'string' || value.length > MAX_ARR_URL_LENGTH) return null;
  let parsed;
  try {
    parsed = new URL(value.trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  if (parsed.username || parsed.password || parsed.search || parsed.hash) return null;
  return `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, '');
}

function normalizeConnection(url, apiKey) {
  const normalizedUrl = normalizeArrUrl(url);
  const key = typeof apiKey === 'string' ? apiKey.trim() : '';
  if (!normalizedUrl || !ARR_API_KEY_PATTERN.test(key)) return null;
  return { url: normalizedUrl, apiKey: key };
}

/**
 * The same rules as a stored connection, with a message for the Settings page.
 * @param {unknown} url
 * @param {unknown} apiKey
 * @returns {{connection: {url: string, apiKey: string}}|{error: string}}
 */
function parseConnectionInput(url, apiKey) {
  const normalizedUrl = normalizeArrUrl(url);
  if (!normalizedUrl) {
    return { error: 'Enter the address as http:// or https://, without a username, password or query' };
  }
  const key = typeof apiKey === 'string' ? apiKey.trim() : '';
  if (!key) return { error: 'Enter the API key' };
  if (!ARR_API_KEY_PATTERN.test(key)) {
    return { error: 'The API key may only contain letters, digits and symbols, without spaces' };
  }
  return { connection: { url: normalizedUrl, apiKey: key } };
}

// Why a category's subfolder cannot be saved, or null.
function subfolderProblem(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return 'It must be a subfolder name';
  const result = validateSubFolderName(value);
  return result.valid ? null : result.error;
}

function getCategoriesError(value) {
  const general = 'Sonarr/Radarr categories: use 1 to 10 categories with different names made of letters, digits, - and _';
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_CATEGORIES) return general;
  if (!value.every((entry) => Boolean(entry) && typeof entry === 'object' && isValidCategoryName(entry.name))) {
    return general;
  }
  if (new Set(value.map((entry) => entry.name.toLowerCase())).size !== value.length) return general;
  // Settings lists subfolders that already exist, and an old one can have a
  // name the validator refuses, so the message says which choice to change.
  const refused = value.find((entry) => subfolderProblem(entry.subfolder) !== null);
  if (!refused) return null;
  return `Sonarr/Radarr categories: the subfolder chosen for "${refused.name}" cannot be used. ${subfolderProblem(refused.subfolder)}`;
}

// The length is checked on the form the word is saved in: lower-casing can
// lengthen it, and normalizeExcludeTerms would then drop it without a word.
function isTermList(value) {
  if (!Array.isArray(value) || value.length > MAX_EXCLUDE_TERMS) return false;
  return value.every((term) => {
    const saved = typeof term === 'string' ? term.trim().toLowerCase() : '';
    return saved.length > 0 && saved.length <= MAX_EXCLUDE_TERM_LENGTH;
  });
}

const isMinutes = (value) => (
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= MAX_MIN_DURATION_MINUTES
);
const isStagingPath = (value) => (
  typeof value === 'string' && (value.trim() === '' || normalizeStagingPath(value) !== null)
);
const isRetentionDays = (value) => Number.isInteger(value) && value >= 1 && value <= MAX_RETENTION_DAYS;
const isResolution = (value) => value === FOLLOW_PREFERRED_RESOLUTION || RESOLUTIONS.includes(value);
const isLabelLimit = (value) => value === NO_LABEL_LIMIT || LABEL_LIMITS.includes(value);
const isSwitch = (value) => typeof value === 'boolean';
const unchanged = (value) => value;
const copyCategories = (value) => normalizeCategories(value).map((category) => ({ ...category }));
const MINUTES_ERROR = 'Sonarr/Radarr minimum length must be a number of minutes from 0 to 600';

// The settings the Settings page saves through /updateconfig; the bridge key
// and the connections are not among them. Per setting: whether a value may be saved, the form it is
// saved in, and what replaces a hand-edited value that may not be saved.
const SETTING_FIELDS = [
  {
    key: 'arrBridgeEnabled',
    isValid: isSwitch,
    error: 'Sonarr/Radarr bridge must be switched on or off',
    clean: unchanged,
    correct: () => false,
  },
  {
    key: 'arrBridgeCategories',
    isValid: (value) => getCategoriesError(value) === null,
    getError: getCategoriesError,
    clean: copyCategories,
    correct: copyCategories,
  },
  {
    key: 'arrBridgeLooseMatching',
    isValid: isSwitch,
    error: 'Sonarr/Radarr loose matching must be switched on or off',
    clean: unchanged,
    correct: () => false,
  },
  {
    key: 'arrBridgeExcludeTerms',
    isValid: isTermList,
    error: 'Sonarr/Radarr excluded words: at most 100 entries of up to 60 characters each',
    clean: (value) => [...normalizeExcludeTerms(value)],
    correct: (value) => [...normalizeExcludeTerms(value)],
  },
  {
    key: 'arrBridgeMinTvMinutes',
    isValid: isMinutes,
    error: MINUTES_ERROR,
    clean: unchanged,
    correct: (value) => normalizeMinutes(value, DEFAULT_MIN_TV_MINUTES),
  },
  {
    key: 'arrBridgeMinMovieMinutes',
    isValid: isMinutes,
    error: MINUTES_ERROR,
    clean: unchanged,
    correct: (value) => normalizeMinutes(value, DEFAULT_MIN_MOVIE_MINUTES),
  },
  {
    key: 'arrBridgeStagingPath',
    isValid: isStagingPath,
    error: 'Sonarr/Radarr staging path must be empty or an absolute path without ".."',
    clean: (value) => normalizeStagingPath(value) ?? '',
    correct: (value) => normalizeStagingPath(value) ?? '',
  },
  {
    key: 'arrBridgeStagingRetentionDays',
    isValid: isRetentionDays,
    error: 'Sonarr/Radarr staged file retention must be a whole number of days from 1 to 365',
    clean: unchanged,
    correct: normalizeRetentionDays,
  },
  {
    key: 'arrBridgeResolution',
    isValid: isResolution,
    error: 'Sonarr/Radarr resolution must be 2160, 1080, 720, 480, or empty to use the preferred resolution',
    clean: unchanged,
    correct: () => FOLLOW_PREFERRED_RESOLUTION,
  },
  {
    key: 'arrBridgeLabelLimit',
    isValid: isLabelLimit,
    error: 'Sonarr/Radarr label limit must be 1080, 720, 480, or empty for no limit',
    clean: unchanged,
    correct: () => NO_LABEL_LIMIT,
  },
  {
    key: 'arrBridgeRemoveAfterImport',
    isValid: isSwitch,
    error: 'Sonarr/Radarr remove after import must be switched on or off',
    clean: unchanged,
    correct: () => false,
  },
];
const SETTING_KEYS = Object.freeze(SETTING_FIELDS.map((field) => field.key));

const presentFields = (source) => SETTING_FIELDS.filter((field) => source[field.key] !== undefined);

/**
 * /updateconfig rejects a value this refuses. configModule corrects stored
 * values on load, so a hand-edited one can never block a Settings save.
 * @param {Object} updates - Any part of a config; only the bridge settings in it are checked
 * @returns {string|null} The first problem, as a message for the user
 */
function getSettingsError(updates) {
  const failed = presentFields(updates).find((field) => !field.isValid(updates[field.key]));
  if (!failed) return null;
  return failed.getError ? failed.getError(updates[failed.key]) : failed.error;
}

/**
 * @param {Object} updates - Bridge settings that passed getSettingsError
 * @returns {Object} The same settings in the form they are saved in
 */
function cleanSettings(updates) {
  return Object.fromEntries(presentFields(updates).map((field) => [field.key, field.clean(updates[field.key])]));
}

/**
 * @param {Object} config - The stored config
 * @returns {Array<{key: string, previous: unknown, replacement: unknown}>} Stored values to replace
 */
function correctStoredSettings(config) {
  const corrections = [];
  for (const field of presentFields(config)) {
    const previous = config[field.key];
    const replacement = field.isValid(previous) ? field.clean(previous) : field.correct(previous);
    if (!isDeepStrictEqual(replacement, previous)) corrections.push({ key: field.key, previous, replacement });
  }
  return corrections;
}

/**
 * @param {Object} config - The full config object
 * @returns {{enabled: boolean, apiKey: string|null, categories: Array<{name: string, subfolder: string|null}>,
 *   looseMatching: boolean, excludeTerms: string[], minTvSeconds: number, minMovieSeconds: number,
 *   stagingPath: string|null, retentionDays: number, resolution: string|null, labelLimit: 480|720|1080|null,
 *   removeAfterImport: boolean, sonarr: {url: string, apiKey: string}|null, radarr: {url: string, apiKey: string}|null}}
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
    resolution: RESOLUTIONS.includes(source.arrBridgeResolution) ? source.arrBridgeResolution : null,
    labelLimit: LABEL_LIMITS.includes(source.arrBridgeLabelLimit) ? Number(source.arrBridgeLabelLimit) : null,
    removeAfterImport: source.arrBridgeRemoveAfterImport === true,
    sonarr: normalizeConnection(source.arrBridgeSonarrUrl, source.arrBridgeSonarrApiKey),
    radarr: normalizeConnection(source.arrBridgeRadarrUrl, source.arrBridgeRadarrApiKey),
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
  SETTING_KEYS,
  CONNECTION_KEYS,
  isValidCategoryName,
  normalizeArrUrl,
  parseConnectionInput,
  getSettingsError,
  cleanSettings,
  correctStoredSettings,
  readSettings,
  isEnabled,
  isAuthorized,
  generateKey,
  kindForCategories,
};
