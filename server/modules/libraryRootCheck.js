// Is the downloads folder really there? An unmounted drive or network share
// leaves its mount point missing or empty, and every stored path under it
// would then look gone. Nothing may be marked missing while this check fails.
const fs = require('fs');
const path = require('path');
// pathBuilder, not the filesystem index: the index loads fileOperations, which
// binds child_process at require time, and this check needs neither.
const { isSubfolderDirectory } = require('./filesystem/pathBuilder');
const { LOCAL_TEMP_DIR_NAME, M3U_FOLDER_NAME, HEALTHCHECK_FILE_PREFIX } = require('./filesystem/constants');

const LIBRARY_CHECK_REASONS = {
  MISSING: 'missing',
  EMPTY: 'empty',
  UNREADABLE: 'unreadable',
  SUBFOLDER_EMPTY: 'subfolder-empty',
  SUBFOLDER_UNREADABLE: 'subfolder-unreadable',
};
const SUBFOLDER_REASONS = [LIBRARY_CHECK_REASONS.SUBFOLDER_EMPTY, LIBRARY_CHECK_REASONS.SUBFOLDER_UNREADABLE];

// ENOTDIR: the folder's path now leads to a regular file, so the folder is gone.
const ABSENT_CODES = ['ENOENT', 'ENOTDIR'];

function describeLibraryCheck({ reason, path: checkedPath }) {
  switch (reason) {
  case LIBRARY_CHECK_REASONS.MISSING:
    return `The downloads folder ${checkedPath} does not exist.`;
  case LIBRARY_CHECK_REASONS.EMPTY:
    return `The downloads folder ${checkedPath} is empty.`;
  case LIBRARY_CHECK_REASONS.UNREADABLE:
    return `The downloads folder ${checkedPath} could not be read.`;
  case LIBRARY_CHECK_REASONS.SUBFOLDER_EMPTY:
    return `The subfolder ${checkedPath} is empty.`;
  case LIBRARY_CHECK_REASONS.SUBFOLDER_UNREADABLE:
    return `The subfolder ${checkedPath} could not be read.`;
  default:
    return `The downloads folder ${checkedPath} could not be checked.`;
  }
}

function failure(reason, checkedPath) {
  return { ok: false, reason, path: checkedPath, message: describeLibraryCheck({ reason, path: checkedPath }) };
}

// Entries Youtarr creates itself, possibly on a bare mount point while the
// share is down, so they say nothing about whether the library is there.
function isYoutarrManagedEntry(name) {
  return name === LOCAL_TEMP_DIR_NAME || name === M3U_FOLDER_NAME || name.startsWith(HEALTHCHECK_FILE_PREFIX);
}

/**
 * The root must exist and hold something; every `__subfolder` in it (a share
 * of its own, on some setups) must hold something too. First failure wins.
 * Entries Youtarr creates itself do not count (see isYoutarrManagedEntry).
 * @param {string} baseDir - The downloads root
 * @param {{ readdir?: Function }} [deps] - fs.promises.readdir, injectable for tests
 * @returns {Promise<{ok: true}|{ok: false, reason: string, path: string, message: string}>}
 */
async function checkLibraryRoot(baseDir, { readdir = fs.promises.readdir } = {}) {
  if (!baseDir) return failure(LIBRARY_CHECK_REASONS.MISSING, baseDir || '');

  let entries;
  try {
    entries = (await readdir(baseDir, { withFileTypes: true })).filter((entry) => !isYoutarrManagedEntry(entry.name));
  } catch (err) {
    const reason = ABSENT_CODES.includes(err.code) ? LIBRARY_CHECK_REASONS.MISSING : LIBRARY_CHECK_REASONS.UNREADABLE;
    return failure(reason, baseDir);
  }
  if (entries.length === 0) return failure(LIBRARY_CHECK_REASONS.EMPTY, baseDir);

  for (const entry of entries) {
    if (!entry.isDirectory() || !isSubfolderDirectory(entry.name)) continue;
    const subfolder = path.join(baseDir, entry.name);
    let children;
    try {
      children = await readdir(subfolder, { withFileTypes: true });
    } catch (err) {
      // Gone since the root was listed: not a mount problem.
      if (ABSENT_CODES.includes(err.code)) continue;
      return failure(LIBRARY_CHECK_REASONS.SUBFOLDER_UNREADABLE, subfolder);
    }
    if (children.length === 0) return failure(LIBRARY_CHECK_REASONS.SUBFOLDER_EMPTY, subfolder);
  }

  return { ok: true };
}

/**
 * Whether a failing check puts the given file in doubt: a root failure covers
 * every file, a subfolder failure only the files under that subfolder.
 * @param {{ok: boolean, reason?: string, path?: string}} check - a checkLibraryRoot result
 * @param {string|null|undefined} filePath
 * @returns {boolean}
 */
function isUnderLibraryCheckPath(check, filePath) {
  if (!check || check.ok || !filePath) return false;
  if (!SUBFOLDER_REASONS.includes(check.reason)) return true;
  const prefix = check.path.endsWith(path.sep) ? check.path : `${check.path}${path.sep}`;
  return filePath.startsWith(prefix);
}

module.exports = {
  LIBRARY_CHECK_REASONS, checkLibraryRoot, describeLibraryCheck, isYoutarrManagedEntry, isUnderLibraryCheckPath,
};
