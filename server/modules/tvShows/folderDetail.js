/**
 * One library folder in detail, for the Library folders page inspector
 * (GET /api/library-folders/folder/:key): the enabled channels that chose it,
 * the channels following the default into it, the playlists and title shows
 * that use it (each with its downloaded videos in the folder), and the most
 * recently downloaded video as the example for the layout preview. The
 * example's upload time is read the way date numbering reads it, so example
 * episode numbers match real ones.
 */

const path = require('path');
const { Op } = require('sequelize');
const Channel = require('../../models/channel');
const Playlist = require('../../models/playlist');
const PlaylistVideo = require('../../models/playlistvideo');
const TvShow = require('../../models/tvshow');
const Video = require('../../models/video');
const VideoClassification = require('../../models/videoclassification');
const configModule = require('../configModule');
const subfolderModule = require('../subfolderModule');
const videoInfoStore = require('../videoInfoStore');
const { buildSubfolderSegment } = require('../filesystem/pathBuilder');
const { GLOBAL_DEFAULT_SENTINEL } = require('../filesystem/constants');
const { resolveLibraryFolder } = require('../filesystem/showFolderCleanup');
const { folderKey, KIND_TITLE_SHOW } = require('./constants');
const { effectiveLibraryFolder } = require('./channelFolders');
const { getLayoutResolver } = require('./libraryLayouts');
const { releaseTime } = require('./dateNumbering');
const { chosenFolderOf } = require('./folderUsage');
const { guardError } = require('./layoutGuards');

// The main folder's route key; `~` can't appear in a subfolder name.
const MAIN_FOLDER_KEY = '~main';
const FOLLOWER_SAMPLE_SIZE = 3;
const VIDEO_ATTRIBUTES = [
  'id', 'youtubeId', 'channel_id', 'youTubeChannelName', 'youTubeVideoName', 'originalDate',
  'filePath', 'audioFilePath', 'last_downloaded_at',
];

