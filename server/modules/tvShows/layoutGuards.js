/**
 * Refusals that keep a library folder from mixing layouts. A channel or folder
 * that already holds downloaded videos switches between videos and TV only
 * through the reorganize, which moves its files (a reorganizeRequired 409
 * names the change for its preview), and nothing switches directly while a
 * download runs (its later videos would land in the new layout, its earlier
 * ones in the old). TV layout is also video-only: MP3 downloads stay out of
 * TV folders.
 */

const fs = require('fs');
const path = require('path');
const Channel = require('../../models/channel');
const Playlist = require('../../models/playlist');
const Video = require('../../models/video');
const VideoClassification = require('../../models/videoclassification');
const TvShow = require('../../models/tvshow');
const configModule = require('../configModule');
const { buildSubfolderSegment, directoryHasFiles, GLOBAL_DEFAULT_SENTINEL } = require('../filesystem');
const { effectiveLibraryFolder } = require('./channelFolders');
const { getLayoutResolver } = require('./libraryLayouts');
const { LAYOUT_TV, folderKey, isMp3Format, MP3_AUDIO_FORMATS, KIND_TITLE_SHOW } = require('./constants');

function guardError(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}

/**
 * A 409 for a change that moves downloaded files: the client opens the
 * reorganize preview for `change` instead of saving directly.
 * @param {string} message
 * @param {Object} change - A reorganize change (see reorganize/changeContext)
 */
function reorganizeRequiredError(message, change) {
  const err = guardError(message, 409);
  err.reorganizeRequired = true;
  err.change = change;
  return err;
}

/**
 * Response body for a refusal: { error }, plus the change to review when the
 * refusal asks for a reorganize, and the error code when there is one.
 * @param {Error} error - An error carrying .status
 */
function errorBody(error) {
  const body = { error: error.message };
  if (error.reorganizeRequired) {
    body.reorganizeRequired = true;
    body.change = error.change;
  }
  if (error.code) body.code = error.code;
  return body;
}

/**
 * @param {() => boolean} [isDownloadRunning]
 * @param {string} message
 */
function assertNoDownloadRunning(isDownloadRunning, message) {
  if (isDownloadRunning && isDownloadRunning()) {
    throw guardError(message, 409);
  }
}

async function channelHasDownloads(channelId) {
  if ((await Video.count({ where: { channel_id: channelId, removed: false } })) > 0) return true;
  // A VEVO/Topic upload routed to its owner's show keeps the uploader's id on
  // its videos row, so the owner's episodes are found through their classifications.
  const episodes = await VideoClassification.findAll({ where: { channel_id: channelId }, attributes: ['youtube_id'] });
  if (episodes.length === 0) return false;
  const youtubeIds = episodes.map((row) => row.youtube_id);
  return (await Video.count({ where: { youtubeId: youtubeIds, removed: false } })) > 0;
}

/**
 * Ids of the channels with downloaded videos: channelHasDownloads for every
 * channel at once (their own videos, plus the episodes routed to their show
 * from another uploader's id).
 * @returns {Promise<Set<string>>}
 */
async function channelIdsWithDownloads() {
  const [owned, classified] = await Promise.all([
    Video.findAll({ where: { removed: false }, attributes: ['channel_id'], group: ['channel_id'], raw: true }),
    VideoClassification.findAll({ attributes: ['channel_id', 'youtube_id'], raw: true }),
  ]);
  const ids = new Set(owned.map((row) => row.channel_id).filter(Boolean));
  const pending = classified.filter((row) => !ids.has(row.channel_id));
  if (pending.length === 0) return ids;
  const present = await Video.findAll({
    where: { youtubeId: pending.map((row) => row.youtube_id), removed: false }, attributes: ['youtubeId'], raw: true,
  });
  const presentIds = new Set(present.map((row) => row.youtubeId));
  for (const row of pending) {
    if (presentIds.has(row.youtube_id)) ids.add(row.channel_id);
  }
  return ids;
}

// Downloaded files directly in the main folder; __subfolders, the local temp
// folder and dotfiles are not the main folder's content.
async function mainFolderHasFiles(baseDir) {
  let entries;
  try {
    entries = await fs.promises.readdir(baseDir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return false;
    throw err;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('__') || entry.name.startsWith('.')) continue;
    if (!entry.isDirectory()) return true;
    if (await directoryHasFiles(path.join(baseDir, entry.name))) return true;
  }
  return false;
}

/**
 * @param {string} libraryFolder - '' for the main folder
 * @returns {Promise<boolean>}
 */
