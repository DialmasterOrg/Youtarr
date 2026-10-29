/**
 * Writes a downloaded video's metadata files at its current location: its NFO
 * (movie or episode), fanart and backdrop copies of its thumbnail, and the
 * art and tvshow.nfo of the channel or show folder it sits in. Input is the
 * video's stored info.json (videoInfoStore), so it works long after the
 * download. The reorganize uses it after moving a video; a "regenerate
 * metadata" maintenance task (#757, #696) can reuse it.
 *
 * Only the post-processor downloads missing channel images; this writes the
 * cached ones.
 */

const fs = require('fs');
const path = require('path');
const configModule = require('./configModule');
const nfoGenerator = require('./nfoGenerator');
const logger = require('../logger');
const { copySyncWithFallback } = require('./filesystem/fileOperations');
const { buildEpisodeNfo, writeTvShowNfoIfChanged, writeSeasonNfo, ID_TYPE_YOUTARR } = require('./tvShows/tvNfo');
const { earliestEpisodeDate, seasonNamesOf } = require('./tvShows/episodePlacement');
const { seasonFolderName } = require('./tvShows/episodeNaming');
const { KIND_TITLE_SHOW } = require('./tvShows/constants');

const POSTER_FILE = 'poster.jpg';
const BACKDROP_FILE = 'backdrop.jpg';

function settings() {
  const config = configModule.getConfig() || {};
  return {
    videoNfo: config.writeVideoNfoFiles !== false,
    fanart: config.writeVideoFanart === true,
    backdrops: config.writeBackdropImages === true,
    posters: config.writeChannelPosters !== false,
  };
}

function stemPath(filePath, suffix) {
  const parsed = path.parse(filePath);
  return path.join(parsed.dir, `${parsed.name}${suffix}`);
}

function copyIfMissing(source, target) {
  if (!fs.existsSync(source) || fs.existsSync(target)) return false;
  copySyncWithFallback(source, target);
  return true;
}

/**
 * Write the NFO and thumbnail copies of one video at its current path.
 *
 * @param {Object} params
 * @param {string} params.videoPath - The video (or MP3) file
 * @param {Object} params.info - Its info dict
 * @param {Object|null} [params.episode] - { showTitle, season, episode, episodeTitle } for a TV episode
 * @returns {Promise<string[]>} Paths written
 */
async function writeVideoSidecars({ videoPath, info, episode = null }) {
  const options = settings();
  const written = [];
  const nfoPath = stemPath(videoPath, '.nfo');

  // Episodes always get their NFO: without it Jellyfin names the episode
  // after the file, SxxEyy included.
  if (episode) {
    await fs.promises.writeFile(nfoPath, buildEpisodeNfo({ info, ...episode }), 'utf8');
    written.push(nfoPath);
  } else if (options.videoNfo && nfoGenerator.writeVideoNfoFile(videoPath, info)) {
    written.push(nfoPath);
  }

  const thumbnail = stemPath(videoPath, '.jpg');
  if (options.fanart && copyIfMissing(thumbnail, stemPath(videoPath, '-fanart.jpg'))) {
    written.push(stemPath(videoPath, '-fanart.jpg'));
  }
  if (options.backdrops && copyIfMissing(thumbnail, stemPath(videoPath, '-backdrop.jpg'))) {
    written.push(stemPath(videoPath, '-backdrop.jpg'));
  }
  return written;
}

/**
 * Copy a channel's cached avatar and banner into a channel or show folder,
 * as the settings ask, without replacing existing files.
 *
 * @param {Object} params
 * @param {string} params.channelId - YouTube channel id whose images to use
 * @param {string} params.folderPath
 * @returns {string[]} Paths written
 */
function writeFolderArt({ channelId, folderPath }) {
  if (!channelId || !folderPath || !fs.existsSync(folderPath)) return [];
  const options = settings();
  const imageDir = configModule.getImagePath();
  const written = [];
  const copy = (source, name) => {
    try {
      if (copyIfMissing(path.join(imageDir, source), path.join(folderPath, name))) {
        written.push(path.join(folderPath, name));
      }
    } catch (err) {
      logger.warn({ err, channelId, folderPath, name }, 'Could not copy channel art');
    }
  };
  if (options.posters) copy(`channelthumb-${channelId}.jpg`, POSTER_FILE);
  if (options.backdrops) copy(`channelbanner-${channelId}.jpg`, BACKDROP_FILE);
  return written;
}

/**
 * Write a show folder's tvshow.nfo (when its content changes) and art.
 *
 * @param {Object} params
 * @param {Object} params.show - tv_shows row
 * @param {string} params.showDir
 * @param {string|null} [params.plot] - Show description (the channel description)
 * @returns {Promise<void>}
 */
async function writeShowMetadata({ show, showDir, plot = null }) {
  if (!fs.existsSync(showDir)) return;
  if (show.kind === KIND_TITLE_SHOW) {
    await writeTitleShowMetadata(show, showDir);
  } else {
    await writeTvShowNfoIfChanged(showDir, {
      title: show.name,
      plot,
      premiered: await earliestEpisodeDate(show.id),
      externalKey: show.external_key,
    });
  }
  writeFolderArt({ channelId: show.channel_id, folderPath: showDir });
}

// A title show is identified by its own key and has the season names the
// user gave it, in tvshow.nfo and each season folder's season.nfo.
async function writeTitleShowMetadata(show, showDir) {
  const namedSeasons = await seasonNamesOf(show.id);
  await writeTvShowNfoIfChanged(showDir, {
    title: show.name, externalKey: show.external_key, idType: ID_TYPE_YOUTARR, namedSeasons,
  });
  for (const entry of await fs.promises.readdir(showDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const match = /^Season (\d+)$/.exec(entry.name);
    if (!match || seasonFolderName(Number(match[1])) !== entry.name) continue;
    const season = Number(match[1]);
    await writeSeasonNfo(path.join(showDir, entry.name), { season, name: namedSeasons[season] || null });
  }
}

module.exports = {
  writeVideoSidecars,
  writeFolderArt,
  writeShowMetadata
};
