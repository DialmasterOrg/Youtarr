/**
 * A settings change that moves downloaded files, resolved into the world
 * before and after it: which folder each channel downloads to and which
 * layout each library folder has. The planner works out every move from it,
 * and the operation stores its normalized form so a restart can finish it.
 */

const configModule = require('../configModule');
const Channel = require('../../models/channel');
const Playlist = require('../../models/playlist');
const subfolderModule = require('../subfolderModule');
const { validateSubFolderName } = require('../filesystem/subfolderValidation');
const { resolveEffectiveSubfolder } = require('../filesystem/pathBuilder');
const { LAYOUT_TV, LAYOUT_VIDEOS, folderKey, isMp3Format } = require('../tvShows/constants');
const { getLayoutResolver } = require('../tvShows/libraryLayouts');
const layoutGuards = require('../tvShows/layoutGuards');
const libraryFolders = require('../tvShows/libraryFolders');
const { GLOBAL_DEFAULT_SENTINEL, ROOT_SENTINEL } = require('../filesystem/constants');
const channelLayout = require('../tvShows/channelLayout');
const titleShowSaver = require('../tvShows/titleShowSaver');
const {
  CHANGE_CHANNEL,
  CHANGE_CHANNEL_LAYOUT,
  CHANGE_FOLDER_LAYOUT,
  CHANGE_DEFAULT_SUBFOLDER,
  CHANGE_TITLE_SHOWS,
  CHANGE_MAIN_FOLDER_MOVE,
} = require('./constants');

const LAYOUTS = new Set([LAYOUT_VIDEOS, LAYOUT_TV]);
const MAX_VALUE_LENGTH = 255;

function badRequest(message) {
  return layoutGuards.guardError(message, 400);
}

function folderLabel(folder) {
  return folder ? `__${folder}` : 'the main folder';
}

function optionalString(value, name) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || value.length > MAX_VALUE_LENGTH) {
    throw badRequest(`${name} must be a string`);
  }
  return value.trim();
}

function libraryFolderOf(subFolderValue, defaultFolder) {
  return resolveEffectiveSubfolder(subFolderValue, defaultFolder || null) || '';
}

async function findChannel(channelId) {
  if (typeof channelId !== 'string' || !channelId) throw badRequest('channelId is required');
  const channel = await Channel.findOne({ where: { channel_id: channelId } });
  if (!channel) throw layoutGuards.guardError('Channel not found', 404);
  return channel;
}

async function resolveChannelChange(channel, subFolderValue, base) {
  const validation = validateSubFolderName(subFolderValue);
  if (!validation.valid) throw badRequest(validation.error);
  const subFolder = subFolderValue ? subFolderValue : null;
  const fromFolder = libraryFolderOf(channel.sub_folder, base.defaultBefore);
  const toFolder = libraryFolderOf(subFolder, base.defaultBefore);
  if (folderKey(fromFolder) === folderKey(toFolder)) {
    throw badRequest('The channel already downloads to that folder, so nothing needs to move.');
  }
  const fromLayout = base.layoutBefore(fromFolder);
  const toLayout = base.layoutBefore(toFolder);
  if (fromLayout !== LAYOUT_TV && toLayout !== LAYOUT_TV) {
    throw badRequest('Moving a channel between two Videos folders doesn\'t need a reorganize.');
  }
  if (toLayout === LAYOUT_TV && isMp3Format(channel.audio_format)) {
    throw badRequest(channelLayout.MESSAGES.mp3);
  }
  return {
    ...base,
    type: CHANGE_CHANNEL,
    stored: { type: CHANGE_CHANNEL, channelId: channel.channel_id, subFolder, previousSubFolder: channel.sub_folder },
    scope: channel.channel_id,
    label: channel.title || channel.uploader || channel.channel_id,
    channel,
    fromFolder,
    toFolder,
    layoutAfter: base.layoutBefore,
    defaultAfter: base.defaultBefore,
    folderAfter: (row) => (row.channel_id === channel.channel_id
      ? toFolder
      : libraryFolderOf(row.sub_folder, base.defaultBefore)),
  };
}

