// Is the downloads folder really there? An unmounted drive or network share
// leaves its mount point missing or empty, and every stored path under it
// would then look gone. Nothing may be marked missing while this check fails.
const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const logger = require('../logger');
// pathBuilder, not the filesystem index: the index loads fileOperations, which
// binds child_process at require time, and this check needs neither.
const { isSubfolderDirectory } = require('./filesystem/pathBuilder');
const {
  LOCAL_TEMP_DIR_NAME, M3U_FOLDER_NAME, HEALTHCHECK_FILE_PREFIX, ARR_STAGING_DIR_NAME, SUBFOLDER_PREFIX,
} = require('./filesystem/constants');
const { REMOVAL_STATES, notStateWhere } = require('./videoRemovalState');

const LIBRARY_CHECK_REASONS = {
  MISSING: 'missing',
  EMPTY: 'empty',
  UNREADABLE: 'unreadable',
  NOT_FOUND: 'not-found',
  SUBFOLDER_EMPTY: 'subfolder-empty',
  SUBFOLDER_UNREADABLE: 'subfolder-unreadable',
  // Only from channelFolderCreationBlock: checkLibraryRoot never reports a
  // subfolder that is not there.
  SUBFOLDER_MISSING: 'subfolder-missing',
};
const SUBFOLDER_REASONS = [
  LIBRARY_CHECK_REASONS.SUBFOLDER_EMPTY, LIBRARY_CHECK_REASONS.SUBFOLDER_UNREADABLE, LIBRARY_CHECK_REASONS.SUBFOLDER_MISSING,
];

// ENOTDIR: the folder's path now leads to a regular file, so the folder is gone.
const ABSENT_CODES = ['ENOENT', 'ENOTDIR'];

// The presence probe stats this many randomly picked downloaded videos...
const PRESENCE_PROBE_SAMPLE_SIZE = 20;
// ...needs at least this many definite answers to judge...
const PRESENCE_PROBE_MIN_CHECKED = 10;
// ...and fails when fewer than this share of them are where they were saved.
const PRESENCE_PROBE_MIN_FOUND_SHARE = 0.5;
// Pages, the trash card and the download pause all ask; one probe serves them for this long.
const PRESENCE_PROBE_CACHE_MS = 30 * 1000;
// How long a finished download waits on the check of its destination before
// it is moved regardless: a share that hangs must not hold the video in temp.
const CHANNEL_FOLDER_CHECK_TIMEOUT_MS = 10 * 1000;
const TIMED_OUT = Symbol('timed out');

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
  case LIBRARY_CHECK_REASONS.NOT_FOUND:
    // Files moved by hand inside the library leave stale paths too, and a rescan repairs those.
    return 'Most downloaded videos are not where Youtarr saved them; if you moved files inside the downloads folder, run a rescan.';
  case LIBRARY_CHECK_REASONS.SUBFOLDER_EMPTY:
    return `The subfolder ${subfolder} is empty.`;
  case LIBRARY_CHECK_REASONS.SUBFOLDER_UNREADABLE:
    return `The subfolder ${subfolder} could not be read.`;
  case LIBRARY_CHECK_REASONS.SUBFOLDER_MISSING:
    return `The subfolder ${subfolder} does not exist.`;
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
  return name === LOCAL_TEMP_DIR_NAME || name === M3U_FOLDER_NAME || name === ARR_STAGING_DIR_NAME
    || name.startsWith(HEALTHCHECK_FILE_PREFIX);
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

const escapeLike = (text) => text.replace(/[\\%_]/g, '\\$&');

// A LIKE pattern matching every path under `dir`, with LIKE's own wildcards
// escaped: every subfolder name starts with two `_`.
function pathPrefixPattern(dir) {
  return `${escapeLike(withTrailingSep(dir))}%`;
}

// The column filter for paths the probe samples: everything under the root, or
// one storage unit (a `__subfolder`, or the root outside every `__subfolder`).
function storedUnderFilter(baseDir, unitDir) {
  if (unitDir !== baseDir) return { [Op.like]: pathPrefixPattern(unitDir ?? baseDir) };
  // "__name/..." only: a file in the root whose own name starts with "__"
  // is a root file, as it is for the rescan (rescanMissingGate).
  return {
    [Op.like]: pathPrefixPattern(baseDir),
    [Op.notLike]: `${escapeLike(`${withTrailingSep(baseDir)}${SUBFOLDER_PREFIX}`)}%${escapeLike(path.sep)}%`,
  };
}

// Whether a stored path belongs to the storage unit, by the same rule as
// storedUnderFilter.
function isStoredInUnit(filePath, baseDir, unitDir) {
  if (!filePath) return false;
  if (unitDir !== baseDir) return filePath.startsWith(withTrailingSep(unitDir));
  const root = withTrailingSep(baseDir);
  if (!filePath.startsWith(root)) return false;
  const segments = filePath.slice(root.length).split(path.sep);
  return !(segments.length > 1 && isSubfolderDirectory(segments[0]));
}

