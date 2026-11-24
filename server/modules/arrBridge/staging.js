// The staging folder: the only place Sonarr and Radarr are ever pointed at.
// They move the file out and delete the folder themselves, so what they get
// is a disposable hardlink in a folder named like the release (they find the
// episode from that name), with copies of the video's subtitles beside it.
// The library copy is never handed out.
const fs = require('fs');
const path = require('path');
const { ARR_STAGING_DIR_NAME, isValidCategoryName } = require('./arrBridgeConfig');
const { joinClientPath } = require('./clientPaths');
const { isValidReleaseTitle } = require('./releaseNaming');
const { planStagedSubtitles } = require('./stagedSubtitles');

// A hardlink cannot cross filesystems, and some network shares refuse links.
const COPY_FALLBACK_CODES = new Set(['EXDEV', 'EPERM', 'ENOTSUP', 'EMLINK']);
// Keep media servers that index the downloads folder away from the links:
// they match library items by file name. `.ignore` is read by Jellyfin and
// Emby, `.plexignore` by Plex.
const IGNORE_FILES = ['.ignore', '.plexignore'];
const IGNORE_FILE_CONTENT = '*\n';
// How a library subtitle is opened: O_NOFOLLOW refuses a link, O_NONBLOCK
// returns at once for a pipe, which otherwise waits for a writer forever.
// Both are missing on Windows, where neither kind of entry is created this way.
// Read at use, not at load: the server test harnesses load this module with
// a stubbed fs that has no constants.
const subtitleReadFlags = () => fs.constants.O_RDONLY
  | (fs.constants.O_NOFOLLOW || 0)
  | (fs.constants.O_NONBLOCK || 0);
// Far above any real subtitle; a file is read whole to compare and stage it.
const MAX_SUBTITLE_BYTES = 10 * 1024 * 1024;

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

  // The library folder may be a share other people write to, so an entry is
  // not trusted for its name: the file is opened without following a link,
  // without waiting on a pipe, and read only once the open handle shows a
  // regular file of a subtitle's size.
  async function readSubtitle(filePath) {
    const handle = await fsp.open(filePath, subtitleReadFlags());
    try {
      const stats = await handle.stat();
      if (!stats.isFile()) throw new Error('Not a regular file');
      if (stats.size > MAX_SUBTITLE_BYTES) throw new Error('Too large for a subtitle');
      return await handle.readFile();
    } finally {
      await handle.close();
    }
  }

  // The staging folder is shared with the apps. Creating the file exclusively
  // means an entry someone else put at this name is neither written through
  // nor replaced, and only a file created here is removed again on failure.
  async function writeNewFile(filePath, content) {
    const handle = await fsp.open(filePath, 'wx');
    try {
      try {
        await handle.writeFile(content);
      } finally {
        await handle.close();
      }
    } catch (error) {
      await fsp.rm(filePath, { force: true }).catch(() => {});
      throw error;
    }
  }

  // YouTube lists one track under several codes on some videos (en, en-CA and
  // en-GB, byte for byte the same), and the apps would import each as its own
  // numbered English subtitle. Of the tracks given, which share a language,
  // the first with a given text is kept; a track that cannot be read is left
  // out. Each file is read once, and what was compared is what gets staged.
  async function readDistinctSubtitles(libraryFolder, tracks, logContext) {
    const distinct = [];
    for (const track of tracks) {
      let content;
      try {
        content = await readSubtitle(path.join(libraryFolder, track.sourceName));
      } catch (error) {
        logger.warn(
          { err: error, ...logContext, subtitle: track.sourceName },
          'Could not read a subtitle to stage for Sonarr/Radarr; staging the video without it'
        );
        continue;
      }
      if (!distinct.some((kept) => kept.content.equals(content))) {
        distinct.push({ sourceName: track.sourceName, content });
      }
    }
    return distinct;
  }

  // One language's tracks, read, named and written. Their text is held only
  // while this runs: a video can carry a track for every language YouTube
  // translates to, and holding them all at once is memory with no use.
  async function stageLanguage({ folder, libraryFolder, tracks, youtubeId, releaseTitle, logContext }) {
    const distinct = await readDistinctSubtitles(libraryFolder, tracks, logContext);
    const contentBySource = new Map(distinct.map((track) => [track.sourceName, track.content]));
    // Planned again from the tracks that are left, so their numbers have no gaps.
    const planned = planStagedSubtitles({ fileNames: [...contentBySource.keys()], youtubeId, releaseTitle });
    let staged = 0;
    for (const { sourceName, stagedName } of planned) {
      try {
        await writeNewFile(path.join(folder, stagedName), contentBySource.get(sourceName));
        staged += 1;
      } catch (error) {
        logger.warn(
          { err: error, ...logContext, subtitle: sourceName },
          'Could not stage a subtitle for Sonarr/Radarr; staging the video without it'
        );
      }
    }
    return staged;
  }

  // The video's subtitle files, for the apps' "Import Extra Files" setting.
  // Copies, never links: a tool that edits a subtitle in place would write
  // through a link into the library file. Best effort, because the video is
  // what was grabbed: a subtitle that cannot be staged never fails the grab.
  async function stageSubtitles({ folder, category, releaseTitle, sourcePath, youtubeId }) {
    if (!youtubeId) return 0;
    const libraryFolder = path.dirname(sourcePath);
    let fileNames;
    try {
      fileNames = await fsp.readdir(libraryFolder);
    } catch (error) {
      logger.warn(
        { err: error, category, releaseTitle },
        'Could not look for subtitles to stage for Sonarr/Radarr; staging the video without them'
      );
      return 0;
    }
    const tracksByLanguage = new Map();
    for (const track of planStagedSubtitles({ fileNames, youtubeId, releaseTitle })) {
      if (!tracksByLanguage.has(track.language)) tracksByLanguage.set(track.language, []);
      tracksByLanguage.get(track.language).push(track);
    }
    let staged = 0;
    for (const tracks of tracksByLanguage.values()) {
      staged += await stageLanguage({
        folder, libraryFolder, tracks, youtubeId, releaseTitle, logContext: { category, releaseTitle },
      });
    }
    return staged;
  }

  /**
   * @param {Object} target
   * @param {string} target.category
   * @param {string} target.releaseTitle
   * @param {string} target.sourcePath - The library file
   * @param {string} [target.youtubeId] - The video's id; its subtitles are staged too when given
   * @returns {Promise<{stagedPath: string, bytes: number, method: 'hardlink'|'copy', subtitles: number}>}
   */
  async function stage({ category, releaseTitle, sourcePath, youtubeId }) {
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
      const subtitles = await stageSubtitles({ folder, category, releaseTitle, sourcePath, youtubeId });
      return { stagedPath, bytes: size, method, subtitles };
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
