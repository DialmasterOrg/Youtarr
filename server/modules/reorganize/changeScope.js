/**
 * Which downloaded videos a change moves, and the channel that owns each.
 *
 * - A channel's videos: rows with its channel id, its classified episodes
 *   (a VEVO/Topic upload keeps the uploader's id on its row), and rows whose
 *   files sit in its channel or show folder.
 * - A library folder's videos: every row whose file is in that folder,
 *   tracked or not.
 * - The default subfolder's videos: those of every channel that follows it.
 * - A title show change: the downloaded videos its title plan moves.
 *
 * Only rows with a file inside the downloads folder are moved; rows marked
 * missing are left alone.
 */

const path = require('path');
const { Op } = require('sequelize');
const Video = require('../../models/video');
const Channel = require('../../models/channel');
const VideoClassification = require('../../models/videoclassification');
const configModule = require('../configModule');
const { GUARDED_COLUMNS } = require('../videoRowGuard');
const { resolveLibraryFolder } = require('../filesystem/showFolderCleanup');
const { resolveChannelFolderName, buildSubfolderSegment } = require('../filesystem/pathBuilder');
const { GLOBAL_DEFAULT_SENTINEL } = require('../filesystem/constants');
const { LAYOUT_TV, folderKey } = require('../tvShows/constants');
const { resolveChannelDirectory } = require('../tvShows/channelFolders');
const { CHANGE_CHANNEL, CHANGE_FOLDER_LAYOUT, CHANGE_DEFAULT_SUBFOLDER, CHANGE_TITLE_SHOWS } = require('./constants');

const VIDEO_ATTRIBUTES = [
  'id', 'youtubeId', 'channel_id', 'youTubeVideoName', 'youTubeChannelName', 'originalDate', 'removed',
  ...GUARDED_COLUMNS,
];
const CHANNEL_ATTRIBUTES = [
  'channel_id', 'title', 'uploader', 'folder_name', 'sub_folder', 'enabled', 'skip_video_folder', 'audio_format',
  'description', 'm3u_enabled',
];

function mediaPathOf(video) {
  return video.filePath || video.audioFilePath || null;
}

function withPrefix(dir) {
  const prefix = dir.endsWith(path.sep) ? dir : `${dir}${path.sep}`;
  return { [Op.or]: [{ filePath: { [Op.startsWith]: prefix } }, { audioFilePath: { [Op.startsWith]: prefix } }] };
}

function isUnder(filePath, dir) {
  const relative = path.relative(dir, filePath);
  return Boolean(relative) && !relative.startsWith('..') && !path.isAbsolute(relative);
}

async function loadChannels(where = {}) {
  const rows = await Channel.findAll({ where, attributes: CHANNEL_ATTRIBUTES });
  return new Map(rows.map((row) => [row.channel_id, row]));
}

async function classificationsOf(youtubeIds) {
  if (youtubeIds.length === 0) return new Map();
  const rows = await VideoClassification.findAll({
    where: { youtube_id: youtubeIds },
    attributes: ['youtube_id', 'channel_id', 'show_id', 'status', 'season', 'episode', 'source', 'file_stem', 'episode_title'],
  });
  return new Map(rows.map((row) => [row.youtube_id, row]));
}

function toSubject(video, ownerChannelId, channels, context) {
  const mediaPath = mediaPathOf(video);
  const located = mediaPath ? resolveLibraryFolder(mediaPath, configModule.directoryPath) : null;
  if (!located) return null;
  return {
    video,
    ownerChannelId,
    ownerChannel: channels.get(ownerChannelId) || null,
    libraryFolder: located.libraryFolder,
    currentLayout: context.layoutBefore(located.libraryFolder),
  };
}

async function videosOfChannel(channel, context, channels) {
  const { dir } = await resolveChannelDirectory(channel, { layoutOf: context.layoutBefore });
  const episodeIds = (await VideoClassification.findAll({ where: { channel_id: channel.channel_id }, attributes: ['youtube_id'] }))
    .map((row) => row.youtube_id);
  const episodeIdSet = new Set(episodeIds);
  const matches = [{ channel_id: channel.channel_id }];
  if (episodeIds.length > 0) matches.push({ youtubeId: episodeIds });
  if (dir) matches.push(withPrefix(dir));
  // LIKE treats _ and % in a folder name as wildcards; the prefix query only
  // narrows the rows, the path check decides.
  const videos = (await Video.findAll({
    where: { removed: false, [Op.or]: matches },
    attributes: VIDEO_ATTRIBUTES,
    raw: true,
  })).filter((video) => video.channel_id === channel.channel_id
    || episodeIdSet.has(video.youtubeId)
    || (dir && [video.filePath, video.audioFilePath].some((filePath) => filePath && isUnder(filePath, dir))));
  const classifications = await classificationsOf(videos.map((video) => video.youtubeId));

  const subjects = [];
  for (const video of videos) {
    const subject = toSubject(video, channel.channel_id, channels, context);
    if (!subject) continue;
    // An episode in another channel's show (its owner by classification)
    // moves with that channel, not this one.
    const classification = classifications.get(video.youtubeId);
    if (subject.currentLayout === LAYOUT_TV && classification && classification.channel_id !== channel.channel_id) continue;
    subjects.push(subject);
  }
  return subjects;
}