async function folderHasFiles(libraryFolder) {
  const baseDir = configModule.directoryPath;
  if (!libraryFolder) return mainFolderHasFiles(baseDir);
  return directoryHasFiles(path.join(baseDir, buildSubfolderSegment(libraryFolder)));
}

/**
 * Channels and enabled playlists whose downloads resolve into a library folder.
 * @param {string} libraryFolder
 * @param {{subFolderOf?: (value: string|null) => string}} [options] - Override how
 *   sentinel values resolve (e.g. against a default subfolder about to be saved)
 */
async function usersOfFolder(libraryFolder, { subFolderOf = effectiveLibraryFolder } = {}) {
  const key = folderKey(libraryFolder);
  const [channels, playlists] = await Promise.all([
    Channel.findAll({ attributes: ['channel_id', 'title', 'sub_folder', 'audio_format', 'enabled'] }),
    Playlist.findAll({ where: { enabled: true }, attributes: ['playlist_id', 'title', 'default_sub_folder', 'audio_format'] }),
  ]);
  return {
    channels: channels.filter((c) => folderKey(subFolderOf(c.sub_folder)) === key),
    playlists: playlists.filter((p) => folderKey(subFolderOf(p.default_sub_folder)) === key),
  };
}

/**
 * Channels and enabled playlists set to follow the global default subfolder.
 */
async function usersOfGlobalDefault() {
  const [channels, playlists] = await Promise.all([
    Channel.findAll({
      where: { sub_folder: GLOBAL_DEFAULT_SENTINEL },
      attributes: ['channel_id', 'title', 'sub_folder', 'audio_format', 'enabled'],
    }),
    Playlist.findAll({
      where: { enabled: true, default_sub_folder: GLOBAL_DEFAULT_SENTINEL },
      attributes: ['playlist_id', 'title', 'default_sub_folder', 'audio_format'],
    }),
  ]);
  return { channels, playlists };
}

/**
 * Refuse saving MP3 downloads into a TV folder.
 * @param {{channels: Array, playlists: Array}} users
 * @param {string} folderDescription - e.g. 'this folder'
 */
function assertNoMp3Users({ channels, playlists }, folderDescription) {
  const mp3Channels = channels.filter((c) => c.enabled && isMp3Format(c.audio_format));
  const mp3Playlists = playlists.filter((p) => isMp3Format(p.audio_format));
  if (mp3Channels.length === 0 && mp3Playlists.length === 0) return;
  const names = [...mp3Channels, ...mp3Playlists].map((item) => item.title).filter(Boolean).slice(0, 5);
  throw guardError(
    `TV shows are video-only, and ${mp3Channels.length + mp3Playlists.length} channel(s) or playlist(s) in `
    + `${folderDescription} download MP3${names.length ? ` (${names.join(', ')})` : ''}. Change their download type to Video first.`,
    409
  );
}

/**
 * Refuse an MP3 download type for a destination folder with the TV layout.
 * @param {Object} params
 * @param {string|null|undefined} params.audioFormat
 * @param {string|null|undefined} params.subFolderValue - sub_folder-style value (name or sentinel)
 */
async function assertVideoOnlyDestination({ audioFormat, subFolderValue }) {
  if (!isMp3Format(audioFormat)) return;
  const layoutOf = await getLayoutResolver();
  if (layoutOf(effectiveLibraryFolder(subFolderValue)) === LAYOUT_TV) {
    throw guardError('TV folders are video-only. Choose Video as the download type, or a Videos folder.', 400);
  }
}

/**
 * Refuse switching a folder that holds title shows to the Videos layout:
 * title shows always live in a TV folder.
 * @param {string} libraryFolder - '' for the main folder
 */
async function assertNoTitleShows(libraryFolder) {
  const shows = await TvShow.findAll({
    where: { library_folder: libraryFolder || '', kind: KIND_TITLE_SHOW, retired_at: null }, attributes: ['name'],
  });
  if (shows.length === 0) return;
  throw guardError(
    `Title shows always live in a TV folder, and this folder holds ${shows.map((show) => show.name).join(', ')}. `
    + 'Move them to another TV folder or remove them first.',
    400
  );
}

module.exports = {
  MP3_AUDIO_FORMATS,
  assertNoTitleShows,
  guardError,
  reorganizeRequiredError,
  errorBody,
  isMp3Format,
  assertNoDownloadRunning,
  channelHasDownloads,
  channelIdsWithDownloads,
  mainFolderHasFiles,
  folderHasFiles,
  usersOfFolder,
  usersOfGlobalDefault,
  assertNoMp3Users,
  assertVideoOnlyDestination
};
