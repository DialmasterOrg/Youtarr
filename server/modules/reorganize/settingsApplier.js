/**
 * The settings change a reorganize was approved for. It is applied when the
 * operation starts, not when it ends: download jobs are held either way, but
 * admission then already sees the new layout (TV folders are video-only),
 * Channel Settings shows it, and the shows have to be pinned before files
 * move into them. Applying is safe to repeat (a restart resumes it), and it
 * is undone when no video could be moved.
 */

const path = require('path');
const { Op } = require('sequelize');
const configModule = require('../configModule');
const subfolderModule = require('../subfolderModule');
const m3uGenerator = require('../m3uGenerator');
const logger = require('../../logger');
const { sequelize } = require('../../db');
const Channel = require('../../models/channel');
const Playlist = require('../../models/playlist');
const { buildSubfolderSegment, ensureDir } = require('../filesystem');
const { ROOT_SENTINEL } = require('../filesystem/constants');
const TvShow = require('../../models/tvshow');
const showStore = require('../tvShows/showStore');
const libraryLayouts = require('../tvShows/libraryLayouts');
const layoutGuards = require('../tvShows/layoutGuards');
const channelLayout = require('../tvShows/channelLayout');
const { syncPlexIgnore } = require('../tvShows/libraryFolders');
const titleShowSaver = require('../tvShows/titleShowSaver');
const { LAYOUT_TV, LAYOUT_VIDEOS, folderKey, KIND_TITLE_SHOW } = require('../tvShows/constants');
const { SHOW_ACTION } = require('./showPlanner');
const { libraryFolderOf } = require('./changeContext');
const { restoreTitleSnapshot } = require('./titleSnapshot');
const {
  CHANGE_CHANNEL, CHANGE_FOLDER_LAYOUT, CHANGE_DEFAULT_SUBFOLDER, CHANGE_TITLE_SHOWS, CHANGE_MAIN_FOLDER_MOVE,
} = require('./constants');

function sameLocation(show, planned) {
  return folderKey(show.library_folder) === folderKey(planned.libraryFolder)
    && show.folder_name.toLowerCase() === planned.folderName.toLowerCase();
}

