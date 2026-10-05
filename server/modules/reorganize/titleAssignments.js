/**
 * Episode numbers and file stems of downloaded videos a reorganize moves into
 * a title show. Numbers the title plan already decided are used as they are;
 * a video waiting for an upload-time number (year seasons, date episodes) is
 * numbered from its stored info.json the way the post-processor would.
 */

const { releaseTime, dateEpisodeFor, allocateEpisode, SOURCE_UPLOAD_DATE } = require('../tvShows/dateNumbering');
const { buildEpisodeStem } = require('../tvShows/episodeNaming');
const { SEASON_SOURCE, EPISODE_SOURCE } = require('../tvShows/patternCompiler');
const { ROW_STATUS, SOURCE } = require('../tvShows/titleNumbering');
const { KIND_TITLE_SHOW } = require('../tvShows/constants');
const { FLAG } = require('./constants');

function setOf(map, key) {
  if (!map.has(key)) map.set(key, new Set());
  return map.get(key);
}

// The upload time, else the download time (as the post-processor does).
function timeOf(entry) {
  const release = releaseTime(entry.info || {});
  if (release) return release;
  const downloaded = entry.downloadedAt ? Math.floor(new Date(entry.downloadedAt).getTime() / 1000) : null;
  return Number.isFinite(downloaded) ? { epochSeconds: downloaded, source: null, downloadTime: true } : null;
}

/**
 * @param {Object} params
 * @param {Object} params.show - Planned title show { key, name, ownerChannelId }
 * @param {Array<Object>} params.entries - { youtubeId, title, info, downloadedAt, after, pattern, stored }
 *   after: the title plan's row; pattern: its { seasonSource, episodeSource }; stored: the video's stored row
 * @param {Map<number, Set<number>>} params.taken - Numbers other videos hold in the show after the change, by season
 * @param {Map<number, number>} params.highWater - Order high-water marks by season
 * @returns {{assignments: Map<string, Object>, flags: Map<string, string[]>, noDate: Set<string>, taken: Set<string>}}
 *   flags: the review's notes on how a waiting video was numbered (download time, upload day);
 *   taken: videos whose title number another video holds
 */
function assignTitleEpisodes({ show, entries, taken, highWater }) {
  const assignments = new Map();
  const flags = new Map();
  const noDate = new Set();
  const numberTaken = new Set();
  const held = new Map([...taken].map(([season, numbers]) => [season, new Set(numbers)]));
  const marks = new Map(highWater);

  const classification = (entry, { season, episode, source, timestampSource = null }) => {
    const { stored } = entry;
    // A number that stays keeps its time source and its stem, as the row writer does.
    const keepsNumber = Boolean(stored) && stored.showKey === show.key && stored.season === season && stored.episode === episode;
    return {
      showKey: show.key,
      kind: KIND_TITLE_SHOW,
      ownerChannelId: show.ownerChannelId,
      showTitle: show.name,
      season,
      episode,
      source,
      timestampSource: keepsNumber ? stored.timestampSource ?? null : timestampSource,
      episodeTitle: entry.after.episodeTitle || entry.title || null,
      fileStem: keepsNumber && stored.fileStem ? stored.fileStem : buildEpisodeStem({
        season, episode, dateNumbered: source === SOURCE.DATE, episodeTitle: entry.after.episodeTitle, videoTitle: entry.title, youtubeId: entry.youtubeId,
      }),
    };
  };

  const pending = [];
  for (const entry of entries) {
    if (entry.after.status === ROW_STATUS.ASSIGNED) {
      assignments.set(entry.youtubeId, classification(entry, entry.after));
      continue;
    }
    const time = timeOf(entry);
    if (!time) {
      noDate.add(entry.youtubeId);
      continue;
    }
    pending.push({ entry, time });
  }

  pending.sort((a, b) => (a.time.epochSeconds - b.time.epochSeconds) || (a.entry.youtubeId < b.entry.youtubeId ? -1 : 1));
  for (const { entry, time } of pending) {
    const dated = dateEpisodeFor(time.epochSeconds);
    const season = entry.pattern.seasonSource === SEASON_SOURCE.YEAR ? dated.season : entry.after.season;
    const numbers = setOf(held, season);
    let episode;
    let source;
    if (entry.pattern.episodeSource === EPISODE_SOURCE.DATE) {
      episode = allocateEpisode(dated.episode, numbers);
      source = SOURCE.DATE;
    } else if (entry.pattern.episodeSource === EPISODE_SOURCE.TITLE) {
      const titleEpisode = entry.after.titleEpisode ?? entry.after.episode;
      if (numbers.has(titleEpisode)) {
        numberTaken.add(entry.youtubeId);
        continue;
      }
      episode = titleEpisode;
      source = SOURCE.TITLE;
    } else {
      episode = (marks.get(season) || 0) + 1;
      while (numbers.has(episode)) episode += 1;
      marks.set(season, episode);
      source = SOURCE.ORDER;
    }
    numbers.add(episode);
    assignments.set(entry.youtubeId, classification(entry, {
      season, episode, source, timestampSource: source === SOURCE.DATE ? time.source : null,
    }));
    // An upload day settles a year season but not a date episode's time.
    if (time.downloadTime) flags.set(entry.youtubeId, [FLAG.DOWNLOAD_TIME]);
    else if (source === SOURCE.DATE && time.source === SOURCE_UPLOAD_DATE) flags.set(entry.youtubeId, [FLAG.UPLOAD_DATE_ONLY]);
  }
  return { assignments, flags, noDate, taken: numberTaken };
}

module.exports = {
  assignTitleEpisodes
};
