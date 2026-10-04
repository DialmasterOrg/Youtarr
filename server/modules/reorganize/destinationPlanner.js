/**
 * Every file move of a reorganize. For each video: its destination folder and
 * file stem (an episode stem in a TV show, or the movie-style names a fresh
 * download would get), its episode assignment, and each of its files' source
 * and destination. Nothing is written; the result feeds the preview and,
 * recomputed under the lock, the operation.
 *
 * Numbering matches the post-processor's: a video keeps a number it already
 * holds in the show; otherwise files named by the Plex TV Series preset keep
 * their code when it is free, and the rest are numbered by upload time.
 */

const fs = require('fs');
const path = require('path');
const configModule = require('../configModule');
const VideoClassification = require('../../models/videoclassification');
const videoInfoStore = require('../videoInfoStore');
const downloadSettingsResolver = require('../download/downloadSettingsResolver');
const { isFileForVideo, buildChannelPath } = require('../filesystem/pathBuilder');
const { NO_CLOBBER_STAGING_SUFFIX } = require('../filesystem/fileOperations');
const { YOUTUBE_ID_BRACKET_PATTERN } = require('../filesystem/constants');
const { LAYOUT_TV, folderKey } = require('../tvShows/constants');
const { STATUS_ASSIGNED } = require('../tvShows/episodeAllocator');
const { releaseTime, parseDateEpisodeCode, assignDateEpisodes, SOURCE_UPLOAD_DATE } = require('../tvShows/dateNumbering');
const { buildEpisodeStem, episodeFileName, seasonFolderName } = require('../tvShows/episodeNaming');
const { renderMovieNames } = require('./movieNameRenderer');
const { plannedShowDirectory } = require('./showPlanner');
const { PROBLEM, FLAG, CHANGE_FOLDER_LAYOUT } = require('./constants');

// Partial downloads and copies left by an interrupted move are not the video's files.
const LEFTOVER_SUFFIXES = ['.part', NO_CLOBBER_STAGING_SUFFIX];
const MOVIE_TAG_EXTENSIONS = new Set(['.mp4', '.m4v', '.mov']);

// The files of each directory a plan reads, bucketed by the video id in
// their name, read once per plan: a flat channel folder holds every file of
// thousands of videos, and listing it once per video made planning
// quadratic.
class DirectoryIndex {
  constructor() {
    this.byDir = new Map();
  }

  async namesFor(dir, youtubeId) {
    let byId = this.byDir.get(dir);
    if (!byId) {
      byId = new Map();
      for (const name of await fs.promises.readdir(dir)) {
        const match = YOUTUBE_ID_BRACKET_PATTERN.exec(name);
        if (!match) continue;
        if (!byId.has(match[1])) byId.set(match[1], []);
        byId.get(match[1]).push(name);
      }
      this.byDir.set(dir, byId);
    }
    return (byId.get(youtubeId) || []).filter((name) => isFileForVideo(name, youtubeId)
      && !LEFTOVER_SUFFIXES.some((suffix) => name.endsWith(suffix)));
  }
}