// A sampled row with only the paths stored in the unit: a video's other file
// may sit on another share, which says nothing about this one and must not be
// read (it may hang).
function scopeRowToUnit(row, baseDir, unitDir) {
  return {
    filePath: isStoredInUnit(row.filePath, baseDir, unitDir) ? row.filePath : null,
    audioFilePath: isStoredInUnit(row.audioFilePath, baseDir, unitDir) ? row.audioFilePath : null,
  };
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
  return (await countRowsUnderLibraryCheck(check, Video, where)) > 0;
}

/**
 * How many videos rows the filter matches that a failing check puts in doubt
 * (see libraryCheckCoversRows); 0 for a passing check.
 * @param {{ok: boolean, reason?: string, path?: string}} check - a checkLibraryRoot result
 * @param {{count: Function}} Video - the Video model
 * @param {Object} where - Sequelize filter for the rows that matter to the caller
 * @returns {Promise<number>}
 */
async function countRowsUnderLibraryCheck(check, Video, where) {
  if (!check || check.ok) return 0;
  if (!SUBFOLDER_REASONS.includes(check.reason)) {
    return Video.count({ where });
  }
  const underSubfolder = {
    [Op.or]: failingSubfolders(check).flatMap((dir) => {
      const pattern = pathPrefixPattern(dir);
      return [{ filePath: { [Op.like]: pattern } }, { audioFilePath: { [Op.like]: pattern } }];
    }),
  };
  return Video.count({ where: { [Op.and]: [where, underSubfolder] } });
}

// 'present' if any of the paths is a regular file, 'absent' if every one is
// confirmed gone, 'unknown' if a check failed for another reason.
async function storedFileState(paths, stat) {
  let unknown = false;
  for (const candidate of paths.filter(Boolean)) {
    try {
      if ((await stat(candidate)).isFile()) return 'present';
    } catch (err) {
      if (!ABSENT_CODES.includes(err.code)) unknown = true;
    }
  }
  return unknown ? 'unknown' : 'absent';
}

/**
 * The channel folder a stored file sits in: the first folder under the
 * downloads root, or under the `__subfolder` the file is stored in. Null for a
 * file with no folder of its own there, or stored outside the root.
 * @param {string|null|undefined} filePath
 * @param {string} baseDir - The downloads root
 * @returns {string|null}
 */
function channelFolderOf(filePath, baseDir) {
  if (!filePath) return null;
  const root = withTrailingSep(baseDir);
  if (!filePath.startsWith(root)) return null;
  const segments = filePath.slice(root.length).split(path.sep);
  const depth = segments.length > 1 && isSubfolderDirectory(segments[0]) ? 2 : 1;
  return segments.length > depth ? path.join(baseDir, ...segments.slice(0, depth)) : null;
}

/**
 * The channel folder of a videos row: its video file's, else its audio file's.
 * @param {{filePath?: (string|null), audioFilePath?: (string|null)}} row
 * @param {string} baseDir - The downloads root
 * @returns {string|null}
 */
function rowChannelFolder(row, baseDir) {
  return channelFolderOf(row.filePath, baseDir) ?? channelFolderOf(row.audioFilePath, baseDir);
}

/**
 * Is the folder there? A video gone from a channel folder that still exists
 * was deleted on purpose (in a media server, or by hand): an unmounted drive
 * or a volume mapping that points elsewhere takes the channel folders with
 * it. Any doubt (a failed check included) answers no, the cautious side.
 * @param {string} dir
 * @param {Function} [stat] - fs.promises.stat, injectable for tests
 * @returns {Promise<boolean>}
 */
async function folderExists(dir, stat = fs.promises.stat) {
  try {
    return (await stat(dir)).isDirectory();
  } catch (err) {
    return false;
  }
}

// Whether a sampled video speaks for the library being there: 'found' with a
// file on disk, or with its file deleted from a channel folder that is still
// there; 'gone' when the channel folder went with it; 'unknown' as above.
async function sampledVideoState(row, baseDir, stat, channelFolderThere) {
  const fileState = await storedFileState([row.filePath, row.audioFilePath], stat);
  if (fileState === 'present') return 'found';
  if (fileState === 'unknown') return 'unknown';
  const channelFolder = rowChannelFolder(row, baseDir);
  return channelFolder && await channelFolderThere(channelFolder) ? 'found' : 'gone';
}

const presenceProbeCache = new Map();

// Drop the probe's cached answers: a rescan just repaired the stored paths it
// samples, so the next check must look again rather than repeat a stale result.
function forgetStoredFilesProbe() {
  presenceProbeCache.clear();
}

