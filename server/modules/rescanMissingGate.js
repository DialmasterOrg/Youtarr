// Holds back the rescan's missing marks for a folder where most downloaded
// videos are gone. A rescan that finds 2 files for 16,801 downloaded videos is
// almost certainly looking at the wrong folder (a volume mapping that points
// elsewhere, or an unmounted share whose mount point a download has written
// into), not at a library deleted by hand. The walk finds moved and renamed
// files by YouTube id, so a library reorganized by hand still passes. So does
// one whose videos were deleted outside Youtarr (in a media server, or by
// hand): their channel folders are still there, while a wrong folder has none
// of them, so only a video whose channel folder is gone too counts.
const fs = require('fs');
const path = require('path');
// pathBuilder, not the filesystem index: the index loads fileOperations, which
// binds child_process at require time, and this needs neither.
const { isSubfolderDirectory } = require('./filesystem/pathBuilder');
const { rowChannelFolder, folderExists } = require('./libraryRootCheck');
const createLimiter = require('./subscriptionImport/concurrencyLimiter');

// A folder is held back only when at least this many of its videos are gone
// along with their channel folders...
const MIN_NOT_FOUND = 25;
// ...and they are at least this share of the downloaded videos stored there.
const MIN_NOT_FOUND_SHARE = 0.5;
// Channel folders checked at once, on what may be a slow network share.
const CHANNEL_FOLDER_CHECK_CONCURRENCY = 8;

const withTrailingSep = (dir) => (dir.endsWith(path.sep) ? dir : `${dir}${path.sep}`);
const formatCount = (n) => n.toLocaleString('en-US');

// The storage unit a file belongs to: the `__subfolder` it sits in (a share of
// its own on some setups), else the root. Null for a file outside the root.
function storageUnitOf(filePath, baseDir) {
  if (!filePath) return null;
  const root = withTrailingSep(baseDir);
  if (!filePath.startsWith(root)) return null;
  const [first, ...rest] = filePath.slice(root.length).split(path.sep);
  return rest.length > 0 && isSubfolderDirectory(first) ? path.join(baseDir, first) : baseDir;
}

function rowUnit(row, baseDir) {
  return storageUnitOf(row.filePath, baseDir) ?? storageUnitOf(row.audioFilePath, baseDir);
}

function describeUnit(unit, baseDir) {
  const where = unit.dir === baseDir ? 'the downloads folder' : `the subfolder ${path.basename(unit.dir)}`;
  const found = unit.total - unit.notFound;
  return `Only ${formatCount(found)} of the ${formatCount(unit.total)} downloaded videos stored in ${where} were found.`;
}

/**
 * Decide, from what the walk found, which storage units the rescan must not
 * mark anything missing in.
 * @param {Array<{youtubeId: string, filePath: (string|null), audioFilePath: (string|null)}>} presentRows -
 *   every present videos row
 * @param {Map<string, Object>} fileMap - the walk's files, keyed by YouTube id
 * @param {string} baseDir - the downloads root
 * @param {Set<string>} [channelFoldersOnDisk] - channel folders known to exist; a video not found in one
 *   of them was deleted on purpose and does not count toward holding its folder back
 * @returns {{held: Array<{dir: string, total: number, notFound: number, channelFolderGone: number}>,
 *   holdsBack: function(Object): boolean, message: (string|null)}} channelFolderGone: the not-found
 *   videos whose channel folder is gone too, the ones a folder is held back for
 */
function buildMissingGate(presentRows, fileMap, baseDir, channelFoldersOnDisk = new Set()) {
  const units = new Map();
  for (const row of presentRows) {
    const dir = rowUnit(row, baseDir);
    if (!dir) continue;
    const unit = units.get(dir) ?? { dir, total: 0, notFound: 0, channelFolderGone: 0 };
    unit.total += 1;
    if (!fileMap.has(row.youtubeId)) {
      unit.notFound += 1;
      if (!channelFoldersOnDisk.has(rowChannelFolder(row, baseDir))) unit.channelFolderGone += 1;
    }
    units.set(dir, unit);
  }

  const held = [...units.values()].filter(
    (unit) => unit.channelFolderGone >= MIN_NOT_FOUND && unit.channelFolderGone / unit.total >= MIN_NOT_FOUND_SHARE
  );
  const heldDirs = new Set(held.map((unit) => unit.dir));
  return {
    held,
    holdsBack: (row) => heldDirs.has(rowUnit(row, baseDir)),
    message: held.length > 0 ? held.map((unit) => describeUnit(unit, baseDir)).join(' ') : null,
  };
}

/**
 * Read every present row's location and build the gate for this walk. The
 * disk is asked about channel folders only when a folder would be held back
 * without them, so an ordinary rescan pays nothing for it.
 * @param {{findAll: Function}} Video - the Video model
 * @param {Map<string, Object>} fileMap - the walk's files, keyed by YouTube id
 * @param {string} baseDir - the downloads root
 * @param {{ stat?: Function }} [deps] - fs.promises.stat, injectable for tests
 */
async function loadMissingGate(Video, fileMap, baseDir, { stat = fs.promises.stat } = {}) {
  const presentRows = await Video.findAll({
    attributes: ['youtubeId', 'filePath', 'audioFilePath'],
    where: { removed: false },
    raw: true,
  });
  const gate = buildMissingGate(presentRows, fileMap, baseDir);
  if (gate.held.length === 0) return gate;

  const channelFolders = new Set();
  for (const row of presentRows) {
    if (fileMap.has(row.youtubeId) || !gate.holdsBack(row)) continue;
    const channelFolder = rowChannelFolder(row, baseDir);
    if (channelFolder) channelFolders.add(channelFolder);
  }
  const limit = createLimiter(CHANNEL_FOLDER_CHECK_CONCURRENCY);
  const channelFoldersOnDisk = new Set();
  await Promise.all([...channelFolders].map((dir) => limit(async () => {
    if (await folderExists(dir, stat)) channelFoldersOnDisk.add(dir);
  })));
  return channelFoldersOnDisk.size > 0 ? buildMissingGate(presentRows, fileMap, baseDir, channelFoldersOnDisk) : gate;
}

module.exports = { buildMissingGate, loadMissingGate };
