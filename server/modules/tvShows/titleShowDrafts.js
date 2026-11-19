/**
 * The title shows a save sends: validated, normalized and compiled, before
 * anything is written or classified. A channel's drafts are always its whole
 * set of active title shows, in order (the first matching show wins).
 *
 * Draft (from the API):
 *   { id?, name, folderName?, libraryFolder?, excludeTerms?, seasonNames?,
 *     patterns: [{ text, kind, seasonSource, seasonFixed?, episodeSource }] }
 * Normalized: the same with key ('title:<id>' or 'new:<index>'), position,
 * folder defaults applied, and each pattern compiled (key '<show key>#<index>').
 */

const titleFilterRegex = require('../titleFilterRegex');
const { LAYOUT_TV, folderKey } = require('./constants');
const { showFolderNameProblem, sanitizeShowFolderName, folderNameKey } = require('./showFolderNames');
const {
  compilePattern,
  validateSources,
  excludeTermRegex,
  buildShowFilter,
  isAssignableSeason,
  MAX_SEASON,
  MIN_YEAR_SEASON,
  MAX_YEAR_SEASON,
  PatternError,
} = require('./patternCompiler');

const MAX_SHOWS_PER_CHANNEL = 50;
const MAX_PATTERNS_PER_SHOW = 20;
const MAX_EXCLUDE_TERMS = 20;
const MAX_EXCLUDE_TERM_LENGTH = 100;
const MAX_NAME_LENGTH = 255;

function invalid(message) {
  return new PatternError(message);
}

function folderLabel(folder) {
  return folder ? `__${folder}` : 'The main folder';
}

function showKeyOf(raw, index) {
  if (raw.id === undefined || raw.id === null) return `new:${index}`;
  if (!Number.isInteger(raw.id) || raw.id <= 0) throw invalid('A show id must be a positive whole number.');
  return `title:${raw.id}`;
}

function normalizeName(raw) {
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  if (!name) throw invalid('Every show needs a name.');
  if (name.length > MAX_NAME_LENGTH) throw invalid(`Show names are limited to ${MAX_NAME_LENGTH} characters.`);
  return name;
}

function normalizeFolderName(raw, name) {
  const wanted = typeof raw.folderName === 'string' && raw.folderName.trim() ? raw.folderName.trim() : name;
  const folderName = sanitizeShowFolderName(wanted);
  const problem = showFolderNameProblem(folderName);
  if (problem) throw invalid(`${name}: ${problem}.`);
  return folderName;
}

function normalizeLibraryFolder(raw, { layoutOf, defaultLibraryFolder, tvFolders = [] }) {
  if (raw.libraryFolder === undefined || raw.libraryFolder === null) {
    if (defaultLibraryFolder === null || defaultLibraryFolder === undefined) {
      throw invalid('Choose a TV folder for this show.');
    }
    return defaultLibraryFolder;
  }
  if (typeof raw.libraryFolder !== 'string') throw invalid('libraryFolder must be a folder name ("" for the main folder).');
  const folder = raw.libraryFolder.trim();
  if (layoutOf(folder) !== LAYOUT_TV) throw invalid(`${folderLabel(folder)} is not a TV folder.`);
  // Folder names compare without case; the path uses the registered name.
  return tvFolders.find((name) => folderKey(name) === folderKey(folder)) ?? folder;
}

function normalizeExcludeTerms(raw) {
  if (raw.excludeTerms === undefined || raw.excludeTerms === null) return [];
  if (!Array.isArray(raw.excludeTerms)) throw invalid('excludeTerms must be a list.');
  const seen = new Set();
  const terms = [];
  for (const entry of raw.excludeTerms) {
    if (typeof entry !== 'string') throw invalid('Exclude terms must be text.');
    const term = entry.trim();
    if (!term || seen.has(term.toLowerCase())) continue;
    if (term.length > MAX_EXCLUDE_TERM_LENGTH) throw invalid(`Exclude terms are limited to ${MAX_EXCLUDE_TERM_LENGTH} characters.`);
    seen.add(term.toLowerCase());
    terms.push(term);
  }
  if (terms.length > MAX_EXCLUDE_TERMS) throw invalid(`A show can have at most ${MAX_EXCLUDE_TERMS} exclude terms.`);
  return terms;
}

function normalizeSeasonNames(raw) {
  if (raw.seasonNames === undefined || raw.seasonNames === null) return {};
  if (typeof raw.seasonNames !== 'object' || Array.isArray(raw.seasonNames)) throw invalid('seasonNames must map season numbers to names.');
  const names = {};
  for (const [key, value] of Object.entries(raw.seasonNames)) {
    const season = Number(key);
    if (!isAssignableSeason(season)) {
      throw invalid(`Season numbers must be 0 to ${MAX_SEASON}, or an upload year from ${MIN_YEAR_SEASON} to ${MAX_YEAR_SEASON}.`);
    }
    if (value !== null && typeof value !== 'string') throw invalid('Season names must be text.');
    const name = (value || '').trim();
    if (!name) continue;
    if (name.length > MAX_NAME_LENGTH) throw invalid(`Season names are limited to ${MAX_NAME_LENGTH} characters.`);
    names[season] = name;
  }
  return names;
}

