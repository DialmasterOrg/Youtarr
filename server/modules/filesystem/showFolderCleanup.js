/**
 * Cleanup for TV-layout library folders, where episodes sit directly in season
 * folders: <library folder>/<show>/Season NN/<episode files>. A library folder
 * is the downloads folder itself or a __subfolder directly under it. Callers
 * decide whether a library folder uses the TV layout; these helpers only
 * understand the folder shape.
 */

const fsPromises = require('fs').promises;
const path = require('path');
const logger = require('../../logger');
const {
  SUBFOLDER_PREFIX,
  MAIN_LIBRARY_FOLDER,
  SEASON_FOLDER_PATTERN,
  TV_SEASON_IGNORABLE_FILE_PATTERN,
  TV_SHOW_IGNORABLE_FILE_PATTERN
} = require('./constants');
const { isIgnorableEntry, listSubdirectories } = require('./directoryManager');

const isSeasonIgnorable = (name) => isIgnorableEntry(name) || TV_SEASON_IGNORABLE_FILE_PATTERN.test(name);
const isShowIgnorable = (name) => isIgnorableEntry(name) || TV_SHOW_IGNORABLE_FILE_PATTERN.test(name);

/**
 * Find the library folder a path lives in.
 *
 * @param {string} targetPath - A path inside baseDir
 * @param {string} baseDir - The downloads folder
 * @returns {{libraryFolder: string, libraryRoot: string}|null} - libraryFolder is
 *   '' for the main folder, else the subfolder name without the __ prefix; null
 *   when the path is baseDir itself, a subfolder itself, or outside baseDir
 */
function resolveLibraryFolder(targetPath, baseDir) {
  if (!targetPath || !baseDir) {
    return null;
  }
  const root = path.resolve(baseDir);
  const relativePath = path.relative(root, path.resolve(targetPath));
  if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return null;
  }
  const [firstSegment, ...rest] = relativePath.split(path.sep);
  if (!firstSegment.startsWith(SUBFOLDER_PREFIX)) {
    return { libraryFolder: MAIN_LIBRARY_FOLDER, libraryRoot: root };
  }
  if (rest.length === 0) {
    return null;
  }
  return {
    libraryFolder: firstSegment.slice(SUBFOLDER_PREFIX.length),
    libraryRoot: path.join(root, firstSegment)
  };
}

/**
 * Locate the season and show folders of an episode file. The file must sit
 * directly in a season folder of a show folder of the library root; show
 * folders never start with "__" (those are library folders) or ".".
 *
 * @param {string} filePath - Episode file path
 * @param {string} libraryRoot - The TV library folder holding the show
 * @returns {{showDir: string, seasonDir: string}|null}
 */
function locateEpisodeFolders(filePath, libraryRoot) {
  if (!filePath || !libraryRoot) {
    return null;
  }
  const root = path.resolve(libraryRoot);
  const seasonDir = path.dirname(path.resolve(filePath));
  const relativePath = path.relative(root, seasonDir);
  if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return null;
  }
  const segments = relativePath.split(path.sep);
  if (segments.length !== 2) {
    return null;
  }
  const [showName, seasonName] = segments;
  if (showName.startsWith(SUBFOLDER_PREFIX) || showName.startsWith('.') || !SEASON_FOLDER_PATTERN.test(seasonName)) {
    return null;
  }
  return { showDir: path.join(root, showName), seasonDir };
}

/**
 * Remove a directory when it holds no subdirectories and only files the
 * predicate accepts, deleting those files first. The second listing is
 * filtered again so a real file appearing between the two reads is kept.
 * A folder that cannot be read is skipped quietly; a failure after files
 * were deleted is a warning, because the folder is left without them.
 *
 * @param {string} dirPath - Directory to remove
 * @param {(name: string) => boolean} isRemovable - Files that may be deleted
 * @returns {Promise<boolean>} - True if the directory was removed
 */
async function removeIfOnlyRemovableFiles(dirPath, isRemovable) {
  const deleted = [];
  try {
    const entries = await fsPromises.readdir(dirPath, { withFileTypes: true });
    if (entries.some((entry) => entry.isDirectory() || !isRemovable(entry.name))) {
      return false;
    }
    for (const name of await fsPromises.readdir(dirPath)) {
      if (!isRemovable(name)) {
        continue;
      }
      try {
        await fsPromises.unlink(path.join(dirPath, name));
        deleted.push(name);
      } catch (unlinkErr) {
        if (unlinkErr.code !== 'ENOENT') {
          throw unlinkErr;
        }
      }
    }
    await fsPromises.rmdir(dirPath);
    logger.info({ dirPath }, 'Removed empty TV folder');
    return true;
  } catch (error) {
    if (deleted.length > 0) {
      logger.warn({ err: error, dirPath, deleted }, 'Deleted metadata from a TV folder but could not remove the folder');
    } else if (error.code !== 'ENOENT') {
      logger.debug({ err: error, dirPath }, 'Could not remove TV folder');
    }
    return false;
  }
}

/**
 * After an episode's files are deleted: remove its season folder once only
 * season metadata and art remain, then the show folder once it has no
 * folders left and only show metadata and art remain.
 *
 * @param {{showDir: string, seasonDir: string}} folders - From locateEpisodeFolders
 * @returns {Promise<{removedSeason: boolean, removedShow: boolean}>}
 */
async function cleanupEmptyShowFolders({ showDir, seasonDir }) {
  const removedSeason = await removeIfOnlyRemovableFiles(seasonDir, isSeasonIgnorable);
  if (!removedSeason) {
    return { removedSeason, removedShow: false };
  }
  const removedShow = await removeIfOnlyRemovableFiles(showDir, isShowIgnorable);
  return { removedSeason, removedShow };
}

/**
 * Sweep one show folder: remove its empty season folders, then the show
 * folder itself if nothing but show metadata and art is left. Folders that
 * are not season folders are never removed and keep the show alive. Like the
 * channel folder cleanup, a folder that cannot be listed (lost+found, a NAS
 * recycle bin) is skipped rather than ending the sweep.
 *
 * @param {string} showDir - A show folder directly inside a TV library folder
 * @returns {Promise<string[]>} - Removed directories
 */
async function cleanupOrphanShowFolder(showDir) {
  let childDirs;
  try {
    childDirs = await listSubdirectories(showDir);
  } catch (error) {
    logger.debug({ err: error, showDir }, 'Could not list TV show folder, skipping it');
    return [];
  }
  const removed = [];
  for (const childDir of childDirs) {
    if (SEASON_FOLDER_PATTERN.test(path.basename(childDir))
      && await removeIfOnlyRemovableFiles(childDir, isSeasonIgnorable)) {
      removed.push(childDir);
    }
  }
  if (await removeIfOnlyRemovableFiles(showDir, isShowIgnorable)) {
    removed.push(showDir);
  }
  return removed;
}

module.exports = {
  resolveLibraryFolder,
  locateEpisodeFolders,
  cleanupEmptyShowFolders,
  cleanupOrphanShowFolder
};