async function pinShow(planned) {
  // Title shows are saved with the rest of a title show change.
  if (planned.action === SHOW_ACTION.KEEP || planned.kind === KIND_TITLE_SHOW) return { ...planned };
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

// A row that still names the main folder itself: null, '' or ##ROOT##.
function namesMainFolderWhere(column) {
  return { [Op.or]: [{ [column]: null }, { [column]: ['', ROOT_SENTINEL] }] };
}

// Each row only while it still names the main folder: an edit made since the
// preview stays.
async function switchMainFolderRows(change, transaction) {
  const channelIds = change.channels.map((entry) => entry.channelId);
  if (channelIds.length > 0) {
    await Channel.update({ sub_folder: change.folder },
      { where: { channel_id: channelIds, ...namesMainFolderWhere('sub_folder') }, transaction });
  }
  const playlistIds = change.playlists.map((entry) => entry.playlistId);
  if (playlistIds.length > 0) {
    await Playlist.update({ default_sub_folder: change.folder },
      { where: { playlist_id: playlistIds, ...namesMainFolderWhere('default_sub_folder') }, transaction });
  }
}

// Each row only while it still holds the target folder: an edit made during
// the move stays.
async function restoreMainFolderRows(change, transaction) {
  for (const entry of change.channels) {
    await Channel.update({ sub_folder: entry.previous }, { where: { channel_id: entry.channelId, sub_folder: change.folder }, transaction });
  }
  for (const entry of change.playlists) {
    await Playlist.update({ default_sub_folder: entry.previous },
      { where: { playlist_id: entry.playlistId, default_sub_folder: change.folder }, transaction });
  }
}

// updateConfig assigns the new config before writing it, so a failed write
// leaves the new value in memory: the previous object goes back.
function setDefaultSubfolderOrRestore(value) {
  const before = configModule.getConfig();
  try {
    configModule.updateConfig({ ...before, defaultSubfolder: value || '' });
  } catch (err) {
    configModule.config = before;
    throw err;
  }
}

// Repeats safely (a restart replays it), and leaves nothing half-switched when it throws.
async function applyMainFolderMove(change) {
  await subfolderModule.register(change.folder, { layout: LAYOUT_VIDEOS, throwOnError: true });
  // On disk before any file arrives, so a library can point at it even when nothing moves.
  await ensureDir(path.join(configModule.directoryPath, buildSubfolderSegment(change.folder)));
  // The .m3u of a channel leaving the main folder, removed while its path still resolves there;
  // followUp writes it again where the videos land.
  const followers = change.previousDefault ? [] : (await layoutGuards.usersOfGlobalDefault()).channels.map((channel) => channel.channel_id);
  await removeChannelPlaylists([...change.channels.map((entry) => entry.channelId), ...followers]);
  await sequelize.transaction((transaction) => switchMainFolderRows(change, transaction));
  if (change.previousDefault) return;
  try {
    setDefaultSubfolderOrRestore(change.folder);
  } catch (err) {
    try {
      await sequelize.transaction((transaction) => restoreMainFolderRows(change, transaction));
    } catch (restoreErr) {
      logger.error({ err: restoreErr, originalError: err.message },
        'Could not restore the channel and playlist folders after the default folder could not be saved');
    }
    throw err;
  }
}

// Written again where the videos still are, after the rows and the default went back.
async function regenerateChannelPlaylists(channelIds) {
  for (const channelId of channelIds) {
    try {
      await m3uGenerator.generateChannelM3U(channelId);
    } catch (err) {
      logger.warn({ err, channelId }, 'Could not write the channel .m3u again after a rolled-back reorganize');
    }
  }
}

async function rollbackMainFolderMove(change) {
  await sequelize.transaction((transaction) => restoreMainFolderRows(change, transaction));
  // The default goes back only while it is still the target folder.
  if (!change.previousDefault && folderKey(configModule.getDefaultSubfolder() || '') === folderKey(change.folder)) {
    setDefaultSubfolderOrRestore('');
  }
  // The channel playlists applyMainFolderMove removed.
  const followers = change.previousDefault ? [] : (await layoutGuards.usersOfGlobalDefault()).channels.map((channel) => channel.channel_id);
  await regenerateChannelPlaylists([...change.channels.map((entry) => entry.channelId), ...followers]);
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

async function findChannelOrFail(channelId) {
  const channel = await Channel.findOne({ where: { channel_id: channelId } });
  if (!channel) throw new Error('The channel no longer exists.');
  return channel;
}

// A title show change: the channel's shows and every episode row as planned
// (the plan is recomputed: the lock is held, so it is the one previewed).
// It is recorded as applied in the same transaction: a restart between the
// two would replay it, and its new shows would then hold their own folders.
async function applyTitleShows(change, pinned, markApplied) {
  const channel = await findChannelOrFail(change.channelId);
  const { drafts, plan } = await titleShowSaver.prepare({ channel, rawShows: change.shows, rawOverrides: change.overrides || [] });
  const withIds = ({ showIds }) => pinned.map((show) => (
    show.kind === KIND_TITLE_SHOW ? { ...show, showId: showIds.get(show.key) || show.showId } : show
  ));
  const saved = await titleShowSaver.applyPrepared({
    channel,
    drafts,
    plan,
    onWritten: markApplied ? (result, transaction) => markApplied(withIds(result), transaction) : null,
  });
  return withIds(saved);
}

/**
 * Apply the change and pin its shows.
 *
 * @param {Object} params
 * @param {Object} params.change - The stored (normalized) change
 * @param {Array<Object>} params.shows - Planned shows
 * @param {(libraryFolder: string) => string} params.layoutBefore - Layouts before the change
 * @param {(shows: Array<Object>, transaction?: Object) => Promise<void>} [params.markApplied] - Records
 *   the change as applied (an operation's); a title show change calls it inside its write transaction
 * @returns {Promise<Array<Object>>} The shows with their ids
 */
async function applySettings({ change, shows, layoutBefore, markApplied = null }) {
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
  } else if (change.type === CHANGE_TITLE_SHOWS) {
    return applyTitleShows(change, pinned, markApplied);
  } else if (change.type === CHANGE_MAIN_FOLDER_MOVE) {
    await applyMainFolderMove(change);
  }
  if (markApplied) await markApplied(pinned);
  return pinned;
}

/**
 * Undo the change after no video could be moved. Shows that were moved go
 * back; new shows stay (a show without episodes only pins a location).
 *
 * @param {Object} params
 * @param {Object} params.change
 * @param {Array<Object>} params.shows - Pinned shows
 * @param {Object} [params.snapshot] - A title show change's shows and episodes before it
 */
async function rollbackSettings({ change, shows, snapshot = null }) {
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
  } else if (change.type === CHANGE_TITLE_SHOWS && snapshot) {
    await restoreTitleSnapshot(await findChannelOrFail(change.channelId), snapshot);
  } else if (change.type === CHANGE_MAIN_FOLDER_MOVE) {
    await rollbackMainFolderMove(change);
  }
}

module.exports = {
  applySettings,
  rollbackSettings
};