function libraryRootOf(libraryFolder) {
  const base = configModule.directoryPath;
  return libraryFolder ? path.join(base, buildSubfolderSegment(libraryFolder)) : base;
}

// Owner of a video found in a library folder: its show's channel in a TV
// folder; in a videos folder the tracked channel whose folder holds it (a
// VEVO/Topic upload lives in its owner's folder); else the uploader.
function ownerInFolder(video, { libraryFolder, layout, classifications, channelByFolder }) {
  const classification = classifications.get(video.youtubeId);
  if (layout === LAYOUT_TV && classification) return classification.channel_id;
  if (layout !== LAYOUT_TV) {
    const relative = path.relative(libraryRootOf(libraryFolder), mediaPathOf(video));
    const channelFolder = relative.split(path.sep)[0];
    const owner = channelByFolder.get(channelFolder.toLowerCase());
    if (owner) return owner;
  }
  return video.channel_id;
}

async function videosOfFolder(libraryFolder, context, channels) {
  const root = libraryRootOf(libraryFolder);
  const videos = (await Video.findAll({ where: { removed: false, ...withPrefix(root) }, attributes: VIDEO_ATTRIBUTES, raw: true }))
    .filter((video) => {
      const located = resolveLibraryFolder(mediaPathOf(video), configModule.directoryPath);
      return located && folderKey(located.libraryFolder) === folderKey(libraryFolder);
    });
  const classifications = await classificationsOf(videos.map((video) => video.youtubeId));
  const channelByFolder = new Map();
  for (const channel of channels.values()) {
    const name = resolveChannelFolderName(channel);
    if (name && folderKey(context.folderBefore(channel)) === folderKey(libraryFolder)) {
      channelByFolder.set(name.toLowerCase(), channel.channel_id);
    }
  }
  const layout = context.layoutBefore(libraryFolder);
  return videos
    .map((video) => toSubject(video, ownerInFolder(video, { libraryFolder, layout, classifications, channelByFolder }), channels, context))
    .filter(Boolean);
}

// A title show change moves exactly the downloaded videos its title plan
// says must move.
async function videosOfTitleChange(context, channels) {
  const ids = context.titlePlan.entries.filter((entry) => entry.moves).map((entry) => entry.youtubeId);
  if (ids.length === 0) return [];
  const videos = await Video.findAll({ where: { youtubeId: ids, removed: false }, attributes: VIDEO_ATTRIBUTES, raw: true });
  return videos
    .map((video) => toSubject(video, context.channel.channel_id, channels, context))
    .filter(Boolean);
}

/**
 * @param {Object} context - changeContext.resolveChange's result
 * @returns {Promise<{subjects: Array<Object>, channels: Map<string, Object>}>}
 *   Each subject: { video, ownerChannelId, ownerChannel, libraryFolder, currentLayout }
 */
async function selectSubjects(context) {
  const channels = await loadChannels();
  let subjects = [];
  if (context.type === CHANGE_CHANNEL) {
    subjects = await videosOfChannel(channels.get(context.channel.channel_id) || context.channel, context, channels);
  } else if (context.type === CHANGE_FOLDER_LAYOUT) {
    subjects = await videosOfFolder(context.folder, context, channels);
  } else if (context.type === CHANGE_TITLE_SHOWS) {
    subjects = await videosOfTitleChange(context, channels);
  } else if (context.type === CHANGE_DEFAULT_SUBFOLDER) {
    for (const channel of channels.values()) {
      if (channel.sub_folder !== GLOBAL_DEFAULT_SENTINEL) continue;
      subjects.push(...await videosOfChannel(channel, context, channels));
    }
  }

  const seen = new Set();
  const unique = subjects.filter((subject) => {
    if (seen.has(subject.video.id)) return false;
    seen.add(subject.video.id);
    return true;
  });
  return { subjects: unique, channels };
}

module.exports = {
  selectSubjects,
  mediaPathOf,
  libraryRootOf
};
