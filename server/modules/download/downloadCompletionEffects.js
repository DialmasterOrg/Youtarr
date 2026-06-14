// Post-completion side effects for a download job: temp-file cleanup,
// JobVideoDownload cleanup, channel poster backfill, playlist hooks, Plex
// refresh, and next-job kickoff. Deliberately fire-and-forget except poster
// backfill.
const fsPromises = require('fs').promises;
const logger = require('../../logger');
const configModule = require('../configModule');
const plexModule = require('../plexModule');
const jobModule = require('../jobModule');
const filesystem = require('../filesystem');
const { JobVideoDownload } = require('../../models');
const Channel = require('../../models/channel');

// channelModule and downloadModule are required late inside the function body:
// both sit on a require cycle (channelModule -> downloadModule ->
// downloadExecutor -> this module), so they cannot be top-level requires.
async function runCompletionSideEffects({
  jobId,
  videoData,
  skipJobTransition,
  tempChannelsFile,
  onTempChannelsFileCleaned,
}) {
  // Clean up temporary channels file if it exists
  if (tempChannelsFile) {
    fsPromises.unlink(tempChannelsFile)
      .then(() => {
        logger.info('Cleaned up temporary channels file');
        onTempChannelsFileCleaned();
      })
      .catch((err) => {
        logger.error({ err }, 'Failed to clean up temp channels file');
      });
  }

  // Clean up all JobVideoDownload tracking entries for this job
  JobVideoDownload.destroy({
    where: { job_id: jobId }
  }).then(count => {
    if (count > 0) {
      logger.info({ count }, 'Cleaned up JobVideoDownload tracking entries');
    }
  }).catch(err => {
    logger.error({ err }, 'Error cleaning up JobVideoDownload entries');
  });

  // Backfill channel posters for channels with newly downloaded videos
  if (videoData && videoData.length > 0) {
    try {
      const uniqueChannelIds = [...new Set(
        videoData
          .map(v => v.channel_id)
          .filter(Boolean)
      )];

      if (uniqueChannelIds.length > 0) {
        const channelsToBackfill = await Channel.findAll({
          where: { channel_id: uniqueChannelIds }
        });

        if (channelsToBackfill.length > 0) {
          await require('../channelModule').backfillChannelPosters(channelsToBackfill);
          logger.info({ channelCount: channelsToBackfill.length }, 'Backfilled channel posters for downloaded videos');
        }
      }
    } catch (err) {
      logger.error({ err }, 'Error backfilling channel posters');
      // Don't fail the job if poster backfill fails
    }
  }

  // Fill in playlist_video.channel_id and auto-create source channels from the
  // channel_ids learned during this download (see backfillDownloadedVideoChannels).
  if (videoData && videoData.length > 0) {
    try {
      await require('../playlistModule').backfillDownloadedVideoChannels(videoData);
    } catch (err) {
      logger.error({ err }, 'Failed to backfill playlist video channels');
    }
  }

  // Trigger playlist M3U regeneration and media-server sync for any playlists
  // that contain videos from this download batch.
  if (videoData && videoData.length > 0) {
    const downloadedIds = videoData.map((v) => v.youtubeId).filter(Boolean);
    if (downloadedIds.length > 0) {
      require('../downloadModule').afterDownloadHook(downloadedIds).catch((err) => {
        logger.error({ err }, 'afterDownloadHook failed');
      });
    }
  }

  // Only refresh Plex and start next job if not processing multiple groups
  if (!skipJobTransition) {
    // Derive the set of subfolders from where each video actually ended up
    // on disk. This mirrors reality (the post-processor may have placed
    // each video under its channel-specific sub_folder) instead of relying
    // on the job-level subfolderOverride, which is null for typical
    // manual URL and non-grouped channel downloads.
    const baseDir = configModule.directoryPath;
    const subfoldersInUse = new Set();
    for (const video of (videoData || [])) {
      const mediaPath = video.filePath || video.audioFilePath;
      if (!mediaPath) continue;
      subfoldersInUse.add(filesystem.extractSubfolderFromAbsPath(mediaPath, baseDir));
    }

    if (subfoldersInUse.size > 0) {
      // Defensive: refreshLibrary currently swallows errors internally
      plexModule.refreshLibrariesForSubfolders([...subfoldersInUse]).catch(err => {
        logger.error({ err }, 'Failed to refresh Plex libraries');
      });
    }

    jobModule.startNextJob().catch(err => {
      logger.error({ err }, 'Failed to start next job');
    });
  }
}

module.exports = { runCompletionSideEffects };
