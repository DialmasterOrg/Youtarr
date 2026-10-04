/**
 * Moves one video of a reorganize. Every step can run again after a restart:
 * a file already at its destination counts as moved, the NFO is rewritten,
 * and the database update is skipped when the row already has the new paths.
 *
 * Order: the episode number is stored first (so it is held), then every
 * file moves (a failure part-way moves the earlier files back), then the
 * NFO and art are written, the old NFO removed, the videos row and the
 * stored info.json updated, and emptied source folders removed.
 */

const fs = require('fs');
const path = require('path');
const Video = require('../../models/video');
const VideoClassification = require('../../models/videoclassification');
const configModule = require('../configModule');
const logger = require('../../logger');
const videoInfoStore = require('../videoInfoStore');
const sidecarWriter = require('../sidecarWriter');
const { unchangedSinceRead, GUARDED_COLUMNS } = require('../videoRowGuard');
const { moveFileNoClobber } = require('../filesystem/fileOperations');
const { isDirectoryEffectivelyEmpty, removeDirectoryResilient, isVideoDirectoryFor } = require('../filesystem/directoryManager');
const { resolveLibraryFolder, locateEpisodeFolders, cleanupEmptyShowFolders } = require('../filesystem/showFolderCleanup');
const { LAYOUT_TV } = require('../tvShows/constants');
const { STATUS_ASSIGNED } = require('../tvShows/episodeAllocator');

function itemError(message) {
  return new Error(message);
}

// A failure after the files reached their destination: the runner must treat
// the video as moved (its settings and holds stay), and a retry finishes it.
// (A failure before the files were touched leaves `filesMoved` unset, and the
// runner keeps what it already knows about them.)
function movedButUnfinished(err) {
  const wrapped = new Error(`The video's files were moved, but finishing failed: ${err.message}. Retry to finish.`);
  wrapped.filesMoved = true;
  wrapped.cause = err;
  return wrapped;
}

function nfoPathOf(filePath) {
  const parsed = path.parse(filePath);
  return path.join(parsed.dir, `${parsed.name}.nfo`);
}

// The planner already refuses these; checked again here, where the files move.
function assertInsideDownloads(files) {
  const baseDir = configModule.directoryPath;
  for (const file of files) {
    const relative = path.relative(baseDir, file.to);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
      throw itemError('The destination is outside the downloads folder.');
    }
  }
}

async function loadVideo(videoId) {
  return Video.findByPk(videoId, {
    attributes: ['id', 'youtubeId', 'youTubeVideoName', 'youTubeChannelName', 'originalDate', ...GUARDED_COLUMNS, 'removed'],
    raw: true,
  });
}

async function storeClassification(youtubeId, classification, showId) {
  const values = {
    channel_id: classification.ownerChannelId,
    show_id: showId,
    status: STATUS_ASSIGNED,
    season: classification.season,
    episode: classification.episode,
    source: classification.source,
    timestamp_source: classification.timestampSource || null,
    pattern_id: null,
    episode_title: classification.episodeTitle,
    file_stem: classification.fileStem,
  };
  const row = await VideoClassification.findByPk(youtubeId);
  if (row) {
    await row.update(values);
  } else {
    await VideoClassification.create({ youtube_id: youtubeId, ...values });
  }
}

async function statOrNull(filePath) {
  try {
    return await fs.promises.stat(filePath);
  } catch (err) {
    if (err.code === 'ENOENT' || err.code === 'ENOTDIR') return null;
    throw err;
  }
}

// A file whose source is gone while its destination exists is at the destination.
async function anyFileAtDestination(files) {
  for (const file of files) {
    if (!(await statOrNull(file.from)) && (await statOrNull(file.to))) return true;
  }
  return false;
}

/**
 * Move every file. On a failure, every file at its destination goes back:
 * the ones this attempt moved and the ones an earlier, interrupted attempt
 * left there, so the video is either moved or home, never split. The error
 * then says where the files are (`filesMoved` true: some file could not be
 * brought back; false: every file is back at its source).
 *
 * @param {Array<{from: string, to: string}>} files
 * @param {Set<string>} mediaPaths - The video/audio sources; a sidecar that
 *   vanished since the preview is nothing to move, the media must be there
 */
