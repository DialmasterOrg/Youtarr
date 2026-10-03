/**
 * Library folders as Settings shows them: the main downloads folder and each
 * __subfolder, with its layout and what uses it. Changing a folder's layout,
 * or moving the default subfolder to a folder with another layout, changes
 * the layout of every channel that downloads there, so both are refused
 * while that would leave a folder with videos of the old layout.
 */

const fs = require('fs');
const path = require('path');
const configModule = require('../configModule');
const subfolderModule = require('../subfolderModule');
const logger = require('../../logger');
const Channel = require('../../models/channel');
const { LAYOUT_TV, LAYOUT_VIDEOS, folderKey } = require('./constants');
const libraryLayouts = require('./libraryLayouts');
const layoutGuards = require('./layoutGuards');
const { effectiveLibraryFolder } = require('./channelFolders');

const LAYOUTS = new Set([LAYOUT_VIDEOS, LAYOUT_TV]);
// Main folder as TV: a Plex TV library pointed there skips the subfolders.
const PLEXIGNORE_NAME = '.plexignore';
const PLEXIGNORE_SUBFOLDER_RULE = '__*/*';
const PLEXIGNORE_CONTENT = `${PLEXIGNORE_SUBFOLDER_RULE}\n`;

const MESSAGES = {
  running: 'Wait for the current download to finish before changing a folder\'s layout.',
  hasFiles: 'This folder already holds downloaded videos, so its layout can\'t change yet.',
  defaultRunning: 'Wait for the current download to finish before switching the default subfolder to a folder '
    + 'with a different layout.',
  defaultHasDownloads: 'Channels that use the default subfolder already have downloaded videos, so the default can\'t '
    + 'switch to a folder with a different layout yet.',
};

/**
 * @returns {Promise<Array<{name: string, layout: string, isDefault: boolean, hasFiles: boolean, channels: number}>>}
 *   name '' is the main folder, listed first
 */
async function listLibraryFolders() {
  const [layoutOf, usage, channels] = await Promise.all([
    libraryLayouts.getLayoutResolver(),
    subfolderModule.getUsage(),
    Channel.findAll({ where: { enabled: true }, attributes: ['sub_folder'] }),
  ]);
  const channelCounts = new Map();
  for (const channel of channels) {
    const key = folderKey(effectiveLibraryFolder(channel.sub_folder));
    channelCounts.set(key, (channelCounts.get(key) || 0) + 1);
  }
  const defaultFolder = configModule.getDefaultSubfolder() || '';
  const main = {
    name: '',
    layout: layoutOf(''),
    isDefault: !defaultFolder,
    hasFiles: await layoutGuards.folderHasFiles(''),
    channels: channelCounts.get('') || 0,
  };
  const subfolders = usage.map((item) => ({
    name: item.name,
    layout: layoutOf(item.name),
    isDefault: item.usage.isDefault,
    hasFiles: item.usage.hasFiles,
    channels: channelCounts.get(folderKey(item.name)) || 0,
  }));
  return [main, ...subfolders];
}

async function syncPlexIgnore(layout) {
  const filePath = path.join(configModule.directoryPath, PLEXIGNORE_NAME);
  let current = null;
  try {
    current = await fs.promises.readFile(filePath, 'utf8');
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  if (layout === LAYOUT_TV) {
    if (current === null) {
      await fs.promises.writeFile(filePath, PLEXIGNORE_CONTENT, 'utf8');
    } else if (!current.split(/\r?\n/).some((line) => line.trim() === PLEXIGNORE_SUBFOLDER_RULE)) {
      const separator = current === '' || current.endsWith('\n') ? '' : '\n';
      await fs.promises.writeFile(filePath, `${current}${separator}${PLEXIGNORE_CONTENT}`, 'utf8');
    }
  } else if (current === PLEXIGNORE_CONTENT) {
    // Only a file exactly as Youtarr wrote it; the user's own rules stay.
    await fs.promises.unlink(filePath);
  }
}

/**
 * Change a library folder's layout.
 * @param {string} name - '' for the main folder, else the subfolder name without __
 * @param {string} layout - 'videos' | 'tv'
 * @param {Object} [options]
 * @param {() => boolean} [options.isDownloadRunning]
 * @returns {Promise<{changed: boolean}>}
 */
async function setFolderLayout(name, layout, { isDownloadRunning } = {}) {
  if (!LAYOUTS.has(layout)) {
    throw layoutGuards.guardError('layout must be "videos" or "tv"', 400);
  }
  const folder = String(name || '').trim();
  if (folder) {
    const known = (await subfolderModule.getAll())
      .some((display) => folderKey(display.replace(/^__/, '')) === folderKey(folder));
    if (!known) throw layoutGuards.guardError('Subfolder not found', 404);
  }
  const layoutOf = await libraryLayouts.getLayoutResolver();
  if (layoutOf(folder) === layout) return { changed: false };

  layoutGuards.assertNoDownloadRunning(isDownloadRunning, MESSAGES.running);
  const users = await layoutGuards.usersOfFolder(folder);
  if (layout === LAYOUT_TV) layoutGuards.assertNoMp3Users(users, 'this folder');
  if (await layoutGuards.folderHasFiles(folder)) {
    throw layoutGuards.guardError(MESSAGES.hasFiles, 409);
  }
  await layoutGuards.assertChannelsHaveNoDownloads(users.channels, MESSAGES.hasFiles);

  // A subfolder known only from config (the default subfolder, Plex mappings)
  // gets its row before the layout is stored on it.
  if (folder) await subfolderModule.register(folder);
  await libraryLayouts.setLayout(folder, layout);
  logger.info({ libraryFolder: folder, layout }, 'Library folder layout changed');
  if (!folder) {
    try {
      await syncPlexIgnore(layout);
    } catch (err) {
      logger.error({ err }, 'Could not update the main folder .plexignore');
    }
  }
  return { changed: true };
}

/**
 * Refuse a default subfolder change that would switch the channels and
 * playlists following the default between videos and TV while that can't
 * be done cleanly.
 *
 * @param {Object} params
 * @param {string|null} params.oldDefault
 * @param {string|null} params.newDefault
 * @param {() => boolean} [params.isDownloadRunning]
 */
async function checkDefaultSubfolderChange({ oldDefault, newDefault, isDownloadRunning }) {
  const layoutOf = await libraryLayouts.getLayoutResolver();
  const newLayout = layoutOf(String(newDefault || '').trim());
  if (layoutOf(String(oldDefault || '').trim()) === newLayout) return;

  const users = await layoutGuards.usersOfGlobalDefault();
  if (newLayout === LAYOUT_TV) layoutGuards.assertNoMp3Users(users, 'the default subfolder');
  layoutGuards.assertNoDownloadRunning(isDownloadRunning, MESSAGES.defaultRunning);
  await layoutGuards.assertChannelsHaveNoDownloads(users.channels, MESSAGES.defaultHasDownloads);
}

module.exports = {
  PLEXIGNORE_NAME,
  PLEXIGNORE_CONTENT,
  MESSAGES,
  listLibraryFolders,
  setFolderLayout,
  checkDefaultSubfolderChange
};
