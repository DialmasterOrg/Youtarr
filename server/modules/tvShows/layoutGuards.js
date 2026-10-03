/**
 * Refusals that keep a library folder from mixing layouts. Until downloads can
 * be reorganized, a channel or folder that already holds downloaded videos
 * can't switch between videos and TV, and nothing switches while a download
 * runs (its later videos would land in the new layout, its earlier ones in
 * the old). TV layout is also video-only: MP3 downloads stay out of TV folders.
 */

const fs = require('fs');
const path = require('path');
const Channel = require('../../models/channel');
const Playlist = require('../../models/playlist');
const Video = require('../../models/video');
const VideoClassification = require('../../models/videoclassification');
const configModule = require('../configModule');
const { buildSubfolderSegment, directoryHasFiles, GLOBAL_DEFAULT_SENTINEL } = require('../filesystem');
const { effectiveLibraryFolder } = require('./channelFolders');
const { getLayoutResolver } = require('./libraryLayouts');
const { LAYOUT_TV, folderKey, isMp3Format, MP3_AUDIO_FORMATS } = require('./constants');

function guardError(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
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
 * Refuse when any of the channels has downloaded videos.
 * @param {Array} channels - channels rows
 * @param {string} message
 */
async function assertChannelsHaveNoDownloads(channels, message) {
  for (const channel of channels) {
    if (await channelHasDownloads(channel.channel_id)) {
      throw guardError(message, 409);
    }
  }
}

module.exports = {
  MP3_AUDIO_FORMATS,
  guardError,
  isMp3Format,
  assertNoDownloadRunning,
  channelHasDownloads,
  mainFolderHasFiles,
  folderHasFiles,
  usersOfFolder,
  usersOfGlobalDefault,
  assertNoMp3Users,
  assertVideoOnlyDestination,
  assertChannelsHaveNoDownloads
};
