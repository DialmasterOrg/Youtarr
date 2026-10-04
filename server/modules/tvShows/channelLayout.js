/**
 * A tracked channel's layout is the layout of the folder it downloads to.
 * These functions guard and apply a channel's folder changes (Channel
 * Settings, the TV layout toggle, subscribing with initial settings), work out
 * the folder a layout toggle switches to, and describe a channel's TV state.
 */

const configModule = require('../configModule');
const { GLOBAL_DEFAULT_SENTINEL, ROOT_SENTINEL } = require('../filesystem/constants');
const { cleanupOrphanShowFolder } = require('../filesystem/showFolderCleanup');
const { LAYOUT_TV, LAYOUT_VIDEOS, folderKey } = require('./constants');
const { getLayoutResolver, listTvFolders } = require('./libraryLayouts');
const showStore = require('./showStore');
const { effectiveLibraryFolder, showDirectory } = require('./channelFolders');
const layoutGuards = require('./layoutGuards');
const reorganizeLock = require('../reorganize/reorganizeLock');
const { CHANGE_CHANNEL } = require('../reorganize/constants');

const LAYOUTS = new Set([LAYOUT_VIDEOS, LAYOUT_TV]);

const MESSAGES = {
  mp3: 'TV shows are video-only. Change this channel\'s download type to Video before saving it to a TV folder.',
  running: 'Wait for the current download to finish before switching this channel between Videos and TV.',
  reorganize: 'This channel has downloaded videos, so switching between Videos and TV or to another TV folder '
    + 'moves its files. Review the move first.',
};

// sub_folder value that targets a library folder explicitly.
function subFolderValueFor(libraryFolder) {
  return libraryFolder ? libraryFolder : ROOT_SENTINEL;
}

/**
 * Check a channel settings change before it is saved. Refuses an MP3 download
 * type in a TV folder; a folder change that crosses layouts or moves a show
 * between TV folders goes through the reorganize when the channel has
 * downloads (reorganizeRequired 409) and is refused while a download runs.
 * Any change is refused while a reorganize is moving the channel's files.
 *
 * @param {Object} params
 * @param {Object} params.channel - Current channels row
 * @param {string|null} [params.newSubFolder] - New sub_folder value; undefined when unchanged
 * @param {string|null} [params.newAudioFormat] - New audio_format; undefined when unchanged
 * @param {() => boolean} [params.isDownloadRunning]
 * @returns {Promise<{oldFolder: string, newFolder: string, oldLayout: string, newLayout: string, involvesTv: boolean}>}
 */
async function checkChannelSettingsChange({ channel, newSubFolder, newAudioFormat, isDownloadRunning }) {
  reorganizeLock.assertChannelFree(channel.channel_id);
  const layoutOf = await getLayoutResolver();
  const oldFolder = effectiveLibraryFolder(channel.sub_folder);
  const newFolder = newSubFolder === undefined ? oldFolder : effectiveLibraryFolder(newSubFolder);
  const oldLayout = layoutOf(oldFolder);
  const newLayout = layoutOf(newFolder);
  const change = { oldFolder, newFolder, oldLayout, newLayout, involvesTv: oldLayout === LAYOUT_TV || newLayout === LAYOUT_TV };

  const audioFormat = newAudioFormat === undefined ? channel.audio_format : newAudioFormat;
  if (newLayout === LAYOUT_TV && layoutGuards.isMp3Format(audioFormat)) {
    throw layoutGuards.guardError(MESSAGES.mp3, 400);
  }

  const folderChanged = folderKey(oldFolder) !== folderKey(newFolder);
  if (folderChanged && change.involvesTv) {
    if (await layoutGuards.channelHasDownloads(channel.channel_id)) {
      throw layoutGuards.reorganizeRequiredError(MESSAGES.reorganize, {
        type: CHANGE_CHANNEL, channelId: channel.channel_id, subFolder: newSubFolder === undefined ? null : newSubFolder,
      });
    }
    layoutGuards.assertNoDownloadRunning(isDownloadRunning, MESSAGES.running);
  }
  return change;
}

/**
 * After a checked folder change is saved, give a channel that is now TV its
 * show at the new folder (created, or moved there: the guard allowed the
 * change only because no files exist). The folder it came from is kept so
 * switching back to Videos returns there. A channel leaving TV keeps its show
 * row (its location and numbering) but not the show folder it leaves behind,
 * which holds nothing but tvshow.nfo and art once its episodes are gone.
 *
 * @param {Object} params
 * @param {Object} params.channel - Updated channels row
 * @param {string|null} params.previousSubFolder - sub_folder before the change
 * @param {Object} params.change - checkChannelSettingsChange's result
 */
