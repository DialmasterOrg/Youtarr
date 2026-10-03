/**
 * The post-processor's TV branch: decide whether a downloaded video is an
 * episode, and if so where it goes and under which name.
 *
 *   <library folder>/<show folder>/Season NN/<stem>.<ext>
 *
 * Files sit directly in the season folder (no per-video folders), renamed to
 * the episode stem, so their sidecars (.jpg, .<lang>.srt, .nfo) follow it.
 */

const fs = require('fs');
const path = require('path');
const VideoClassification = require('../../models/videoclassification');
const logger = require('../../logger');
const { buildSubfolderSegment, isFileForVideo, replaceFileWithRetries, ensureDirWithRetries } = require('../filesystem');
const { LAYOUT_TV } = require('./constants');
const { getLayoutResolver } = require('./libraryLayouts');
const { resolveDestination } = require('./routing');
const showStore = require('./showStore');
const { assignDateEpisode, STATUS_ASSIGNED } = require('./episodeAllocator');
const { seasonFolderName, episodeFileName } = require('./episodeNaming');
const { dateFromEpisodeCode, buildEpisodeNfo, writeTvShowNfoIfChanged } = require('./tvNfo');

const MOVE_RETRY_OPTIONS = { retries: 5, delayMs: 500 };

function libraryFolderPath(baseDir, libraryFolder) {
  return libraryFolder ? path.join(baseDir, buildSubfolderSegment(libraryFolder)) : baseDir;
}

/**
 * Work out where a downloaded video goes. Returns null for a movie-style
 * destination, which is also the result when folder layouts can't be read.
 * A failure after that point (show or number) throws: an episode must never
 * land movie-style in a TV folder.
 *
 * @param {Object} params
 * @param {string} params.youtubeId
 * @param {Object} params.info - yt-dlp info dict
 * @param {string|null} params.ownerChannelId - YouTube id of the channel that owns the video
 * @param {Object|null} params.channelRecord - The owner's channels row, if tracked
 * @param {boolean} params.channelEnabled - The owner channel is tracked and enabled
 * @param {string} params.uploaderFolderName - Channel folder name yt-dlp wrote in temp
 * @param {string|null} params.resolvedSubfolder - Destination subfolder (null = main folder)
 * @param {string} params.baseDir - Downloads folder
 * @returns {Promise<null|{show: Object, assignment: Object, showDir: string, seasonDir: string, stem: string}>}
 */
async function planEpisode({
  youtubeId, info, ownerChannelId, channelRecord, channelEnabled, uploaderFolderName, resolvedSubfolder, baseDir,
}) {
  let layoutOf;
  try {
    layoutOf = await getLayoutResolver();
  } catch (err) {
    logger.error({ err, youtubeId }, 'Could not read library folder layouts; saving the video movie-style');
    return null;
  }
  if (layoutOf(resolvedSubfolder || '') !== LAYOUT_TV) return null;

  let channelShow = ownerChannelId ? await showStore.findChannelShow(ownerChannelId) : null;
  const folderName = (channelRecord && channelRecord.folder_name) || uploaderFolderName;
  const destination = resolveDestination({
    ownerChannel: {
      channelId: ownerChannelId,
      folderName,
      tracked: Boolean(channelRecord),
      enabled: Boolean(channelEnabled),
    },
    channelShow: channelShow ? showStore.toLocation(channelShow) : null,
    resolvedSubfolder,
    layoutOf,
  });
  if (destination.layout !== LAYOUT_TV) return null;

  // A show left in a folder that has since switched to videos holds no
  // files (the layout change requires that), so it follows the channel.
  if (channelShow && layoutOf(channelShow.library_folder) !== LAYOUT_TV) {
    channelShow = await showStore.relocateChannelShow(channelShow, resolvedSubfolder || '');
  }
  const show = channelShow || await showStore.createChannelShow({
    channelId: ownerChannelId,
    name: (channelRecord && channelRecord.title) || info.channel || info.uploader || folderName,
    folderName,
    libraryFolder: destination.libraryFolder,
  });

  const assignment = await assignDateEpisode({ show, youtubeId, channelId: ownerChannelId, info });
  const showDir = path.join(libraryFolderPath(baseDir, show.library_folder), show.folder_name);
  return {
    show,
    assignment,
    showDir,
    seasonDir: path.join(showDir, seasonFolderName(assignment.season)),
    stem: assignment.fileStem,
  };
}

/**
 * Move a video's files from sourceDir into seasonDir under the episode stem.
 * A file of the same name is replaced through a staging file, so the earlier
 * copy survives a transfer that fails. Only after every move succeeds are the
 * video's other files in the season folder removed: a re-download in another
 * container (.webm) would otherwise become a second version of the episode on
 * Plex and Jellyfin 12.
 *
 * @returns {Promise<string[]>} The moved files' new names
 */
async function moveEpisodeFiles({ sourceDir, youtubeId, seasonDir, stem }) {
  await ensureDirWithRetries(seasonDir, MOVE_RETRY_OPTIONS);

  const moved = [];
  const sources = (await fs.promises.readdir(sourceDir)).filter((file) => isFileForVideo(file, youtubeId));
  for (const file of sources) {
    const target = episodeFileName(file, youtubeId, stem);
    await replaceFileWithRetries(path.join(sourceDir, file), path.join(seasonDir, target), MOVE_RETRY_OPTIONS);
    moved.push(target);
  }

  const movedNames = new Set(moved);
  const leftovers = (await fs.promises.readdir(seasonDir))
    .filter((file) => isFileForVideo(file, youtubeId) && !movedNames.has(file));
  for (const name of leftovers) {
    logger.info({ file: name, seasonDir }, '[Post-Process] Removing an earlier file of this episode');
    await fs.promises.rm(path.join(seasonDir, name), { force: true });
  }
  return moved;
}

/**
 * Air date of a show's earliest numbered episode (tvshow.nfo <premiered>).
 * Date-numbered episode codes sort chronologically.
 */
async function earliestEpisodeDate(showId) {
  const first = await VideoClassification.findOne({
    where: { show_id: showId, status: STATUS_ASSIGNED },
    order: [['season', 'ASC'], ['episode', 'ASC']],
    attributes: ['season', 'episode'],
  });
  return first ? dateFromEpisodeCode(first.season, first.episode) : null;
}

/**
 * Write the episode's <stem>.nfo and refresh the show's tvshow.nfo. Run after
 * the episode's files are in place, so premiered counts this episode.
 *
 * @param {Object} params
 * @param {Object} params.placement - planEpisode's result
 * @param {Object} params.info - yt-dlp info dict (with normalized_rating applied)
 * @param {string|null} [params.showPlot] - Show description (the channel description)
 */
async function writeEpisodeMetadata({ placement, info, showPlot = null }) {
  const { show, assignment, showDir, seasonDir, stem } = placement;
  const episodeXml = buildEpisodeNfo({
    info,
    showTitle: show.name,
    season: assignment.season,
    episode: assignment.episode,
    episodeTitle: assignment.episodeTitle,
  });
  await fs.promises.writeFile(path.join(seasonDir, `${stem}.nfo`), episodeXml, 'utf8');
  await writeTvShowNfoIfChanged(showDir, {
    title: show.name,
    plot: showPlot,
    premiered: await earliestEpisodeDate(show.id),
    externalKey: show.external_key,
  });
}

module.exports = {
  planEpisode,
  moveEpisodeFiles,
  earliestEpisodeDate,
  writeEpisodeMetadata
};
