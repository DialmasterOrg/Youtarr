// Is the downloads folder really there? An unmounted drive or network share
// leaves its mount point missing or empty, and every stored path under it
// would then look gone. Nothing may be marked missing while this check fails.
const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
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

// Shown to users, so no paths: the container path means nothing on the host,
// and a subfolder goes by its own name.
function describeLibraryCheck({ reason, path: checkedPath }) {
  const subfolder = checkedPath ? path.basename(checkedPath) : '';
  switch (reason) {
  case LIBRARY_CHECK_REASONS.MISSING:
    return 'The downloads folder does not exist.';
  case LIBRARY_CHECK_REASONS.EMPTY:
    return 'The downloads folder is empty.';
  case LIBRARY_CHECK_REASONS.UNREADABLE:
    return 'The downloads folder could not be read.';
  case LIBRARY_CHECK_REASONS.SUBFOLDER_EMPTY:
    return `The subfolder ${subfolder} is empty.`;
  case LIBRARY_CHECK_REASONS.SUBFOLDER_UNREADABLE:
    return `The subfolder ${subfolder} could not be read.`;
  default:
    return 'The downloads folder could not be checked.';
  }
}

function failure(reason, checkedPath) {
  return { ok: false, reason, path: checkedPath, message: describeLibraryCheck({ reason, path: checkedPath }) };
}

const SUBFOLDER_FAILURE_WORDING = [
  // Strictest first: an unreadable subfolder can never be explained away as emptied on purpose.
  { reason: LIBRARY_CHECK_REASONS.SUBFOLDER_UNREADABLE, one: 'could not be read', many: 'could not be read' },
  { reason: LIBRARY_CHECK_REASONS.SUBFOLDER_EMPTY, one: 'is empty', many: 'are empty' },
];

function listNames(names) {
  if (names.length <= 2) return names.join(' and ');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * One result for every failing subfolder: `reason` is the strictest one (so an
 * unreadable share is never treated as emptied on purpose) and `path` the first
 * subfolder failing that way; `paths` lists them all, and `message` names them.
 * @param {Array<{reason: string, path: string}>} failures - in listing order
 */
function subfolderFailure(failures) {
  const strictest = SUBFOLDER_FAILURE_WORDING.find(({ reason }) => failures.some((f) => f.reason === reason)).reason;
  const sentences = [...SUBFOLDER_FAILURE_WORDING].reverse().map(({ reason, one, many }) => {
    const names = failures.filter((f) => f.reason === reason).map((f) => path.basename(f.path));
    if (names.length === 0) return null;
    return names.length === 1 ? `The subfolder ${names[0]} ${one}.` : `The subfolders ${listNames(names)} ${many}.`;
  }).filter(Boolean);
  return {
    ok: false,
    reason: strictest,
    path: failures.find((f) => f.reason === strictest).path,
    paths: failures.map((f) => f.path),
    message: sentences.join(' '),
  };
}

// Entries Youtarr creates itself, possibly on a bare mount point while the
// share is down, so they say nothing about whether the library is there.
function isYoutarrManagedEntry(name) {
  return name === LOCAL_TEMP_DIR_NAME || name === M3U_FOLDER_NAME || name.startsWith(HEALTHCHECK_FILE_PREFIX);
}

/**
 * The root must exist and hold something; every `__subfolder` in it (a share
 * of its own, on some setups) must hold something too. A root failure is
 * reported alone; every failing subfolder is reported (see subfolderFailure),
 * since each one only covers the files under it and two shares can be down at once.
 * Entries Youtarr creates itself do not count (see isYoutarrManagedEntry).
 * @param {string} baseDir - The downloads root
 * @param {{ readdir?: Function }} [deps] - fs.promises.readdir, injectable for tests
 * @returns {Promise<{ok: true}|{ok: false, reason: string, path: string, paths?: string[], message: string}>}
 *   paths: every failing subfolder, for subfolder reasons
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

  const failures = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !isSubfolderDirectory(entry.name)) continue;
    const subfolder = path.join(baseDir, entry.name);
    let children;
    try {
      children = await readdir(subfolder, { withFileTypes: true });
    } catch (err) {
      // Gone since the root was listed: not a mount problem.
      if (ABSENT_CODES.includes(err.code)) continue;
      failures.push({ reason: LIBRARY_CHECK_REASONS.SUBFOLDER_UNREADABLE, path: subfolder });
      continue;
    }
    if (children.length === 0) failures.push({ reason: LIBRARY_CHECK_REASONS.SUBFOLDER_EMPTY, path: subfolder });
  }

  return failures.length > 0 ? subfolderFailure(failures) : { ok: true };
}

// The failing subfolders of a subfolder-reason check.
function failingSubfolders(check) {
  return check.paths ?? [check.path];
}

const withTrailingSep = (dir) => (dir.endsWith(path.sep) ? dir : `${dir}${path.sep}`);

/**
 * Whether a failing check puts the given file in doubt: a root failure covers
 * every file, a subfolder failure only the files under the failing subfolders.
 * @param {{ok: boolean, reason?: string, path?: string, paths?: string[]}} check - a checkLibraryRoot result
 * @param {string|null|undefined} filePath
 * @returns {boolean}
 */
function isUnderLibraryCheckPath(check, filePath) {
  if (!check || check.ok || !filePath) return false;
  if (!SUBFOLDER_REASONS.includes(check.reason)) return true;
  return failingSubfolders(check).some((dir) => filePath.startsWith(withTrailingSep(dir)));
}

/**
 * Whether a failing check covers a videos row: either of its files is in doubt.
 * @param {{ok: boolean, reason?: string, path?: string}} check - a checkLibraryRoot result
 * @param {{filePath?: (string|null), audioFilePath?: (string|null)}} row
 * @returns {boolean}
 */
function isRowUnderLibraryCheck(check, row) {
  return isUnderLibraryCheckPath(check, row.filePath) || isUnderLibraryCheckPath(check, row.audioFilePath);
}

// A LIKE pattern matching every path under `dir`, with LIKE's own wildcards
// escaped: every subfolder name starts with two `_`.
function pathPrefixPattern(dir) {
  return `${withTrailingSep(dir).replace(/[\\%_]/g, '\\$&')}%`;
}

/**
 * Whether a failing check covers any videos row the filter matches: for a
 * root failure every such row, for a subfolder failure only the rows stored
 * under the failing subfolders. An empty subfolder nothing was ever downloaded to (or
 * that a channel move left behind) covers nothing, so it blocks nothing.
 * @param {{ok: boolean, reason?: string, path?: string}} check - a checkLibraryRoot result
 * @param {{count: Function}} Video - the Video model
 * @param {Object} where - Sequelize filter for the rows that matter to the caller
 * @returns {Promise<boolean>}
 */
async function libraryCheckCoversRows(check, Video, where) {
  if (!check || check.ok) return false;
  if (!SUBFOLDER_REASONS.includes(check.reason)) {
    return (await Video.count({ where })) > 0;
  }
  const underSubfolder = {
    [Op.or]: failingSubfolders(check).flatMap((dir) => {
      const pattern = pathPrefixPattern(dir);
      return [{ filePath: { [Op.like]: pattern } }, { audioFilePath: { [Op.like]: pattern } }];
    }),
  };
  return (await Video.count({ where: { [Op.and]: [where, underSubfolder] } })) > 0;
}

module.exports = {
  LIBRARY_CHECK_REASONS,
  checkLibraryRoot,
  describeLibraryCheck,
  isYoutarrManagedEntry,
  isUnderLibraryCheckPath,
  isRowUnderLibraryCheck,
  libraryCheckCoversRows,
};