/**
 * Are downloaded videos where Youtarr saved them? Stats the stored files of a
 * random sample of present videos stored under the root. Catches a downloads
 * folder that is not empty but is not the library either: a volume mapping
 * that points elsewhere, or a bare mount point a download has written into.
 * A file gone from a channel folder that is still there counts as found (see
 * folderExists), so deleting most of a library outside Youtarr passes.
 * Fails open (passes) when the sample cannot be read.
 * @param {string} baseDir - The downloads root
 * @param {{findAll: Function, sequelize: {random: Function}}} Video - the Video model
 * @param {{ stat?: Function, now?: Function }} [deps] - injectable for tests
 * @param {string|null} [unitDir] - sample one storage unit only: a `__subfolder`, or the root for the
 *   videos stored outside every `__subfolder`; null samples everything under the root
 * @returns {Promise<{ok: true}|{ok: false, reason: string, path: string, message: string}>}
 */
async function probeStoredFiles(baseDir, Video, { stat = fs.promises.stat, now = Date.now } = {}, unitDir = null) {
  const cacheKey = unitDir === null ? baseDir : `unit:${unitDir}`;
  const cached = presenceProbeCache.get(cacheKey);
  // A copy: callers decorate the result they get.
  if (cached && now() - cached.at < PRESENCE_PROBE_CACHE_MS) return { ...cached.result };

  let rows;
  try {
    const storedThere = storedUnderFilter(baseDir, unitDir);
    rows = await Video.findAll({
      attributes: ['filePath', 'audioFilePath'],
      where: { removed: false, [Op.or]: [{ filePath: storedThere }, { audioFilePath: storedThere }] },
      order: Video.sequelize.random(),
      limit: PRESENCE_PROBE_SAMPLE_SIZE,
      raw: true,
    });
  } catch (err) {
    logger.warn({ err }, 'Could not read videos to check the downloads folder; assuming it is fine');
    return { ok: true };
  }

  // One stat per channel folder, however many sampled videos share it.
  const channelFolderChecks = new Map();
  const channelFolderThere = (dir) => {
    if (!channelFolderChecks.has(dir)) channelFolderChecks.set(dir, folderExists(dir, stat));
    return channelFolderChecks.get(dir);
  };
  const sampled = unitDir === null ? rows : rows.map((row) => scopeRowToUnit(row, baseDir, unitDir));
  const states = await Promise.all(sampled.map((row) => sampledVideoState(row, baseDir, stat, channelFolderThere)));
  const checked = states.filter((state) => state !== 'unknown').length;
  const found = states.filter((state) => state === 'found').length;
  const result = checked >= PRESENCE_PROBE_MIN_CHECKED && found / checked < PRESENCE_PROBE_MIN_FOUND_SHARE
    ? failure(LIBRARY_CHECK_REASONS.NOT_FOUND, unitDir ?? baseDir)
    : { ok: true };
  presenceProbeCache.set(cacheKey, { at: now(), result });
  return { ...result };
}

/**
 * checkLibraryRoot, then (if the root passes) the presence probe: what every
 * writer except the rescan uses before treating a file as gone. The rescan
 * uses checkLibraryRoot alone, because stale paths after files were moved by
 * hand are exactly what it repairs; it judges what its walk found instead.
 * @param {string} baseDir - The downloads root
 * @param {Object} Video - the Video model
 * @param {{ readdir?: Function, stat?: Function, now?: Function }} [deps] - injectable for tests
 */
async function checkLibraryAvailable(baseDir, Video, deps = {}) {
  const rootCheck = await checkLibraryRoot(baseDir, deps);
  if (!rootCheck.ok) return rootCheck;
  return probeStoredFiles(baseDir, Video, deps);
}

/**
 * The failure that should hold new downloads, or null. Only a failure of the
 * downloads folder itself counts (new files would land on a bare mount point
 * or in the wrong folder), and only while it covers videos still on record as
 * present or missing: a fresh install, or a library whose files the user
 * removed and marked as deleted, keeps downloading.
 * @param {string} baseDir - The downloads root
 * @param {Object} Video - the Video model
 * @returns {Promise<{ok: false, reason: string, path: string, message: string}|null>}
 */
async function downloadsFolderBlock(baseDir, Video) {
  const check = await checkLibraryAvailable(baseDir, Video);
  if (check.ok || SUBFOLDER_REASONS.includes(check.reason)) return null;
  return (await libraryCheckCoversRows(check, Video, notStateWhere(REMOVAL_STATES.DELETED))) ? check : null;
}

