// Holds back the rescan's missing marks for a folder where most downloaded
// videos are gone. A rescan that finds 2 files for 16,801 downloaded videos is
// almost certainly looking at the wrong folder (a volume mapping that points
// elsewhere, or an unmounted share whose mount point a download has written
// into), not at a library deleted by hand. The walk finds moved and renamed
// files by YouTube id, so a library reorganized by hand still passes.
const path = require('path');
// pathBuilder, not the filesystem index: the index loads fileOperations, which
// binds child_process at require time, and this needs neither.
const { isSubfolderDirectory } = require('./filesystem/pathBuilder');

// A folder is held back only when at least this many of its videos are gone...
const MIN_NOT_FOUND = 25;
// ...and they are at least this share of the downloaded videos stored there.
const MIN_NOT_FOUND_SHARE = 0.5;

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
 * @returns {{held: Array<{dir: string, total: number, notFound: number}>, holdsBack: function(Object): boolean,
 *   message: (string|null)}}
 */
function buildMissingGate(presentRows, fileMap, baseDir) {
  const units = new Map();
  for (const row of presentRows) {
    const dir = rowUnit(row, baseDir);
    if (!dir) continue;
    const unit = units.get(dir) ?? { dir, total: 0, notFound: 0 };
    unit.total += 1;
    if (!fileMap.has(row.youtubeId)) unit.notFound += 1;
    units.set(dir, unit);
  }

  const held = [...units.values()].filter(
    (unit) => unit.notFound >= MIN_NOT_FOUND && unit.notFound / unit.total >= MIN_NOT_FOUND_SHARE
  );
  const heldDirs = new Set(held.map((unit) => unit.dir));
  return {
    held,
    holdsBack: (row) => heldDirs.has(rowUnit(row, baseDir)),
    message: held.length > 0 ? held.map((unit) => describeUnit(unit, baseDir)).join(' ') : null,
  };
}

/**
 * Read every present row's location and build the gate for this walk.
 * @param {{findAll: Function}} Video - the Video model
 * @param {Map<string, Object>} fileMap - the walk's files, keyed by YouTube id
 * @param {string} baseDir - the downloads root
 */
async function loadMissingGate(Video, fileMap, baseDir) {
  const presentRows = await Video.findAll({
    attributes: ['youtubeId', 'filePath', 'audioFilePath'],
    where: { removed: false },
    raw: true,
  });
  return buildMissingGate(presentRows, fileMap, baseDir);
}

module.exports = { buildMissingGate, loadMissingGate };