async function applyChannelFolderChange({ channel, previousSubFolder, change }) {
  if (change.newLayout !== LAYOUT_TV) {
    if (change.oldLayout === LAYOUT_TV) {
      const leftShow = await showStore.findChannelShow(channel.channel_id);
      if (leftShow) await cleanupOrphanShowFolder(showDirectory(leftShow));
    }
    return null;
  }
  // NULL and legacy '' both mean the main folder.
  const previousVideosFolder = change.oldLayout === LAYOUT_VIDEOS
    ? (previousSubFolder === null || previousSubFolder === '' ? ROOT_SENTINEL : previousSubFolder)
    : undefined;

  let show = await showStore.findChannelShow(channel.channel_id);
  if (!show) {
    return showStore.createChannelShow({
      channelId: channel.channel_id,
      name: channel.title || channel.uploader || channel.folder_name,
      folderName: channel.folder_name || channel.title || channel.uploader,
      libraryFolder: change.newFolder,
      previousVideosFolder: previousVideosFolder === undefined ? null : previousVideosFolder,
    });
  }
  if (folderKey(show.library_folder) !== folderKey(change.newFolder)) {
    show = await showStore.relocateChannelShow(show, change.newFolder);
  }
  if (previousVideosFolder !== undefined) {
    await show.update({ previous_videos_folder: previousVideosFolder });
  }
  return show;
}

/**
 * The sub_folder value a layout toggle saves.
 * TV: the chosen folder, else the global default when it is TV, else the
 * only TV folder. Videos: the chosen folder, else the folder the channel left
 * for TV, else the global default when it is a Videos folder.
 *
 * @param {Object} params
 * @param {Object} params.channel - channels row
 * @param {string} params.layout - 'videos' | 'tv'
 * @param {string} [params.folder] - Chosen library folder ('' = main folder)
 * @returns {Promise<string>}
 */
async function resolveLayoutTarget({ channel, layout, folder }) {
  if (!LAYOUTS.has(layout)) {
    throw layoutGuards.guardError('layout must be "videos" or "tv"', 400);
  }
  const layoutOf = await getLayoutResolver();
  const defaultFolder = configModule.getDefaultSubfolder() || '';
  const layoutName = layout === LAYOUT_TV ? 'TV' : 'Videos';

  if (folder !== undefined && folder !== null) {
    const name = String(folder).trim();
    if (layoutOf(name) !== layout) {
      throw layoutGuards.guardError(`${name ? `__${name}` : 'The main folder'} is not a ${layoutName} folder.`, 400);
    }
    return subFolderValueFor(name);
  }

  if (layout === LAYOUT_VIDEOS) {
    const show = await showStore.findChannelShow(channel.channel_id);
    const previous = show ? show.previous_videos_folder : null;
    if (previous && layoutOf(effectiveLibraryFolder(previous)) === LAYOUT_VIDEOS) return previous;
    if (layoutOf(defaultFolder) === LAYOUT_VIDEOS) return GLOBAL_DEFAULT_SENTINEL;
    throw layoutGuards.guardError('Choose a Videos folder.', 400);
  }

  if (layoutOf(defaultFolder) === LAYOUT_TV) return GLOBAL_DEFAULT_SENTINEL;
  const tvFolders = await listTvFolders();
  if (tvFolders.length === 1) return subFolderValueFor(tvFolders[0]);
  throw layoutGuards.guardError(tvFolders.length === 0 ? 'Set up a TV folder first.' : 'Choose a TV folder.', 400);
}

/**
 * A channel's TV state for Channel Settings.
 * @param {Object} channel - channels row
 */
async function getChannelTvState(channel) {
  const layoutOf = await getLayoutResolver();
  const libraryFolder = effectiveLibraryFolder(channel.sub_folder);
  const layout = layoutOf(libraryFolder);
  const [show, tvFolders, hasDownloads] = await Promise.all([
    showStore.findChannelShow(channel.channel_id),
    listTvFolders(),
    layoutGuards.channelHasDownloads(channel.channel_id),
  ]);
  const defaultFolder = configModule.getDefaultSubfolder() || '';
  return {
    layout,
    libraryFolder,
    show: show && layout === LAYOUT_TV
      ? { name: show.name, folderName: show.folder_name, libraryFolder: show.library_folder, path: showDirectory(show) }
      : null,
    tvFolders,
    defaultFolder,
    defaultFolderLayout: layoutOf(defaultFolder),
    hasDownloads,
  };
}

module.exports = {
  MESSAGES,
  checkChannelSettingsChange,
  applyChannelFolderChange,
  resolveLayoutTarget,
  getChannelTvState
};
