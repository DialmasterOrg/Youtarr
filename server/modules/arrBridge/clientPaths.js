// The staging folder's path as Sonarr or Radarr know it: the forms it may
// take, how such a path is extended, the paths an app may know the folder
// under, and what a Remote Path Mapping in the app makes of a path. Pure.
// These paths are only reported to the apps and asked about there; Youtarr
// never opens one itself.
const { ARR_STAGING_DIR_NAME } = require('../filesystem/constants');

const MAX_STAGING_PATH_LENGTH = 500;
// A mapping's Local Path comes from the app; a longer one is not a path.
const MAX_MAPPED_PATH_LENGTH = 1000;
const POSIX_SEPARATOR = '/';
const WINDOWS_SEPARATOR = '\\';
const DRIVE_PATH = /^[A-Za-z]:[\\/]/;
const SHARE_PREFIX = '\\\\';
const ANY_SEPARATORS = /[\\/]+/;
const FIRST_PRINTABLE_CODE = 0x20;
const DELETE_CODE = 0x7f;
// The downloads folder of a Windows host, as Docker setups spell it: Git
// Bash ("/e/Videos"), WSL ("/mnt/e/Videos") and Docker Desktop's own mounts.
const WINDOWS_HOST_MOUNT = /^(?:\/mnt|\/host_mnt|\/run\/desktop\/mnt\/host)?\/([A-Za-z])(?:\/(.*))?$/;

const isWindowsForm = (path) => DRIVE_PATH.test(path) || path.startsWith(SHARE_PREFIX);

function hasControlCharacter(text) {
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code < FIRST_PRINTABLE_CODE || code === DELETE_CODE) return true;
  }
  return false;
}

/**
 * @param {string} path - A normalized client path
 * @returns {string} The separator that path is written with
 */
function separatorOf(path) {
  return isWindowsForm(String(path)) ? WINDOWS_SEPARATOR : POSIX_SEPARATOR;
}

function normalizePosixPath(trimmed) {
  if (trimmed.split('/').includes('..')) return null;
  // Slashes and the spaces between them together, so the result is final.
  return trimmed.replace(/[\s/]+$/, '') || null;
}

// "E:\Videos\.arr-staging" or "\\nas\videos\.arr-staging", with either slash.
function normalizeWindowsPath(trimmed) {
  const share = trimmed.startsWith(SHARE_PREFIX);
  const segments = trimmed
    .slice(share ? SHARE_PREFIX.length : 0)
    .replace(/[\s\\/]+$/, '')
    .split(ANY_SEPARATORS);
  // A drive needs a folder on it; a share needs its server and its name.
  if (segments.length < 2 || segments.some((segment) => segment === '' || segment === '..')) return null;
  return `${share ? SHARE_PREFIX : ''}${segments.join(WINDOWS_SEPARATOR)}`;
}

/**
 * The staging folder's path as Sonarr and Radarr see it, as stored and
 * reported: an absolute path on Linux or macOS, on a Windows drive, or on a
 * Windows network share.
 * @param {unknown} value
 * @returns {string|null} The path without a trailing separator, or null when it is not one
 */
function normalizeStagingPath(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length > MAX_STAGING_PATH_LENGTH || hasControlCharacter(trimmed)) return null;
  if (isWindowsForm(trimmed)) return normalizeWindowsPath(trimmed);
  return trimmed.startsWith('/') ? normalizePosixPath(trimmed) : null;
}

/**
 * @param {string} root - A normalized client path
 * @param {string[]} segments - Folder or file names below it
 * @returns {string}
 */
function joinClientPath(root, segments) {
  return [root, ...segments].join(separatorOf(root));
}

const withoutTrailingSeparators = (path) => (
  isWindowsForm(path) ? path.replace(/[\\/]+$/, '') : path.replace(/\/+$/, '')
);

/**
 * @param {string} path
 * @returns {string} The path ending in exactly one of its own separators,
 *   which is how the apps' folder listing wants a folder named
 */
function withTrailingSeparator(path) {
  const text = String(path);
  return `${withoutTrailingSeparators(text)}${separatorOf(text)}`;
}

function windowsFormOf(folder) {
  if (isWindowsForm(folder)) return folder;
  const mount = WINDOWS_HOST_MOUNT.exec(folder);
  if (!mount) return null;
  return `${mount[1].toUpperCase()}:${WINDOWS_SEPARATOR}${mount[2] ?? ''}`;
}

/**
 * Where an app that runs on the same machine as Youtarr's container may see
 * the staging folder: inside the downloads folder as the host knows it.
 * @param {unknown} downloadsFolder - The host's downloads folder, as configured
 * @param {{windows: boolean}} options - Whether the app runs on Windows
 * @returns {string[]} Normalized client paths; empty when none can be told
 */
function hostPathCandidates(downloadsFolder, { windows }) {
  if (typeof downloadsFolder !== 'string' || downloadsFolder.trim() === '') return [];
  const folder = downloadsFolder.trim();
  const hostFolder = windows ? windowsFormOf(folder) : folder;
  if (!hostFolder || (!windows && !folder.startsWith('/'))) return [];
  const candidate = normalizeStagingPath(
    `${withoutTrailingSeparators(hostFolder)}${separatorOf(hostFolder)}${ARR_STAGING_DIR_NAME}`
  );
  return candidate ? [candidate] : [];
}

const isMappedPath = (value) => (
  typeof value === 'string'
  && value.trim() !== ''
  && value.length <= MAX_MAPPED_PATH_LENGTH
  && !hasControlCharacter(value)
);

/**
 * What a Remote Path Mapping in Sonarr or Radarr turns a reported path into.
 * @param {string} reportedPath - A normalized client path
 * @param {{remotePath: unknown, localPath: unknown}} mapping
 * @returns {string|null} The path the app looks at, or null when the
 *   mapping's Remote Path is neither the reported path nor a folder above it
 */
function applyMapping(reportedPath, { remotePath, localPath } = {}) {
  if (!isMappedPath(remotePath) || !isMappedPath(localPath)) return null;
  const separator = separatorOf(reportedPath);
  // Windows paths compare without case, as the apps compare them.
  const fold = (path) => (isWindowsForm(reportedPath) ? path.toLowerCase() : path);
  const remote = withoutTrailingSeparators(remotePath.trim());
  const local = withoutTrailingSeparators(localPath.trim());
  if (fold(reportedPath) === fold(remote)) return local;
  const prefix = `${remote}${separator}`;
  if (!fold(reportedPath).startsWith(fold(prefix))) return null;
  return [local, ...reportedPath.slice(prefix.length).split(separator)].join(separatorOf(localPath.trim()));
}

module.exports = {
  MAX_STAGING_PATH_LENGTH,
  normalizeStagingPath,
  separatorOf,
  joinClientPath,
  withTrailingSeparator,
  hostPathCandidates,
  applyMapping,
};