async function moveFiles(files, mediaPaths) {
  const atDestination = [];
  try {
    for (const file of files) {
      try {
        const result = await moveFileNoClobber(file.from, file.to);
        if (result === 'moved' || result === 'already-moved') atDestination.push(file);
      } catch (err) {
        if (err.code !== 'ENOENT' || mediaPaths.has(file.from)) throw err;
        logger.warn({ file: file.from }, 'A file of the video is gone since the preview; moving the rest');
      }
    }
  } catch (err) {
    for (const file of atDestination.reverse()) {
      try {
        await moveFileNoClobber(file.to, file.from);
      } catch (rollbackErr) {
        logger.error({ err: rollbackErr, from: file.to, to: file.from }, 'Could not move a file back after a failed reorganize move');
      }
    }
    err.filesMoved = await anyFileAtDestination(files);
    throw err;
  }
}

async function removeOldNfos(nfoSources, keep) {
  for (const nfo of nfoSources) {
    if (nfo === keep) continue;
    await fs.promises.rm(nfo, { force: true });
  }
}

async function updateRow(video, plan) {
  const atNew = video.filePath === plan.newVideoPath && video.audioFilePath === plan.newAudioPath;
  if (atNew) return;
  const [affected] = await Video.update(
    { filePath: plan.newVideoPath, audioFilePath: plan.newAudioPath },
    { where: unchangedSinceRead(video) }
  );
  if (affected === 0) {
    throw itemError('The video changed while its files were moving; the next rescan corrects its path.');
  }
}

// Remove the per-video folder or the season and show folders the video left.
async function cleanupSources(plan, youtubeId) {
  const baseDir = configModule.directoryPath;
  for (const dir of plan.sourceDirs) {
    if (plan.fromLayout === LAYOUT_TV) {
      const located = resolveLibraryFolder(dir, baseDir);
      const folders = located ? locateEpisodeFolders(path.join(dir, 'file'), located.libraryRoot) : null;
      if (folders) await cleanupEmptyShowFolders(folders);
      continue;
    }
    if (isVideoDirectoryFor(dir, youtubeId, baseDir) && await isDirectoryEffectivelyEmpty(dir)) {
      await removeDirectoryResilient(dir);
    }
  }
}

/**
 * Move one video.
 *
 * @param {Object} record - tv_reorganize_items row
 * @param {Object} params
 * @param {(ownerChannelId: string) => number|null} params.showIdFor - The pinned show of an owner channel
 * @returns {Promise<void>} Throws with a user-facing message when the video can't move
 */
async function executeItem(record, { showIdFor }) {
  const plan = JSON.parse(record.files);
  const classification = record.classification ? JSON.parse(record.classification) : null;

  const video = await loadVideo(record.video_id);
  if (!video) throw itemError('The video is no longer in the library.');
  if (video.removed) throw itemError('The video was marked missing.');
  const atOld = video.filePath === plan.oldVideoPath && video.audioFilePath === plan.oldAudioPath;
  const atNew = video.filePath === plan.newVideoPath && video.audioFilePath === plan.newAudioPath;
  if (!atOld && !atNew) throw itemError('The video\'s files changed since the preview.');
  assertInsideDownloads(plan.files);

  if (classification) {
    const showId = showIdFor(classification.ownerChannelId);
    if (!showId) throw itemError('The video\'s show could not be found.');
    await storeClassification(record.youtube_id, classification, showId);
  }

  await moveFiles(plan.files, new Set([plan.oldVideoPath, plan.oldAudioPath].filter(Boolean)));

  const mediaPath = plan.newVideoPath || plan.newAudioPath;
  try {
    const info = await videoInfoStore.readInfoOrFallback(video);
    await sidecarWriter.writeVideoSidecars({
      videoPath: mediaPath,
      info,
      episode: classification
        ? { showTitle: classification.showTitle, season: classification.season, episode: classification.episode, episodeTitle: classification.episodeTitle }
        : null,
    });
    await removeOldNfos(plan.nfoSources, nfoPathOf(mediaPath));
    await updateRow(video, plan);
    await videoInfoStore.rewriteActualPaths(record.youtube_id, new Map(plan.files.map((file) => [file.from, file.to])));
  } catch (err) {
    throw movedButUnfinished(err);
  }
  try {
    await cleanupSources(plan, record.youtube_id);
  } catch (err) {
    logger.warn({ err, youtubeId: record.youtube_id }, 'Could not remove folders a moved video left behind');
  }
}

module.exports = {
  executeItem
};
