/**
 * The settings change a reorganize was approved for. It is applied when the
 * operation starts, not when it ends: download jobs are held either way, but
 * admission then already sees the new layout (TV folders are video-only),
 * Channel Settings shows it, and the shows have to be pinned before files
 * move into them. Applying is safe to repeat (a restart resumes it), and it
 * is undone when no video could be moved.
 */

const configModule = require('../configModule');
const subfolderModule = require('../subfolderModule');
const m3uGenerator = require('../m3uGenerator');
const logger = require('../../logger');
const Channel = require('../../models/channel');
const TvShow = require('../../models/tvshow');
const showStore = require('../tvShows/showStore');
const libraryLayouts = require('../tvShows/libraryLayouts');
const layoutGuards = require('../tvShows/layoutGuards');
const channelLayout = require('../tvShows/channelLayout');
const { syncPlexIgnore } = require('../tvShows/libraryFolders');
const { LAYOUT_TV, folderKey } = require('../tvShows/constants');
const { SHOW_ACTION } = require('./showPlanner');
const { libraryFolderOf } = require('./changeContext');
const { CHANGE_CHANNEL, CHANGE_FOLDER_LAYOUT, CHANGE_DEFAULT_SUBFOLDER } = require('./constants');

function sameLocation(show, planned) {
  return folderKey(show.library_folder) === folderKey(planned.libraryFolder)
    && show.folder_name.toLowerCase() === planned.folderName.toLowerCase();
}

async function pinShow(planned) {
  if (planned.action === SHOW_ACTION.KEEP) return { ...planned };
  // Also reached again after a restart: the show may already be in place.
  const existing = planned.showId
    ? await TvShow.findByPk(planned.showId)
    : await showStore.findChannelShow(planned.ownerChannelId);
  let show;
  if (!existing) {
    show = await showStore.createChannelShowAt({
      channelId: planned.ownerChannelId,
      name: planned.name,
      folderName: planned.folderName,
      libraryFolder: planned.libraryFolder,
      previousVideosFolder: planned.previousVideosFolder || null,
    });
  } else {
    show = sameLocation(existing, planned) ? existing : await showStore.moveShowTo(existing, planned);
    if (planned.previousVideosFolder) await show.update({ previous_videos_folder: planned.previousVideosFolder });
  }
  return { ...planned, showId: show.id };
}

// Channels whose files move to TV lose their channel .m3u (TV channels have
// none). Removed before the change, while its path still resolves.
async function removeChannelPlaylists(channelIds) {
  for (const channelId of channelIds) {
    try {
      await m3uGenerator.deleteChannelM3U(channelId);
    } catch (err) {
      logger.warn({ err, channelId }, 'Could not remove the channel .m3u before reorganizing');
    }
  }
}

function setDefaultSubfolder(value) {
  configModule.updateConfig({ ...configModule.getConfig(), defaultSubfolder: value || '' });
}

async function setFolderLayout(folder, layout) {
  if (folder) await subfolderModule.register(folder);
  await libraryLayouts.setLayout(folder, layout);
  if (!folder) {
    try {
      await syncPlexIgnore(layout);
    } catch (err) {
      logger.error({ err }, 'Could not update the main folder .plexignore');
    }
  }
}

/**
 * Apply the change and pin its shows.
 *
 * @param {Object} params
 * @param {Object} params.change - The stored (normalized) change
 * @param {Array<Object>} params.shows - Planned shows
 * @param {(libraryFolder: string) => string} params.layoutBefore - Layouts before the change
 * @returns {Promise<Array<Object>>} The shows with their ids
 */
async function applySettings({ change, shows, layoutBefore }) {
  const pinned = [];
  for (const planned of shows) pinned.push(await pinShow(planned));

  if (change.type === CHANGE_CHANNEL) {
    const channel = await Channel.findOne({ where: { channel_id: change.channelId } });
    if (!channel) throw new Error('The channel no longer exists.');
    const defaultFolder = configModule.getDefaultSubfolder();
    const fromFolder = libraryFolderOf(change.previousSubFolder, defaultFolder);
    const toFolder = libraryFolderOf(change.subFolder, defaultFolder);
    if (layoutBefore(toFolder) === LAYOUT_TV) await removeChannelPlaylists([change.channelId]);
    await channel.update({ sub_folder: change.subFolder });
    await subfolderModule.register(change.subFolder);
    // Gives a channel with nothing to move its show too, and records the
    // Videos folder it left; a no-op for a show pinned above.
    await channelLayout.applyChannelFolderChange({
      channel,
      previousSubFolder: change.previousSubFolder,
      change: { oldLayout: layoutBefore(fromFolder), newLayout: layoutBefore(toFolder), newFolder: toFolder },
    });
  } else if (change.type === CHANGE_FOLDER_LAYOUT) {
    if (change.layout === LAYOUT_TV) {
      const users = await layoutGuards.usersOfFolder(change.folder);
      await removeChannelPlaylists(users.channels.map((channel) => channel.channel_id));
    }
    await setFolderLayout(change.folder, change.layout);
  } else if (change.type === CHANGE_DEFAULT_SUBFOLDER) {
    if (layoutBefore(change.value) === LAYOUT_TV) {
      const users = await layoutGuards.usersOfGlobalDefault();
      await removeChannelPlaylists(users.channels.map((channel) => channel.channel_id));
    }
    await subfolderModule.register(change.value);
    setDefaultSubfolder(change.value);
  }
  return pinned;
}

/**
 * Undo the change after no video could be moved. Shows that were moved go
 * back; new shows stay (a show without episodes only pins a location).
 *
 * @param {Object} params
 * @param {Object} params.change
 * @param {Array<Object>} params.shows - Pinned shows
 */
async function rollbackSettings({ change, shows }) {
  for (const show of shows) {
    if (show.action !== SHOW_ACTION.MOVE || !show.previousLocation || !show.showId) continue;
    const row = await TvShow.findByPk(show.showId);
    if (row) await showStore.moveShowTo(row, show.previousLocation);
  }
  if (change.type === CHANGE_CHANNEL) {
    await Channel.update({ sub_folder: change.previousSubFolder }, { where: { channel_id: change.channelId } });
  } else if (change.type === CHANGE_FOLDER_LAYOUT) {
    await setFolderLayout(change.folder, change.previousLayout);
  } else if (change.type === CHANGE_DEFAULT_SUBFOLDER) {
    setDefaultSubfolder(change.previousValue);
  }
}

module.exports = {
  applySettings,
  rollbackSettings
};
