/**
 * What uses each library folder, for the Library folders page and the Core
 * card (GET /api/library-folders?include=usage,files): the enabled channels
 * that chose the folder or follow the default into it, its playlists and
 * title shows, whether a layout change or a default switch goes through the
 * reorganize (the rules setFolderLayout and checkDefaultSubfolderChange
 * apply, disabled channels included), the Plex refresh mapping, every reason
 * a delete is refused, and how many downloaded videos sit in the folder.
 */

const Channel = require('../../models/channel');
const Playlist = require('../../models/playlist');
const TvShow = require('../../models/tvshow');
const Video = require('../../models/video');
const configModule = require('../configModule');
const subfolderModule = require('../subfolderModule');
const { GLOBAL_DEFAULT_SENTINEL, ROOT_SENTINEL } = require('../filesystem/constants');
const { resolveLibraryFolder } = require('../filesystem/showFolderCleanup');
const { readMappings, mappingOf } = require('../mediaServers/plexMappingEntries');
const { folderKey, KIND_TITLE_SHOW } = require('./constants');
const { effectiveLibraryFolder } = require('./channelFolders');
const { getLayoutResolver } = require('./libraryLayouts');
const layoutGuards = require('./layoutGuards');

/**
 * The folder a sub_folder value names: '' for the main folder, null for a
 * value that follows the default folder.
 * @param {string|null} subFolderValue
 * @returns {string|null}
 */
function chosenFolderOf(subFolderValue) {
  if (subFolderValue === GLOBAL_DEFAULT_SENTINEL) return null;
  if (subFolderValue === ROOT_SENTINEL || typeof subFolderValue !== 'string') return '';
  return subFolderValue.trim();
}

function choosesFolder(subFolderValue, key) {
  const chosen = chosenFolderOf(subFolderValue);
  return chosen !== null && folderKey(chosen) === key;
}

async function loadUsageData() {
  const [channels, playlists, titleShows, numberedShows, withDownloads, layoutOf] = await Promise.all([
    Channel.findAll({ attributes: ['channel_id', 'sub_folder', 'enabled'], raw: true }),
    Playlist.findAll({ attributes: ['default_sub_folder', 'enabled'], raw: true }),
    TvShow.findAll({ where: { kind: KIND_TITLE_SHOW, retired_at: null }, attributes: ['library_folder'], raw: true }),
    subfolderModule.numberedShowCounts(),
    layoutGuards.channelIdsWithDownloads(),
    getLayoutResolver(),
  ]);
  return {
    channels,
    playlists,
    titleShows,
    numberedShows,
    withDownloads,
    layoutOf,
    defaultFolder: configModule.getDefaultSubfolder() || '',
    mappings: readMappings(configModule.getConfig()),
  };
}

function usageFields(folder, data) {
  const key = folderKey(folder.name);
  const isDefaultFolder = key === folderKey(data.defaultFolder);
  const hasDownloads = (channel) => data.withDownloads.has(channel.channel_id);
  const choosers = data.channels.filter((channel) => choosesFolder(channel.sub_folder, key));
  const channelsChosen = choosers.filter((channel) => channel.enabled).length;
  const followers = data.channels.filter((channel) => channel.sub_folder === GLOBAL_DEFAULT_SENTINEL);
  const users = data.channels.filter((channel) => folderKey(effectiveLibraryFolder(channel.sub_folder)) === key);
  const deleteBlockers = folder.name
    ? subfolderModule.deletionBlockers({
      channels: channelsChosen,
      disabledChannels: choosers.length - channelsChosen,
      playlists: data.playlists.filter((playlist) => choosesFolder(playlist.default_sub_folder, key)).length,
      shows: data.numberedShows.get(key) || 0,
      isDefault: folder.isDefault,
      hasFiles: folder.hasFiles,
    })
    : [{ code: 'main' }];
  return {
    channelsChosen,
    channelsFollowing: isDefaultFolder ? followers.filter((channel) => channel.enabled).length : 0,
    playlists: data.playlists.filter((playlist) => playlist.enabled
      && folderKey(effectiveLibraryFolder(playlist.default_sub_folder)) === key).length,
    titleShows: data.titleShows.filter((show) => folderKey(show.library_folder) === key).length,
    layoutChangeNeedsReview: Boolean(folder.hasFiles) || users.some(hasDownloads),
    makeDefaultNeedsReview: !isDefaultFolder
      && data.layoutOf(folder.name) !== data.layoutOf(data.defaultFolder)
      && followers.some(hasDownloads),
    plexMapping: mappingOf(data.mappings, folder.name),
    deleteBlockers,
    deletable: deleteBlockers.length === 0,
  };
}

// One scan of the videos table (no index on filePath), bucketed here.
async function countFilesByFolder() {
  const videos = await Video.findAll({ where: { removed: false }, attributes: ['filePath', 'audioFilePath'], raw: true });
  const counts = new Map();
  for (const video of videos) {
    const located = resolveLibraryFolder(video.filePath || video.audioFilePath, configModule.directoryPath);
    if (!located) continue;
    const key = folderKey(located.libraryFolder);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

/**
 * @param {Array<Object>} folders - listLibraryFolders() entries
 * @param {{usage?: boolean, files?: boolean}} include
 * @returns {Promise<Array<Object>>}
 */
async function describeUsage(folders, { usage = false, files = false } = {}) {
  if (!usage && !files) return folders;
  const [data, counts] = await Promise.all([
    usage ? loadUsageData() : null,
    files ? countFilesByFolder() : null,
  ]);
  return folders.map((folder) => ({
    ...folder,
    ...(data ? usageFields(folder, data) : {}),
    ...(counts ? { fileCount: counts.get(folderKey(folder.name)) || 0 } : {}),
  }));
}

module.exports = { chosenFolderOf, describeUsage };