// The storage unit a channel folder sits in: its `__subfolder`, else the root.
// Null for a folder outside the root.
function destinationUnitOf(channelFolder, baseDir) {
  if (channelFolder === baseDir) return baseDir;
  const root = withTrailingSep(baseDir);
  if (!channelFolder.startsWith(root)) return null;
  const [first] = channelFolder.slice(root.length).split(path.sep);
  return isSubfolderDirectory(first) ? path.join(baseDir, first) : baseDir;
}

// The failure of one storage unit that covers videos on record, or null: the
// unit must hold something, and a sample of the videos stored in it must be
// there. Only this unit is read, never a sibling `__subfolder`.
async function storageUnitBlock(baseDir, unitDir, Video, deps) {
  const { readdir = fs.promises.readdir } = deps;
  const isRoot = unitDir === baseDir;
  let listingFailure = null;
  try {
    const entries = await readdir(unitDir, { withFileTypes: true });
    const holds = isRoot ? entries.filter((entry) => !isYoutarrManagedEntry(entry.name)) : entries;
    if (holds.length === 0) {
      listingFailure = failure(isRoot ? LIBRARY_CHECK_REASONS.EMPTY : LIBRARY_CHECK_REASONS.SUBFOLDER_EMPTY, unitDir);
    }
  } catch (err) {
    const absent = ABSENT_CODES.includes(err.code);
    if (absent && !isRoot) {
      // A subfolder that is not there and has nothing on record is simply
      // new, and the root decides. One with videos on record went away with
      // them: the root dropped or was remapped, and its sample (which leaves
      // subfolder videos out) would see nothing wrong.
      const missing = failure(LIBRARY_CHECK_REASONS.SUBFOLDER_MISSING, unitDir);
      if (await libraryCheckCoversRows(missing, Video, notStateWhere(REMOVAL_STATES.DELETED))) return missing;
      return storageUnitBlock(baseDir, baseDir, Video, deps);
    }
    const rootReason = absent ? LIBRARY_CHECK_REASONS.MISSING : LIBRARY_CHECK_REASONS.UNREADABLE;
    listingFailure = failure(isRoot ? rootReason : LIBRARY_CHECK_REASONS.SUBFOLDER_UNREADABLE, unitDir);
  }
  if (listingFailure) {
    const coversVideos = await libraryCheckCoversRows(listingFailure, Video, notStateWhere(REMOVAL_STATES.DELETED));
    return coversVideos ? listingFailure : null;
  }

  const probe = await probeStoredFiles(baseDir, Video, deps, unitDir);
  return probe.ok ? null : probe;
}

/**
 * The failure that should stop a finished download from creating its channel
 * folder, or null. The download pause is only checked when a job starts and
 * never for a `__subfolder`, so a share that is down would get the folder
 * created on its bare mount point, and a channel folder that exists makes its
 * gone videos count as deleted on purpose (see folderExists).
 * A channel folder already there needs no check: nothing new is created. Only
 * the destination's own storage unit is read, within a time limit, so a share
 * that hangs elsewhere never holds a download. Passes when the limit runs out.
 * @param {string} baseDir - The downloads root
 * @param {string} channelFolder - the channel folder the download is about to be moved into
 * @param {Object} Video - the Video model
 * @param {{ readdir?: Function, stat?: Function, now?: Function, timeoutMs?: number }} [deps] - injectable for tests
 * @returns {Promise<{ok: false, reason: string, path: string, message: string}|null>}
 */
async function channelFolderCreationBlock(baseDir, channelFolder, Video, deps = {}) {
  const { timeoutMs = CHANNEL_FOLDER_CHECK_TIMEOUT_MS } = deps;
  const check = async () => {
    const unitDir = destinationUnitOf(channelFolder, baseDir);
    if (!unitDir) return null;
    if (channelFolder !== unitDir && await folderExists(channelFolder, deps.stat)) return null;
    return storageUnitBlock(baseDir, unitDir, Video, deps);
  };

  let timer;
  const timeLimit = new Promise((resolve) => {
    timer = setTimeout(() => resolve(TIMED_OUT), timeoutMs);
  });
  try {
    const outcome = await Promise.race([check(), timeLimit]);
    if (outcome !== TIMED_OUT) return outcome;
    logger.warn({ timeoutMs, channelFolder }, 'The check of a download\'s destination folder did not answer in time; moving the video anyway');
    return null;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  LIBRARY_CHECK_REASONS,
  checkLibraryRoot,
  checkLibraryAvailable,
  downloadsFolderBlock,
  channelFolderCreationBlock,
  forgetStoredFilesProbe,
  rowChannelFolder,
  folderExists,
  describeLibraryCheck,
  isYoutarrManagedEntry,
  isUnderLibraryCheckPath,
  isRowUnderLibraryCheck,
  libraryCheckCoversRows,
  countRowsUnderLibraryCheck,
};