function normalizePattern(raw, showName, showKey, index) {
  if (!raw || typeof raw !== 'object') throw invalid(`${showName}, pattern ${index + 1}: invalid pattern.`);
  const seasonFixed = raw.seasonFixed === undefined || raw.seasonFixed === null ? null : Number(raw.seasonFixed);
  try {
    const compiled = compilePattern({ text: raw.text, kind: raw.kind });
    const problem = validateSources({
      groups: compiled.groups, seasonSource: raw.seasonSource, seasonFixed, episodeSource: raw.episodeSource,
    });
    if (problem) throw invalid(problem);
    return {
      key: `${showKey}#${index}`,
      position: index,
      text: raw.text.trim(),
      kind: raw.kind,
      compiledRegex: compiled.compiledRegex,
      filterRegex: compiled.filterRegex,
      groups: compiled.groups,
      seasonSource: raw.seasonSource,
      seasonFixed: raw.seasonSource === 'fixed' ? seasonFixed : null,
      episodeSource: raw.episodeSource,
    };
  } catch (err) {
    if (err instanceof PatternError) throw invalid(`${showName}, pattern ${index + 1}: ${err.message}`);
    throw err;
  }
}

/**
 * @param {Array<Object>} rawDrafts - The channel's title shows after the change, in order
 * @param {Object} context
 * @param {(libraryFolder: string) => string} context.layoutOf
 * @param {string|null} context.defaultLibraryFolder - For drafts without one; null when the user must choose
 * @param {string[]} [context.tvFolders] - The registered TV folders, for their names' case
 * @returns {Array<Object>} Normalized drafts
 * @throws {PatternError} (status 400)
 */
function normalizeDrafts(rawDrafts, context) {
  if (!Array.isArray(rawDrafts)) throw invalid('shows must be a list.');
  if (rawDrafts.length > MAX_SHOWS_PER_CHANNEL) throw invalid(`A channel can have at most ${MAX_SHOWS_PER_CHANNEL} shows.`);
  const locations = new Set();
  const keys = new Set();
  return rawDrafts.map((raw, index) => {
    if (!raw || typeof raw !== 'object') throw invalid('Each show must be an object.');
    const key = showKeyOf(raw, index);
    if (keys.has(key)) throw invalid('A show appears more than once.');
    keys.add(key);
    const name = normalizeName(raw);
    const folderName = normalizeFolderName(raw, name);
    const libraryFolder = normalizeLibraryFolder(raw, context);
    const location = folderNameKey(libraryFolder, folderName);
    if (locations.has(location)) throw invalid(`Two shows can't use the same folder: "${folderName}".`);
    locations.add(location);

    if (!Array.isArray(raw.patterns) || raw.patterns.length === 0) throw invalid(`${name} needs at least one pattern.`);
    if (raw.patterns.length > MAX_PATTERNS_PER_SHOW) throw invalid(`A show can have at most ${MAX_PATTERNS_PER_SHOW} patterns.`);
    return {
      id: key.startsWith('title:') ? raw.id : null,
      key,
      position: index,
      name,
      folderName,
      libraryFolder,
      excludeTerms: normalizeExcludeTerms(raw),
      seasonNames: normalizeSeasonNames(raw),
      patterns: raw.patterns.map((pattern, patternIndex) => normalizePattern(pattern, name, key, patternIndex)),
    };
  });
}

/**
 * The library folder a new title show gets when none is chosen: the
 * channel's folder when it is a TV folder, else the default subfolder when it
 * is one, else the only TV folder; null when the user must choose.
 */
function defaultLibraryFolder({ channelFolder, defaultFolder, tvFolders, layoutOf }) {
  if (layoutOf(channelFolder || '') === LAYOUT_TV) return channelFolder || '';
  if (layoutOf(defaultFolder || '') === LAYOUT_TV) return defaultFolder || '';
  return tvFolders.length === 1 ? tvFolders[0] : null;
}

/**
 * Compile every pattern, filter form and exclude term of the drafts in Python
 * (yt-dlp doesn't catch a bad regex in a match filter: it would end the run).
 * @throws {PatternError}
 */
async function assertDraftsCompile(drafts) {
  const checks = [];
  for (const show of drafts) {
    show.patterns.forEach((pattern, index) => {
      const label = `${show.name}, pattern ${index + 1}`;
      checks.push({ label, regex: pattern.compiledRegex }, { label, regex: pattern.filterRegex });
    });
    if (show.patterns.length > 1) {
      checks.push({ label: `${show.name}, download filter`, regex: buildShowFilter(show.patterns.map((p) => p.filterRegex)) });
    }
    for (const term of show.excludeTerms) checks.push({ label: `${show.name}, exclude term "${term}"`, regex: excludeTermRegex(term) });
  }
  const errors = await titleFilterRegex.checkPatterns(checks.map((check) => check.regex));
  const failed = errors.findIndex((error) => error);
  if (failed >= 0) throw invalid(`${checks[failed].label}: ${errors[failed]}`);
}

module.exports = {
  MAX_SHOWS_PER_CHANNEL,
  MAX_PATTERNS_PER_SHOW,
  normalizeDrafts,
  defaultLibraryFolder,
  assertDraftsCompile
};