async function statFile(filePath) {
  try {
    const stat = await fs.promises.stat(filePath);
    return { size: stat.size, mtimeMs: Math.trunc(stat.mtimeMs) };
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

async function existsOtherThan(target, source) {
  if (target === source) return false;
  return (await statFile(target)) !== null;
}

/**
 * Plan the files of one video given its destination folder and stem.
 * @param {Object} video - videos row
 * @param {string} destDir
 * @param {string} stem
 * @param {DirectoryIndex} [index] - Shared across the videos of one plan
 * @returns {Promise<Object>} { files, nfoSources, newVideoPath, newAudioPath, unchanged, missing, collisions }
 */
async function planFiles(video, destDir, stem, index = new DirectoryIndex()) {
  const sourceDirs = [...new Set([video.filePath, video.audioFilePath].filter(Boolean).map((p) => path.dirname(p)))];
  const files = [];
  const nfoSources = [];
  for (const dir of sourceDirs) {
    let names;
    try {
      names = await index.namesFor(dir, video.youtubeId);
    } catch (err) {
      if (err.code === 'ENOENT') return { missing: true };
      throw err;
    }
    for (const name of names) {
      const from = path.join(dir, name);
      // The NFO is written fresh for the new layout.
      if (name.endsWith('.nfo')) {
        nfoSources.push(from);
        continue;
      }
      if (files.some((file) => file.from === from)) continue;
      const stat = await statFile(from);
      if (!stat) continue;
      files.push({ from, to: path.join(destDir, episodeFileName(name, video.youtubeId, stem)), ...stat });
    }
  }
  const mediaPath = video.filePath || video.audioFilePath;
  if (!files.some((file) => file.from === mediaPath)) return { missing: true };

  const destinationOf = (source) => (source ? (files.find((file) => file.from === source) || {}).to || null : null);
  const collisions = [];
  for (const file of files) {
    if (await existsOtherThan(file.to, file.from)) collisions.push(file.to);
  }
  return {
    files,
    nfoSources,
    sourceDirs,
    newVideoPath: destinationOf(video.filePath),
    newAudioPath: destinationOf(video.audioFilePath),
    unchanged: files.every((file) => file.to === file.from),
    collisions,
  };
}

async function storedClassifications(subjects) {
  const ids = subjects.map((subject) => subject.video.youtubeId);
  if (ids.length === 0) return new Map();
  const rows = await VideoClassification.findAll({ where: { youtube_id: ids } });
  return new Map(rows.map((row) => [row.youtube_id, row]));
}

async function takenNumbers(showId, excludedIds) {
  const taken = new Map();
  if (!showId) return taken;
  const rows = await VideoClassification.findAll({ where: { show_id: showId }, attributes: ['youtube_id', 'season', 'episode'] });
  for (const row of rows) {
    if (excludedIds.has(row.youtube_id) || row.season === null || row.episode === null) continue;
    if (!taken.has(row.season)) taken.set(row.season, new Set());
    taken.get(row.season).add(row.episode);
  }
  return taken;
}

function episodeTitleOf(info, video) {
  return String(info.fulltitle || info.title || video.youTubeVideoName || '').trim() || null;
}

function assignment(youtubeId, { season, episode, source, timestampSource, episodeTitle }, show) {
  return {
    ownerChannelId: show.ownerChannelId,
    showTitle: show.name,
    season,
    episode,
    source,
    timestampSource,
    episodeTitle,
    fileStem: buildEpisodeStem({ season, episode, dateNumbered: true, videoTitle: episodeTitle, youtubeId }),
  };
}

/**
 * Episode assignments for the videos going to one show.
 * @returns {Promise<{assignments: Map<string, Object>, flags: Map<string, string[]>, noDate: Set<string>}>}
 */
async function numberShow(show, entries, stored) {
  const assignments = new Map();
  const flags = new Map();
  const noDate = new Set();
  const toNumber = [];

  for (const { subject, info } of entries) {
    const { video } = subject;
    const row = stored.get(video.youtubeId);
    if (show.showId && row && row.show_id === show.showId && row.status === STATUS_ASSIGNED
      && row.season !== null && row.episode !== null && row.file_stem) {
      assignments.set(video.youtubeId, {
        ownerChannelId: show.ownerChannelId, showTitle: show.name, season: row.season, episode: row.episode,
        source: row.source, timestampSource: row.timestamp_source, episodeTitle: row.episode_title, fileStem: row.file_stem,
      });
      continue;
    }
    const adoptedCode = parseDateEpisodeCode(path.basename(video.filePath || video.audioFilePath));
    let numberingInfo = info;
    const itemFlags = [];
    const time = releaseTime(info);
    if (!adoptedCode && !time) {
      if (!video.last_downloaded_at) {
        noDate.add(video.youtubeId);
        continue;
      }
      // Like the post-processor: no upload time, so the download time.
      numberingInfo = { ...info, timestamp: Math.floor(new Date(video.last_downloaded_at).getTime() / 1000) };
      itemFlags.push(FLAG.DOWNLOAD_TIME);
    } else if (!adoptedCode && time.source === SOURCE_UPLOAD_DATE) {
      itemFlags.push(FLAG.UPLOAD_DATE_ONLY);
    }
    flags.set(video.youtubeId, itemFlags);
    toNumber.push({ youtubeId: video.youtubeId, info: numberingInfo, adoptedCode, video, title: episodeTitleOf(info, video) });
  }

  const taken = await takenNumbers(show.showId, new Set(toNumber.map((entry) => entry.youtubeId)));
  for (const kept of assignments.values()) {
    if (!taken.has(kept.season)) taken.set(kept.season, new Set());
    taken.get(kept.season).add(kept.episode);
  }
  const { assigned } = assignDateEpisodes(toNumber, taken);
  const byId = new Map(toNumber.map((entry) => [entry.youtubeId, entry]));
  for (const result of assigned) {
    const entry = byId.get(result.youtubeId);
    const downloadTime = flags.get(result.youtubeId).includes(FLAG.DOWNLOAD_TIME);
    if (result.source === 'adopted') flags.get(result.youtubeId).push(FLAG.ADOPTED);
    assignments.set(result.youtubeId, assignment(result.youtubeId, {
      season: result.season,
      episode: result.episode,
      source: result.source,
      timestampSource: downloadTime ? null : result.timestampSource,
      episodeTitle: entry.title,
    }, show));
  }
  return { assignments, flags, noDate };
}

function problemOf(subject, kind, detail = null) {
  const { video } = subject;
  return { videoId: video.id, youtubeId: video.youtubeId, title: video.youTubeVideoName, problem: kind, detail };
}

// A destination must stay inside the downloads folder, whatever name a
// channel or rendered template contributed to it.
function isInside(baseDir, dir) {
  const relative = path.relative(baseDir, dir);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

/**
 * Plan every video's move.
 *
 * @param {Object} params
 * @param {Array<Object>} params.subjects - changeScope subjects
 * @param {Object} params.context - resolved change
 * @param {Map<number, {libraryFolder: string, layout: string}>} params.targets - showPlanner targets
 * @param {Map<string, Object>} params.shows - showPlanner shows by owner channel id
 * @returns {Promise<{items: Array<Object>, problems: Array<Object>, unchanged: number}>}
 */
async function planDestinations({ subjects, context, targets, shows }) {
  const config = configModule.getConfig() || {};
  const baseDir = configModule.directoryPath;
  const infos = new Map();
  for (const subject of subjects) infos.set(subject.video.youtubeId, await videoInfoStore.readInfoOrFallback(subject.video));

  const tvEntries = new Map();
  const movieSubjects = [];
  for (const subject of subjects) {
    const target = targets.get(subject.video.id);
    if (target.layout === LAYOUT_TV) {
      const owner = subject.ownerChannelId;
      if (!tvEntries.has(owner)) tvEntries.set(owner, []);
      tvEntries.get(owner).push({ subject, info: infos.get(subject.video.youtubeId) });
    } else {
      movieSubjects.push(subject);
    }
  }

  const stored = await storedClassifications(subjects);
  const assignments = new Map();
  const flags = new Map();
  const noDate = new Set();
  for (const [owner, entries] of tvEntries) {
    const numbered = await numberShow(shows.get(owner), entries, stored);
    for (const [id, value] of numbered.assignments) assignments.set(id, value);
    for (const [id, value] of numbered.flags) flags.set(id, value);
    for (const id of numbered.noDate) noDate.add(id);
  }
  const names = await renderMovieNames(movieSubjects.map((subject) => ({
    youtubeId: subject.video.youtubeId, info: infos.get(subject.video.youtubeId),
  })));

  const items = [];
  const problems = [];
  let unchanged = 0;
  const index = new DirectoryIndex();
  for (const subject of subjects) {
    const { video } = subject;
    const target = targets.get(video.id);
    let destDir;
    let stem;
    let classification = null;
    if (target.layout === LAYOUT_TV) {
      if (noDate.has(video.youtubeId)) {
        problems.push(problemOf(subject, PROBLEM.NO_DATE));
        continue;
      }
      classification = assignments.get(video.youtubeId);
      stem = classification.fileStem;
      destDir = path.join(plannedShowDirectory(shows.get(subject.ownerChannelId)), seasonFolderName(classification.season));
    } else {
      const rendered = names.get(video.youtubeId);
      if (!rendered) {
        problems.push(problemOf(subject, PROBLEM.NO_NAME));
        continue;
      }
      // The channel's folder as downloads name it (folder_name is yt-dlp's
      // sanitized name); a channel row without one gets the rendered name,
      // never the raw uploader, which can hold path separators.
      const channelFolder = (subject.ownerChannel && subject.ownerChannel.folder_name) || rendered.channelFolder;
      const flat = downloadSettingsResolver.resolveSkipVideoFolder({ channel: subject.ownerChannel, config });
      let channelDir;
      try {
        channelDir = buildChannelPath(baseDir, target.libraryFolder || null, channelFolder);
      } catch (err) {
        // buildChannelPath refuses a path that leaves the downloads folder.
        problems.push(problemOf(subject, PROBLEM.UNSAFE_NAME));
        continue;
      }
      destDir = flat ? channelDir : path.join(channelDir, rendered.videoFolder);
      stem = rendered.stem;
    }
    if (!isInside(baseDir, destDir)) {
      problems.push(problemOf(subject, PROBLEM.UNSAFE_NAME));
      continue;
    }

    const planned = await planFiles(video, destDir, stem, index);
    if (planned.missing) {
      problems.push(problemOf(subject, PROBLEM.MISSING));
      continue;
    }
    if (planned.unchanged) {
      unchanged += 1;
      continue;
    }
    const itemFlags = [...(flags.get(video.youtubeId) || [])];
    if (context.type !== CHANGE_FOLDER_LAYOUT && subject.ownerChannel
      && folderKey(subject.libraryFolder) !== folderKey(context.folderBefore(subject.ownerChannel))) {
      itemFlags.push(FLAG.OVERRIDE_PLACED);
    }
    if (classification && subject.currentLayout !== LAYOUT_TV
      && planned.files.some((file) => file.from === video.filePath && MOVIE_TAG_EXTENSIONS.has(path.extname(file.from).toLowerCase()))) {
      itemFlags.push(FLAG.MOVIE_TAGS);
    }
    for (const collision of planned.collisions) problems.push(problemOf(subject, PROBLEM.COLLISION, collision));

    items.push({
      videoId: video.id,
      youtubeId: video.youtubeId,
      channelId: subject.ownerChannelId,
      title: video.youTubeVideoName,
      fromLibraryFolder: subject.libraryFolder,
      fromLayout: subject.currentLayout,
      libraryFolder: target.libraryFolder,
      layout: target.layout,
      destDir,
      files: planned.files,
      nfoSources: planned.nfoSources,
      sourceDirs: planned.sourceDirs,
      oldVideoPath: video.filePath || null,
      newVideoPath: planned.newVideoPath,
      oldAudioPath: video.audioFilePath || null,
      newAudioPath: planned.newAudioPath,
      classification,
      flags: itemFlags,
    });
  }
  items.sort((a, b) => (a.youtubeId < b.youtubeId ? -1 : a.youtubeId > b.youtubeId ? 1 : 0));
  return { items, problems, unchanged };
}

module.exports = {
  planDestinations,
  planFiles,
  numberShow
};
