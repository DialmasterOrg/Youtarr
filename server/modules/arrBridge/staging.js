// The staging folder: the only place Sonarr and Radarr are ever pointed at.
// They move the file out and delete the folder themselves, so what they get
// is a disposable hardlink, alone in a folder named like the release (they
// find the episode from that name). The library copy is never handed out.
const fs = require('fs');
const path = require('path');
const { ARR_STAGING_DIR_NAME, isValidCategoryName } = require('./arrBridgeConfig');
const { joinClientPath } = require('./clientPaths');
const { isValidReleaseTitle } = require('./releaseNaming');

// A hardlink cannot cross filesystems, and some network shares refuse links.
const COPY_FALLBACK_CODES = new Set(['EXDEV', 'EPERM', 'ENOTSUP', 'EMLINK']);
// Keep media servers that index the downloads folder away from the links:
// they match library items by file name. `.ignore` is read by Jellyfin and
// Emby, `.plexignore` by Plex.
const IGNORE_FILES = ['.ignore', '.plexignore'];
const IGNORE_FILE_CONTENT = '*\n';

/**
 * @param {Object} deps
 * @param {Object} [deps.fsp] - fs.promises
 * @param {Function} deps.getOutputRoot - () => the downloads folder
 * @param {Function} deps.getSettings - () => arrBridgeConfig.readSettings(config)
 * @param {Object} deps.logger
 */
function createStaging({ fsp = fs.promises, getOutputRoot, getSettings, logger }) {
  const stagingRoot = () => path.join(getOutputRoot(), ARR_STAGING_DIR_NAME);

  // Both parts are validated to be single path segments before they are joined.
  function releaseFolder(category, releaseTitle) {
    if (!isValidCategoryName(category)) throw new Error('Invalid staging category');
    if (!isValidReleaseTitle(releaseTitle)) throw new Error('Invalid release title');
    return path.join(stagingRoot(), category, releaseTitle);
  }

  /**
   * The category folders must exist as soon as the bridge is on: Radarr
   * raises a health error for a download folder that is missing.
   */
  async function ensureCategoryFolders() {
    const root = stagingRoot();
    await fsp.mkdir(root, { recursive: true });
    for (const { name } of getSettings().categories) {
      await fsp.mkdir(path.join(root, name), { recursive: true });
    }
    for (const file of IGNORE_FILES) {
      try {
        await fsp.writeFile(path.join(root, file), IGNORE_FILE_CONTENT, { flag: 'wx' });
      } catch (error) {
        if (error.code !== 'EEXIST') throw error;
      }
    }
  }

  /**
   * @param {Object} target
   * @param {string} target.category
   * @param {string} target.releaseTitle
   * @param {string} target.sourcePath - The library file
   * @returns {Promise<{stagedPath: string, bytes: number, method: 'hardlink'|'copy'}>}
   */
  async function stage({ category, releaseTitle, sourcePath }) {
    const folder = releaseFolder(category, releaseTitle);
    const { size } = await fsp.stat(sourcePath);
    const stagedPath = path.join(folder, `${releaseTitle}${path.extname(sourcePath)}`);
    await fsp.rm(folder, { recursive: true, force: true });
    await fsp.mkdir(folder, { recursive: true });
    try {
      let method = 'hardlink';
      try {
        await fsp.link(sourcePath, stagedPath);
      } catch (error) {
        if (!COPY_FALLBACK_CODES.has(error.code)) throw error;
        logger.warn(
          { err: error, category, releaseTitle },
          'Could not hardlink into the Sonarr/Radarr staging folder; copying the file instead'
        );
        await fsp.copyFile(sourcePath, stagedPath);
        method = 'copy';
      }
      return { stagedPath, bytes: size, method };
    } catch (error) {
      await fsp.rm(folder, { recursive: true, force: true });
      throw error;
    }
  }

  async function remove({ category, releaseTitle }) {
    await fsp.rm(releaseFolder(category, releaseTitle), { recursive: true, force: true });
  }

  /**
   * @param {string} localPath - A path under the staging root
   * @returns {string} The same path as Sonarr and Radarr see it
   */
  function clientPath(localPath) {
    const { stagingPath } = getSettings();
    const root = stagingRoot();
    if (!stagingPath) return localPath;
    if (localPath === root) return stagingPath;
    if (!localPath.startsWith(`${root}${path.sep}`)) return localPath;
    // The app's path may be a Windows one, which is written with backslashes.
    return joinClientPath(stagingPath, localPath.slice(root.length + 1).split(path.sep));
  }

  return { stagingRoot, ensureCategoryFolders, stage, remove, clientPath };
}

module.exports = { createStaging };
