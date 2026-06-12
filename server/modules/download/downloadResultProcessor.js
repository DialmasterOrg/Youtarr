// Result processing for a finished yt-dlp run: which URLs the run covered,
// which videos succeeded vs failed, and archive reconciliation so failed
// videos can be retried. No job persistence or WebSocket emission here.
const fs = require('fs');
const logger = require('../../logger');
const archiveModule = require('../archiveModule');
const { isSpecificUrlDownloadJob } = require('./jobTypes');

function getCountOfDownloadedVideos() {
  return archiveModule.readCompleteListLines().length;
}

function getNewVideoUrls(initialCount) {
  return archiveModule.getNewVideoUrlsSince(initialCount);
}

// Specific-URL jobs normalize to youtu.be form; otherwise diff the archive against the pre-run count.
function resolveUrlsToProcess(jobType, originalUrls, initialCount) {
  let urlsToProcess;
  if (isSpecificUrlDownloadJob(jobType) && originalUrls) {
    urlsToProcess = originalUrls.map(url => {
      // Convert full YouTube URLs to youtu.be format for consistency
      if (url.includes('youtube.com/watch?v=')) {
        const videoId = url.split('v=')[1].split('&')[0];
        logger.debug({ url, convertedUrl: `https://youtu.be/${videoId}` }, 'Converting YouTube URL format');
        return `https://youtu.be/${videoId}`;
      }
      return url;
    });
  } else {
    urlsToProcess = getNewVideoUrls(initialCount);
  }
  return urlsToProcess;
}

// Backfills URLs into errorTracker.failedVideos (read later by reconcileArchive),
// then splits videoData into successful vs failed by file presence.
function partitionDownloadResults(videoData, errorTracker, urlsToProcess) {
  for (const url of urlsToProcess) {
    const videoId = url.split('youtu.be/')[1]?.trim().split('?')[0].split('&')[0];
    if (videoId && errorTracker.failedVideos.has(videoId)) {
      const failureInfo = errorTracker.failedVideos.get(videoId);
      failureInfo.url = url;
      errorTracker.failedVideos.set(videoId, failureInfo);
    }
  }

  const successfulVideos = [];
  const failedVideosList = [];

  for (const video of videoData) {
    // Check if this video was explicitly marked as failed during download
    const wasMarkedFailed = errorTracker.failedVideos.has(video.youtubeId);

    // Check if video or audio file actually exists and has size
    // For video_mp3 mode: both fileSize and audioFileSize will be set
    // For mp3_only mode: only audioFileSize will be set
    // For standard video: only fileSize will be set
    const hasVideoFile = video.fileSize && video.fileSize !== 'null' && video.fileSize !== '0';
    const hasAudioFile = video.audioFileSize && video.audioFileSize !== 'null' && video.audioFileSize !== '0';
    const hasAnyFile = hasVideoFile || hasAudioFile;

    if (wasMarkedFailed || !hasAnyFile) {
      const failureInfo = errorTracker.failedVideos.get(video.youtubeId) || {
        youtubeId: video.youtubeId,
        error: hasAnyFile ? 'Unknown error' : 'Media file not found or incomplete',
        url: urlsToProcess.find(u => u.includes(video.youtubeId))
      };

      failedVideosList.push({
        youtubeId: video.youtubeId,
        title: video.youTubeVideoName,
        channel: video.youTubeChannelName,
        error: failureInfo.error,
        url: failureInfo.url
      });

      logger.warn({
        youtubeId: video.youtubeId,
        error: failureInfo.error,
        hasVideoFile,
        hasAudioFile
      }, 'Download failed');
    } else {
      successfulVideos.push(video);
    }
  }

  // For any videos in failedVideos that weren't in videoData, add them to failedVideosList
  for (const [youtubeId, failureInfo] of errorTracker.failedVideos) {
    if (!videoData.find(v => v.youtubeId === youtubeId)) {
      failedVideosList.push({
        youtubeId: youtubeId,
        title: 'Unknown',
        channel: 'Unknown',
        error: failureInfo.error,
        url: failureInfo.url
      });
      logger.warn({ youtubeId, error: failureInfo.error }, 'Video failed without metadata');
    }
  }

  return { successfulVideos, failedVideosList };
}

async function reconcileArchive({ allowRedownload, failedVideosList, videoData, errorTracker }) {
  // Remove failed videos from the yt-dlp archive so they can be retried on the next run.
  // yt-dlp writes to the archive BEFORE calling --exec (the post-processor), so when
  // the post-processor fails (e.g. EACCES on NFS move), the video is stuck as archived
  // but never actually made it to the final location. Without this cleanup, the video
  // would be permanently skipped with "already been recorded in the archive".
  if (!allowRedownload && failedVideosList.length > 0) {
    for (const failedVideo of failedVideosList) {
      if (failedVideo.youtubeId) {
        // Only remove from archive if the video was explicitly marked as failed during download.
        // Videos classified as "failed" solely because stat/waitForFile couldn't confirm the file
        // (e.g. NFS lag) may actually exist on disk; removing them would cause spurious re-downloads.
        const wasExplicitlyFailed = errorTracker.failedVideos.has(failedVideo.youtubeId);
        if (!wasExplicitlyFailed) {
          logger.info({ youtubeId: failedVideo.youtubeId }, 'Skipping archive removal - video was not explicitly failed (file may exist but stat failed)');
          continue;
        }
        const removed = await archiveModule.removeVideoFromArchive(failedVideo.youtubeId);
        if (removed) {
          logger.info({ youtubeId: failedVideo.youtubeId }, 'Removed failed video from archive for retry on next run');
        }
      }
    }
  }

  // If allowRedownload is true, we need to manually update the archive since yt-dlp won't
  if (allowRedownload && videoData.length > 0) {
    logger.debug({ videoCount: videoData.length }, 'Updating archive for videos (allowRedownload was true)');

    for (const video of videoData) {
      // Check for either video file or audio file (supports mp3_only mode)
      const fileToCheck = video.filePath || video.audioFilePath;
      if (video.youtubeId && fileToCheck) {
        // Only add to archive if the file actually exists (was successfully downloaded)
        if (fs.existsSync(fileToCheck)) {
          await archiveModule.addVideoToArchive(video.youtubeId);
        } else {
          logger.debug({ youtubeId: video.youtubeId }, 'Skipping archive update - file not found');
        }
      }
    }
  }
}

module.exports = {
  getCountOfDownloadedVideos,
  getNewVideoUrls,
  resolveUrlsToProcess,
  partitionDownloadResults,
  reconcileArchive,
};
