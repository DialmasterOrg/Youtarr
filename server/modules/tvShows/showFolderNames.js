/**
 * Show folder names: what a show folder may be called and how names compare.
 * Dependency-free (no config, no database), so pure modules can use it.
 */

const { sanitizeFilenameLikeYtDlp, sanitizeNameLikeYtDlp } = require('../filesystem/sanitizer');
const { SEASON_FOLDER_PATTERN, SUBFOLDER_PREFIX } = require('../filesystem/constants');

// Same cap as the channel folder in the yt-dlp output template (.80B).
const SHOW_FOLDER_MAX_BYTES = 80;

// Folder names Jellyfin reads as extras inside a show (compared ignoring case).
const EXTRAS_FOLDER_NAMES = new Set([
  'trailers', 'backdrops', 'theme-music', 'behind the scenes', 'deleted scenes', 'interviews',
  'scenes', 'samples', 'sample', 'shorts', 'featurettes', 'extras', 'extra', 'other', 'clips',
]);

/**
 * Why a name can't be a show folder, or null when it can.
 * @param {string} name
 * @returns {string|null}
 */
function showFolderNameProblem(name) {
  const value = typeof name === 'string' ? name.trim() : '';
  if (!value) return 'Show folder name is empty';
  if (value.startsWith(SUBFOLDER_PREFIX)) return `Show folder name can't start with ${SUBFOLDER_PREFIX}`;
  if (value.startsWith('.')) return 'Show folder name can\'t start with .';
  if (/[/\\]/.test(value)) return 'Show folder name can\'t contain a path separator';
  if (SEASON_FOLDER_PATTERN.test(value)) return 'Show folder name can\'t be a season folder name';
  if (EXTRAS_FOLDER_NAMES.has(value.toLowerCase())) return `"${value}" is a media-server extras folder name`;
  return null;
}

function sanitizeShowFolderName(name) {
  const sanitized = sanitizeFilenameLikeYtDlp(String(name || ''), { maxBytes: SHOW_FOLDER_MAX_BYTES });
  return sanitized ? sanitizeNameLikeYtDlp(sanitized) : '';
}

// Folder names compare like the unique key's utf8mb4_unicode_ci collation:
// ignoring case and accents.
function folderNameKey(libraryFolder, folderName) {
  const fold = (value) => String(value || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  return `${fold(libraryFolder)}/${fold(folderName)}`;
}

module.exports = {
  SHOW_FOLDER_MAX_BYTES,
  showFolderNameProblem,
  sanitizeShowFolderName,
  folderNameKey
};