const byName = (a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' });
const channelName = (channel) => channel.uploader || channel.title || channel.channel_id;
const mediaPathOf = (video) => video.filePath || video.audioFilePath || null;

async function resolveFolderName(routeKey) {
  if (routeKey === MAIN_FOLDER_KEY) return '';
  const wanted = folderKey(routeKey);
  if (!wanted) return null;
  const names = (await subfolderModule.getAll()).map((display) => display.replace(/^__/, ''));
  return names.find((name) => folderKey(name) === wanted) ?? null;
}

// Each video keeps its library root as spelled on disk: a channel set to
// `kids` downloads into __kids even when the registry row says Kids.
async function videosInFolder(name) {
  const base = configModule.directoryPath;
  const root = name ? path.join(base, buildSubfolderSegment(name)) : base;
  // DATA_PATH may end with a separator.
  const prefix = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
  const rows = await Video.findAll({
    where: {
      removed: false,
      [Op.or]: [{ filePath: { [Op.startsWith]: prefix } }, { audioFilePath: { [Op.startsWith]: prefix } }],
    },
    attributes: VIDEO_ATTRIBUTES,
    raw: true,
  });
  const videos = [];
  for (const video of rows) {
    const located = resolveLibraryFolder(mediaPathOf(video), base);
    if (located && folderKey(located.libraryFolder) === folderKey(name)) {
      videos.push({ ...video, libraryRoot: located.libraryRoot });
    }
  }
  return videos;
}

async function countMembers(Model, groupField, idField, groupIds, videoIds) {
  const counts = new Map();
  if (groupIds.length === 0) return counts;
  const rows = await Model.findAll({ where: { [groupField]: groupIds }, attributes: [groupField, idField], raw: true });
  for (const row of rows) {
    if (videoIds.has(row[idField])) counts.set(row[groupField], (counts.get(row[groupField]) || 0) + 1);
  }
  return counts;
}

function latestDownload(videos) {
  const timeOf = (video) => (video.last_downloaded_at ? new Date(video.last_downloaded_at).getTime() : -Infinity);
  return videos.reduce((best, video) => {
    if (!best) return video;
    if (timeOf(video) !== timeOf(best)) return timeOf(video) > timeOf(best) ? video : best;
    return video.id > best.id ? video : best;
  }, null);
}

async function exampleOf(video) {
  if (!video) return null;
  const time = releaseTime(await videoInfoStore.readInfoOrFallback(video));
  return {
    channelName: video.youTubeChannelName || '',
    title: video.youTubeVideoName || '',
    youtubeId: video.youtubeId,
    uploadedAt: time ? new Date(time.epochSeconds * 1000).toISOString() : null,
    uploadedAtSource: time ? time.source : null,
    relativePath: path.relative(video.libraryRoot, mediaPathOf(video)).split(path.sep).join('/'),
  };
}

/**
 * @param {string} routeKey - the subfolder name, or '~main'
 */
async function getFolderDetail(routeKey) {
  const name = await resolveFolderName(routeKey);
  if (name === null) throw guardError('Library folder not found', 404);
  const key = folderKey(name);
  const [layoutOf, channels, playlists, shows, videos] = await Promise.all([
    getLayoutResolver(),
    Channel.findAll({ where: { enabled: true }, attributes: ['channel_id', 'title', 'uploader', 'sub_folder'], raw: true }),
    Playlist.findAll({ where: { enabled: true }, attributes: ['playlist_id', 'title', 'default_sub_folder'], raw: true }),
    TvShow.findAll({
      where: { kind: KIND_TITLE_SHOW, retired_at: null },
      attributes: ['id', 'name', 'channel_id', 'library_folder'],
      raw: true,
    }),
    videosInFolder(name),
  ]);

  const videoIds = new Set(videos.map((video) => video.youtubeId));
  const perChannel = new Map();
  for (const video of videos) perChannel.set(video.channel_id, (perChannel.get(video.channel_id) || 0) + 1);

  const folderPlaylists = playlists.filter((playlist) => folderKey(effectiveLibraryFolder(playlist.default_sub_folder)) === key);
  const folderShows = shows.filter((show) => folderKey(show.library_folder) === key);
  const showChannelIds = [...new Set(folderShows.map((show) => show.channel_id))];
  const [perPlaylist, perShow, showChannels] = await Promise.all([
    countMembers(PlaylistVideo, 'playlist_id', 'youtube_id', folderPlaylists.map((p) => p.playlist_id), videoIds),
    countMembers(VideoClassification, 'show_id', 'youtube_id', folderShows.map((s) => s.id), videoIds),
    showChannelIds.length
      ? Channel.findAll({ where: { channel_id: showChannelIds }, attributes: ['channel_id', 'title', 'uploader'], raw: true })
      : [],
  ]);
  const showChannelNames = new Map(showChannels.map((channel) => [channel.channel_id, channelName(channel)]));

  const isDefault = key === folderKey(configModule.getDefaultSubfolder());
  const followerNames = isDefault
    ? channels.filter((channel) => channel.sub_folder === GLOBAL_DEFAULT_SENTINEL).map(channelName).sort(byName)
    : [];

  return {
    name,
    layout: layoutOf(name),
    channels: channels
      .filter((channel) => {
        const chosen = chosenFolderOf(channel.sub_folder);
        return chosen !== null && folderKey(chosen) === key;
      })
      .map((channel) => ({
        channelId: channel.channel_id, name: channelName(channel), videoCount: perChannel.get(channel.channel_id) || 0,
      }))
      .sort((a, b) => byName(a.name, b.name)),
    followers: { count: followerNames.length, sample: followerNames.slice(0, FOLLOWER_SAMPLE_SIZE) },
    playlists: folderPlaylists
      .map((playlist) => ({
        playlistId: playlist.playlist_id,
        name: playlist.title || playlist.playlist_id,
        videoCount: perPlaylist.get(playlist.playlist_id) || 0,
      }))
      .sort((a, b) => byName(a.name, b.name)),
    titleShows: folderShows
      .map((show) => ({
        id: show.id,
        name: show.name,
        channelId: show.channel_id,
        channelName: showChannelNames.get(show.channel_id) || show.channel_id,
        episodeCount: perShow.get(show.id) || 0,
      }))
      .sort((a, b) => byName(a.name, b.name)),
    example: await exampleOf(latestDownload(videos)),
  };
}

module.exports = { MAIN_FOLDER_KEY, getFolderDetail };
