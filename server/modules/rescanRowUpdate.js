// Decides what the filesystem rescan writes for one videos row.
//
// The rescan walks the disk once, then reads rows in chunks; downloads and
// deletions that land in between make the walk stale. The walk therefore only
// nominates rows (isRescanCandidate). What to write is decided from a fresh
// stat of each format's files at write time (resolveRescanUpdate), and the
// caller writes it only if the row is still as read.

const PRESENT = 'present';
const MISSING = 'missing';
const UNKNOWN = 'unknown';

function sameValue(a, b) {
  if (a === null || a === undefined || b === null || b === undefined) {
    return (a === null || a === undefined) && (b === null || b === undefined);
  }
  // Sizes come back from the database as strings and from stat as numbers.
  return String(a) === String(b);
}

/**
 * Whether the walk suggests the row needs a write. Mirrors the rescan's
 * long-standing change detection; the fresh check decides what, if anything,
 * is actually written.
 * @param {Object} row - Row as read (raw)
 * @param {Object|undefined} fileInfo - The walk's entry for the row's YouTube id
 * @param {string|null} probedResolution - Dimensions probed during this run, if any
 * @returns {boolean}
 */
function isRescanCandidate(row, fileInfo, probedResolution) {
  if (!fileInfo) return !row.removed;

  const hasVideoFile = Boolean(fileInfo.videoFilePath);
  const hasAudioFile = Boolean(fileInfo.audioFilePath);
  if (!hasVideoFile && !hasAudioFile) return false;

  return Boolean(
    (hasVideoFile && !sameValue(row.filePath, fileInfo.videoFilePath))
    || (hasVideoFile && (!row.fileSize || !sameValue(row.fileSize, fileInfo.videoFileSize)))
    || (hasAudioFile && !sameValue(row.audioFilePath, fileInfo.audioFilePath))
    || (hasAudioFile && (!row.audioFileSize || !sameValue(row.audioFileSize, fileInfo.audioFileSize)))
    || (!hasAudioFile && (row.audioFilePath || row.audioFileSize))
    || (!hasVideoFile && (row.filePath || row.fileSize))
    || row.removed
    || probedResolution !== null
  );
}

// Present if any candidate path exists now; missing only if every one is
// confirmed absent; unknown if a check failed for any other reason.
async function checkFormat(paths, stat) {
  const candidates = [...new Set(paths.filter(Boolean))];
  let unknown = false;
  for (const candidate of candidates) {
    try {
      const stats = await stat(candidate);
      return { state: PRESENT, path: candidate, size: stats.size };
    } catch (err) {
      if (err.code !== 'ENOENT') unknown = true;
    }
  }
  return { state: unknown ? UNKNOWN : MISSING };
}

/**
 * Recompute a nominated row's update from the disk as it is now.
 * @param {Object} row - Row as read (raw)
 * @param {Object|undefined} fileInfo - The walk's entry for the row, if any
 * @param {string|null} probedResolution - Dimensions probed from fileInfo.videoFilePath during the walk
 * @param {Function} stat - fs.promises.stat, injected
 * @returns {Promise<Object|null>} The columns to write, or null when the row already matches the disk.
 *   A non-null result always changes at least one column's value; the caller's
 *   conflict check (videoRowGuard) relies on that, so never return a no-op write.
 */
async function resolveRescanUpdate(row, fileInfo, probedResolution, stat) {
  // Prefer the path the walk found (files may have moved), then the stored one.
  const video = await checkFormat([fileInfo?.videoFilePath, row.filePath], stat);
  const audio = await checkFormat([fileInfo?.audioFilePath, row.audioFilePath], stat);
  const statusKnown = video.state !== UNKNOWN && audio.state !== UNKNOWN;
  const anyPresent = video.state === PRESENT || audio.state === PRESENT;

  if (!anyPresent) {
    // Nothing on disk and one format unchecked: can't tell, so write nothing.
    if (!statusKnown) return null;
    // Keep the stored paths: page-load checks look there for a returning file.
    return row.removed ? null : { removed: true };
  }

  const desired = {};
  if (video.state === PRESENT) {
    desired.filePath = video.path;
    desired.fileSize = video.size;
    // Only trust a probe of the exact file still on disk.
    const probedFileUnchanged = fileInfo
      && video.path === fileInfo.videoFilePath
      && sameValue(video.size, fileInfo.videoFileSize);
    if (probedResolution !== null && probedFileUnchanged) {
      desired.video_resolution = probedResolution;
    }
  } else if (video.state === MISSING && statusKnown) {
    desired.filePath = null;
    desired.fileSize = null;
    // The dimensions belonged to the missing file; a returning file is re-probed.
    desired.video_resolution = null;
  }
  if (audio.state === PRESENT) {
    desired.audioFilePath = audio.path;
    desired.audioFileSize = audio.size;
  } else if (audio.state === MISSING && statusKnown) {
    desired.audioFilePath = null;
    desired.audioFileSize = null;
  }

  const changes = {};
  for (const [column, value] of Object.entries(desired)) {
    if (!sameValue(value, row[column])) changes[column] = value;
  }

  // A file is present, so the row isn't missing, even if the other format
  // couldn't be checked (that format is left as stored above).
  if (Object.keys(changes).length === 0 && !row.removed) return null;
  changes.removed = false;
  return changes;
}

module.exports = { isRescanCandidate, resolveRescanUpdate };
