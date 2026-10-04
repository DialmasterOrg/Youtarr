/**
 * Work after a reorganize's videos moved.
 *
 * While the lock is still held (files and folders):
 * - each show that received episodes gets its tvshow.nfo and art;
 * - each channel folder that received videos gets the channel art;
 * - channel and show folders the videos left are removed once they hold
 *   nothing but metadata and art;
 * - channels now in a Videos folder get their channel .m3u regenerated.
 *
 * After the lock is released (servers and playlists, slow and network-bound):
 * - the __playlists__ .m3u files and media-server playlists that contain a
 *   moved video are regenerated and re-synced;
 * - the old and new libraries are refreshed;
 * - held watch state is pushed back to the servers.
 */

const path = require('path');
const configModule = require('../configModule');
const plexModule = require('../plexModule');
const m3uGenerator = require('../m3uGenerator');
const logger = require('../../logger');
const Channel = require('../../models/channel');
const TvShow = require('../../models/tvshow');
const Playlist = require('../../models/playlist');
const PlaylistVideo = require('../../models/playlistvideo');
const sidecarWriter = require('../sidecarWriter');
const mediaServerSync = require('../mediaServers/mediaServerSync');
const serverRegistry = require('../mediaServers/serverRegistry');
const watchStatusPushBack = require('../mediaServers/watchStatusPushBack');
const { cleanupEmptyChannelDirectory } = require('../filesystem/directoryManager');
const { cleanupOrphanShowFolder, resolveLibraryFolder } = require('../filesystem/showFolderCleanup');
const { LAYOUT_TV } = require('../tvShows/constants');
const { showDirectory } = require('../tvShows/channelFolders');

// The channel or show folder a path sits in: the first folder inside its
// library folder.
function rootFolderOf(filePath) {
  const located = resolveLibraryFolder(filePath, configModule.directoryPath);
  if (!located) return null;
  const first = path.relative(located.libraryRoot, filePath).split(path.sep)[0];
  return first ? path.join(located.libraryRoot, first) : null;
}

async function safely(label, context, action) {
  try {
    await action();
  } catch (err) {
    logger.warn({ err, ...context }, label);
  }
}

/**
 * @param {Object} params
 * @param {Array<Object>} params.items - Done items, each { channelId, plan, classification }
 * @param {Array<Object>} params.shows - Pinned shows (with showId)
 */
async function finishFiles({ items, shows }) {
  const showIds = new Set(items.filter((item) => item.classification).map((item) => item.classification.ownerChannelId));
  for (const planned of shows) {
    if (!planned.showId || !showIds.has(planned.ownerChannelId)) continue;
    await safely('Could not write the show metadata after a reorganize', { showId: planned.showId }, async () => {
      const show = await TvShow.findByPk(planned.showId);
      if (show) await sidecarWriter.writeShowMetadata({ show, showDir: showDirectory(show), plot: planned.plot || null });
    });
  }

  const channelFolders = new Map();
  const leftFolders = new Map();
  for (const { channelId, plan } of items) {
    const destRoot = rootFolderOf(plan.newVideoPath || plan.newAudioPath);
    if (plan.layout !== LAYOUT_TV && destRoot) channelFolders.set(destRoot, channelId);
    const sourceRoot = rootFolderOf(plan.oldVideoPath || plan.oldAudioPath);
    if (sourceRoot && sourceRoot !== destRoot) leftFolders.set(sourceRoot, plan.fromLayout);
  }
  for (const [folderPath, channelId] of channelFolders) {
    sidecarWriter.writeFolderArt({ channelId, folderPath });
  }
  for (const [folderPath, layout] of leftFolders) {
    await safely('Could not remove a folder a reorganize emptied', { folderPath }, async () => {
      if (layout === LAYOUT_TV) await cleanupOrphanShowFolder(folderPath);
      else await cleanupEmptyChannelDirectory(folderPath, configModule.directoryPath, { includeIgnorableFiles: true });
    });
  }

  const videoChannels = [...new Set(items.filter((item) => item.plan.layout !== LAYOUT_TV).map((item) => item.channelId))];
  const tracked = videoChannels.length > 0
    ? await Channel.findAll({ where: { channel_id: videoChannels, m3u_enabled: true }, attributes: ['channel_id'] })
    : [];
  for (const channel of tracked) {
    await safely('Could not regenerate the channel .m3u after a reorganize', { channelId: channel.channel_id },
      () => m3uGenerator.generateChannelM3U(channel.channel_id));
  }
}

async function refreshPlaylists(youtubeIds) {
  if (youtubeIds.length === 0) return;
  const rows = await PlaylistVideo.findAll({ where: { youtube_id: youtubeIds }, attributes: ['playlist_id'] });
  const playlistIds = [...new Set(rows.map((row) => row.playlist_id))];
  if (playlistIds.length === 0) return;
  const playlists = await Playlist.findAll({ where: { playlist_id: playlistIds, enabled: true } });
  for (const playlist of playlists) {
    await safely('Could not regenerate a playlist .m3u after a reorganize', { playlistId: playlist.id },
      () => m3uGenerator.generatePlaylistM3U(playlist.id));
    await safely('Could not re-sync a media server playlist after a reorganize', { playlistId: playlist.id },
      () => mediaServerSync.syncPlaylist(playlist.id));
  }
}

async function refreshLibraries(libraryFolders) {
  await safely('Could not refresh the Plex libraries after a reorganize', {},
    () => plexModule.refreshLibrariesForSubfolders([...libraryFolders].map((folder) => folder || null)));
  const adapters = serverRegistry.getEnabledAdapters(configModule.getConfig())
    .filter((adapter) => adapter.serverType !== 'plex');
  for (const adapter of adapters) {
    await safely('Could not refresh a media server library after a reorganize', { serverType: adapter.serverType },
      () => adapter.triggerLibraryScan(null));
  }
}

/**
 * @param {Object} params
 * @param {Array<Object>} params.items - Done items, each { youtubeId, plan }
 */
async function finishServers({ items }) {
  await refreshPlaylists(items.map((item) => item.youtubeId));
  const folders = new Set();
  for (const { plan } of items) {
    folders.add(plan.fromLibraryFolder || '');
    folders.add(plan.libraryFolder || '');
  }
  if (folders.size > 0) await refreshLibraries(folders);
  // Pushes whatever holds are pending, this operation's or an earlier one's
  // (a resumed operation's holds were created before the restart).
  watchStatusPushBack.scheduleFollowUps();
}

module.exports = {
  finishFiles,
  finishServers,
  rootFolderOf
};