async function resolveFolderLayoutChange(raw, base) {
  const folder = optionalString(raw.folder, 'folder') || '';
  const layout = raw.layout;
  if (!LAYOUTS.has(layout)) throw badRequest('layout must be "videos" or "tv"');
  if (folder) {
    const known = (await subfolderModule.getAll())
      .some((display) => folderKey(display.replace(/^__/, '')) === folderKey(folder));
    if (!known) throw layoutGuards.guardError('Subfolder not found', 404);
  }
  if (base.layoutBefore(folder) === layout) {
    throw badRequest(`${folderLabel(folder)} already has that layout.`);
  }
  if (layout === LAYOUT_TV) {
    // A TV show folder is added only once nothing is saved in the main folder.
    if (folder) await libraryFolders.assertMainFolderClear();
    layoutGuards.assertNoMp3Users(await layoutGuards.usersOfFolder(folder), 'this folder');
  } else {
    await layoutGuards.assertNoTitleShows(folder);
  }
  const key = folderKey(folder);
  return {
    ...base,
    type: CHANGE_FOLDER_LAYOUT,
    stored: { type: CHANGE_FOLDER_LAYOUT, folder, layout, previousLayout: base.layoutBefore(folder) },
    scope: folder,
    label: folderLabel(folder),
    folder,
    layoutAfter: (libraryFolder) => (folderKey(libraryFolder) === key ? layout : base.layoutBefore(libraryFolder)),
    defaultAfter: base.defaultBefore,
    folderAfter: (row) => libraryFolderOf(row.sub_folder, base.defaultBefore),
  };
}

async function resolveDefaultSubfolderChange(raw, base) {
  const value = optionalString(raw.value, 'value') || '';
  const validation = validateSubFolderName(value);
  if (!validation.valid) throw badRequest(validation.error);
  if (folderKey(value) === folderKey(base.defaultBefore)) {
    throw badRequest('That is already the default subfolder.');
  }
  const toLayout = base.layoutBefore(value);
  if (toLayout === base.layoutBefore(base.defaultBefore)) {
    throw badRequest('Both folders have the same layout, so changing the default doesn\'t need a reorganize.');
  }
  if (toLayout === LAYOUT_TV) {
    layoutGuards.assertNoMp3Users(await layoutGuards.usersOfGlobalDefault(), 'the default subfolder');
  }
  return {
    ...base,
    type: CHANGE_DEFAULT_SUBFOLDER,
    stored: { type: CHANGE_DEFAULT_SUBFOLDER, value, previousValue: base.defaultBefore },
    scope: value,
    label: 'the default subfolder',
    fromFolder: base.defaultBefore,
    toFolder: value,
    layoutAfter: base.layoutBefore,
    defaultAfter: value,
    folderAfter: (row) => libraryFolderOf(row.sub_folder, value),
  };
}

// A channel's title shows (and episode assignments) after the change: the
// channel stays in its folder, and the title plan says where its videos go.
async function resolveTitleShowsChange(raw, base) {
  const channel = await findChannel(raw.channelId);
  const overrides = raw.overrides === undefined || raw.overrides === null ? [] : raw.overrides;
  if (!Array.isArray(raw.shows) || !Array.isArray(overrides)) throw badRequest('shows and overrides must be lists');
  const { drafts, plan } = await titleShowSaver.prepare({ channel, rawShows: raw.shows, rawOverrides: overrides });
  const folder = libraryFolderOf(channel.sub_folder, base.defaultBefore);
  return {
    ...base,
    type: CHANGE_TITLE_SHOWS,
    stored: { type: CHANGE_TITLE_SHOWS, channelId: channel.channel_id, shows: raw.shows, overrides },
    scope: channel.channel_id,
    label: `${channel.title || channel.uploader || channel.channel_id}: shows`,
    channel,
    fromFolder: folder,
    toFolder: folder,
    layoutAfter: base.layoutBefore,
    defaultAfter: base.defaultBefore,
    folderAfter: base.folderBefore,
    drafts,
    titlePlan: plan,
  };
}

const byId = (key) => (a, b) => (a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0);

// The value names the main folder itself, not the default folder.
function namesMainFolder(subFolderValue) {
  return subFolderValue !== GLOBAL_DEFAULT_SENTINEL && !resolveEffectiveSubfolder(subFolderValue, null);
}

