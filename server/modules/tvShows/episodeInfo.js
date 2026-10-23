/**
 * Episode details for listing and detail responses: the show and SxxEyy of a
 * downloaded video, when its file is an episode.
 */

const path = require('path');
const VideoClassification = require('../../models/videoclassification');
const TvShow = require('../../models/tvshow');
const { STATUS_ASSIGNED, SOURCE_DATE } = require('./episodeAllocator');
const { episodeCode } = require('./episodeNaming');

/**
 * @param {Array<{youtubeId: string, filePath: string|null}>} videos
 * @returns {Promise<Map<string, {showName: string, season: number, episode: number, code: string}>>}
 *   Only videos whose file is named as the stored episode: a classification
 *   kept after a channel moved back to Videos must not label a movie-style file.
 */
async function getEpisodeInfoMap(videos) {
  const result = new Map();
  const withFiles = (videos || []).filter((video) => video && video.youtubeId && video.filePath);
  if (withFiles.length === 0) return result;

  const rows = await VideoClassification.findAll({
    where: { youtube_id: withFiles.map((video) => video.youtubeId), status: STATUS_ASSIGNED },
    attributes: ['youtube_id', 'show_id', 'season', 'episode', 'source', 'file_stem'],
  });
  if (rows.length === 0) return result;
  const shows = await TvShow.findAll({
    where: { id: [...new Set(rows.map((row) => row.show_id))] },
    attributes: ['id', 'name'],
  });
  const showNames = new Map(shows.map((show) => [show.id, show.name]));
  const rowsById = new Map(rows.map((row) => [row.youtube_id, row]));

  for (const video of withFiles) {
    const row = rowsById.get(video.youtubeId);
    if (!row || row.season === null || row.episode === null || !row.file_stem) continue;
    if (!path.basename(video.filePath).startsWith(row.file_stem)) continue;
    result.set(video.youtubeId, {
      showName: showNames.get(row.show_id) || null,
      season: row.season,
      episode: row.episode,
      code: episodeCode({ season: row.season, episode: row.episode, dateNumbered: row.source === SOURCE_DATE }),
    });
  }
  return result;
}

module.exports = {
  getEpisodeInfoMap
};