// Everything saved in the main folder moves out of it; channels and playlists
// that name the main folder, and the default folder when it is the main folder,
// switch to a Videos folder.
async function resolveMainFolderMove(raw, base) {
  if (base.layoutBefore('') !== LAYOUT_VIDEOS) {
    throw badRequest('The main folder uses TV shows, so its downloads stay where they are.');
  }
  const requested = optionalString(raw.folder, 'folder');
  if (requested) {
    // validateSubFolderName accepts the folder settings sentinels, which are not folder names.
    if (requested === GLOBAL_DEFAULT_SENTINEL || requested === ROOT_SENTINEL) throw badRequest('folder must be a folder name');
    const validation = validateSubFolderName(requested);
    if (!validation.valid) throw badRequest(validation.error);
  }
  const folder = await libraryFolders.mainFolderMoveTarget(requested || null);
  const [channels, playlists] = await Promise.all([
    Channel.findAll({ attributes: ['channel_id', 'sub_folder'], raw: true }),
    Playlist.findAll({ attributes: ['playlist_id', 'default_sub_folder'], raw: true }),
  ]);
  const channelMoves = channels.filter((row) => namesMainFolder(row.sub_folder))
    .map((row) => ({ channelId: row.channel_id, previous: row.sub_folder ?? null }))
    .sort(byId('channelId'));
  const playlistMoves = playlists.filter((row) => namesMainFolder(row.default_sub_folder))
    .map((row) => ({ playlistId: row.playlist_id, previous: row.default_sub_folder ?? null }))
    .sort(byId('playlistId'));
  if (channelMoves.length === 0 && playlistMoves.length === 0 && base.defaultBefore
    && !(await libraryFolders.mainFolderHasDownloads())) {
    throw badRequest('Nothing is saved in the main folder, so nothing needs to move.');
  }
  const defaultAfter = base.defaultBefore || folder;
  const explicit = new Set(channelMoves.map((move) => move.channelId));
  return {
    ...base,
    type: CHANGE_MAIN_FOLDER_MOVE,
    stored: {
      type: CHANGE_MAIN_FOLDER_MOVE, folder, previousDefault: base.defaultBefore, channels: channelMoves, playlists: playlistMoves,
    },
    scope: '',
    label: 'the main folder',
    fromFolder: '',
    toFolder: folder,
    layoutAfter: base.layoutBefore,
    defaultAfter,
    folderAfter: (row) => (explicit.has(row.channel_id) ? folder : libraryFolderOf(row.sub_folder, defaultAfter)),
  };
}

/**
 * Resolve a change requested by the API.
 *
 * @param {Object} raw
 *   { type: 'channelLayout', channelId, layout, folder? }
 *   | { type: 'channel', channelId, subFolder }
 *   | { type: 'folderLayout', folder, layout }
 *   | { type: 'defaultSubfolder', value }
 *   | { type: 'titleShows', channelId, shows, overrides? }
 *   | { type: 'mainFolderMove', folder? }
 * @returns {Promise<Object>} The resolved change. Errors carry .status (400/404/409).
 */
async function resolveChange(raw) {
  if (!raw || typeof raw !== 'object') throw badRequest('change is required');
  const defaultBefore = String(configModule.getDefaultSubfolder() || '').trim();
  const base = {
    layoutBefore: await getLayoutResolver(),
    defaultBefore,
    folderBefore: (row) => libraryFolderOf(row.sub_folder, defaultBefore),
  };

  switch (raw.type) {
  case CHANGE_CHANNEL_LAYOUT: {
    const channel = await findChannel(raw.channelId);
    const folder = optionalString(raw.folder, 'folder');
    const subFolder = await channelLayout.resolveLayoutTarget({ channel, layout: raw.layout, folder: folder === null ? undefined : folder });
    return resolveChannelChange(channel, subFolder, base);
  }
  case CHANGE_CHANNEL: {
    const channel = await findChannel(raw.channelId);
    return resolveChannelChange(channel, optionalString(raw.subFolder, 'subFolder'), base);
  }
  case CHANGE_FOLDER_LAYOUT:
    return resolveFolderLayoutChange(raw, base);
  case CHANGE_DEFAULT_SUBFOLDER:
    return resolveDefaultSubfolderChange(raw, base);
  case CHANGE_TITLE_SHOWS:
    return resolveTitleShowsChange(raw, base);
  case CHANGE_MAIN_FOLDER_MOVE:
    return resolveMainFolderMove(raw, base);
  default:
    throw badRequest('Unknown change type');
  }
}

module.exports = {
  resolveChange,
  folderLabel,
  libraryFolderOf
};
