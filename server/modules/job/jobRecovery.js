// Restart recovery: jobs a restart interrupted are marked Terminated, after
// the videos they had already finished are linked back to them.

const fs = require('fs');
const fsPromises = fs.promises;
const path = require('path');
const Job = require('../../models/job');
const JobVideoDownload = require('../../models/jobvideodownload');
const videoPersistence = require('../videoPersistence');
const configModule = require('../configModule');
const downloadCleanup = require('../download/downloadCleanup');
const { presentColumns } = require('../videoRemovalState');
const logger = require('../../logger');
const jobRegistry = require('./jobRegistry');
const jobPersistence = require('./jobPersistence');

class JobRecovery {
  /**
   * Recover completed videos from JobVideoDownload tracking table
   * Reads .info.json files and ensures videos are properly saved to DB
   * @param {string} jobId - The job ID to recover videos for
   * @returns {Promise<number>} Number of videos successfully recovered
   */
  async recoverCompletedVideos(jobId) {
    let recoveredCount = 0;

    try {
      const completedDownloads = await JobVideoDownload.findAll({
        where: {
          job_id: jobId,
          status: 'completed'
        }
      });

      if (completedDownloads.length === 0) {
        logger.info({ jobId }, 'No completed videos to recover for job');
        return 0;
      }

      logger.info({ jobId, count: completedDownloads.length }, 'Found completed videos to recover for job');

      let jobInstance = await Job.findOne({ where: { id: jobId } });

      for (const download of completedDownloads) {
        try {
          const youtubeId = download.youtube_id;
          const infoJsonPath = path.join(configModule.getJobsPath(), 'info', `${youtubeId}.info.json`);

          let infoExists = false;
          try {
            await fsPromises.access(infoJsonPath);
            infoExists = true;
          } catch (err) {
            logger.warn({ youtubeId }, 'Info file not found for video, skipping recovery');
            continue;
          }

          if (!infoExists) {
            continue;
          }

          const infoContent = await fsPromises.readFile(infoJsonPath, 'utf-8');
          const info = JSON.parse(infoContent);

          const preferredChannelName = info.uploader || info.channel || info.uploader_id || info.channel_id || 'Unknown Channel';

          const videoData = {
            youtubeId: info.id,
            youTubeChannelName: preferredChannelName,
            youTubeVideoName: info.title,
            duration: info.duration,
            description: info.description,
            originalDate: info.upload_date,
            channel_id: info.channel_id,
            media_type: info.media_type || 'video',
            content_rating: info.content_rating || null,
            age_limit: info.age_limit ?? null,
            normalized_rating: info.normalized_rating || null,
            rating_source: info.rating_source || null,
          };

          // Determine candidate file paths, preferring yt-dlp's recorded actual location
          const candidatePaths = [];
          const pushCandidate = (candidatePath) => {
            if (candidatePath && !candidatePaths.includes(candidatePath)) {
              candidatePaths.push(candidatePath);
            }
          };

          const actualFilePath = info._actual_filepath ? path.normalize(info._actual_filepath) : null;
          pushCandidate(actualFilePath);

          // If post-processing updated the tracking record with an exact path, use it
          if (!actualFilePath && download.file_path && path.extname(download.file_path)) {
            pushCandidate(path.normalize(download.file_path));
          }

          const fallbackBasePath = path.join(
            configModule.directoryPath,
            preferredChannelName,
            `${preferredChannelName} - ${info.title} - ${info.id}`,
            `${preferredChannelName} - ${info.title}  [${info.id}]`
          );

          const fallbackExtensions = ['.mp4', '.webm', '.mkv', '.m4v', '.avi'];
          for (const ext of fallbackExtensions) {
            pushCandidate(`${fallbackBasePath}${ext}`);
          }

          let resolvedPath = null;
          let resolvedStats = null;
          for (const candidate of candidatePaths) {
            try {
              const stats = await fsPromises.stat(candidate);
              resolvedPath = candidate;
              resolvedStats = stats;
              break;
            } catch (err) {
              // Try next candidate
            }
          }

          if (resolvedPath) {
            videoData.filePath = resolvedPath;
            videoData.fileSize = resolvedStats?.size !== undefined ? resolvedStats.size.toString() : null;
            Object.assign(videoData, presentColumns());
          } else {
            // File not found: record the expected location but leave the removal
            // columns alone, so a video deleted in-app while its job ran stays
            // deleted and a new row simply awaits the file check.
            const assumedPath = actualFilePath || `${fallbackBasePath}.mp4`;
            videoData.filePath = assumedPath;
            videoData.fileSize = null;
          }

          // Upsert video into Videos table and ensure JobVideo relationship exists
          // Note: Video and ChannelVideo were already created during normal download processing
          // We just need to ensure the JobVideo relationship exists for this terminated job
          await videoPersistence.upsertVideoForJob(videoData, jobInstance, true);

          recoveredCount++;
          logger.info({ youtubeId, title: info.title }, 'Recovered video');
        } catch (err) {
          logger.error({ err, youtubeId: download.youtube_id }, 'Error recovering video');
        }
      }

      logger.info({ jobId, recoveredCount }, 'Successfully recovered videos for job');
      return recoveredCount;
    } catch (err) {
      logger.error({ err, jobId }, 'Error in recoverCompletedVideos for job');
      return recoveredCount;
    }
  }

  async terminateInProgressJobs() {
    // Change the status of "In Progress" jobs to "Terminated" and recover/cleanup videos
    for (let jobId in jobRegistry.jobs) {
      if (jobRegistry.jobs[jobId].status === 'In Progress') {
        logger.info({ jobId }, 'Recovering job after server restart');

        let recoveredCount = 0;
        let outputMessage = 'Job terminated due to server restart';

        try {
          recoveredCount = await this.recoverCompletedVideos(jobId);

          try {
            await downloadCleanup.cleanupInProgressVideos(jobId);
          } catch (cleanupErr) {
            logger.error({ err: cleanupErr, jobId }, 'Error cleaning up in-progress videos for job');
          }

          if (recoveredCount > 0) {
            outputMessage = `${recoveredCount} video${recoveredCount === 1 ? '' : 's'} completed (recovered after server restart)`;
          }

          try {
            const deletedCount = await JobVideoDownload.destroy({
              where: { job_id: jobId }
            });
            if (deletedCount > 0) {
              logger.info({ jobId, deletedCount }, 'Cleaned up JobVideoDownload tracking entries for job');
            }
          } catch (deleteErr) {
            logger.error({ err: deleteErr, jobId }, 'Error deleting JobVideoDownload entries for job');
          }
        } catch (err) {
          logger.error({ err, jobId }, 'Error during recovery for job');
          outputMessage = `Job terminated with errors: ${err.message}`;
        }

        // Reload job videos from database into the in-memory structure, so
        // Download History shows the correct count
        try {
          const videos = await jobPersistence.loadJobVideos(jobId);

          if (!jobRegistry.jobs[jobId].data) {
            jobRegistry.jobs[jobId].data = {};
          }
          jobRegistry.jobs[jobId].data.videos = videos;

          logger.info({ jobId, videoCount: videos.length }, 'Loaded videos into in-memory structure for job');
        } catch (loadErr) {
          logger.error({ err: loadErr, jobId }, 'Error loading videos into memory for job');
        }

        jobRegistry.jobs[jobId].status = 'Terminated';
        jobRegistry.jobs[jobId].output = outputMessage;

        try {
          await Job.update(
            {
              status: 'Terminated',
              output: outputMessage
            },
            { where: { id: jobId } }
          );
          logger.info({ jobId, outputMessage }, 'Job marked as Terminated');
        } catch (err) {
          logger.error({ err, jobId }, 'Failed to update job in database');
        }
      }
    }

    // Terminate all Pending jobs (they can't be safely resumed after restart)
    for (let jobId in jobRegistry.jobs) {
      if (jobRegistry.jobs[jobId].status === 'Pending') {
        logger.warn({ jobId, jobType: jobRegistry.jobs[jobId].jobType },
          'Terminating pending job - jobs cannot be resumed after server restart');

        jobRegistry.jobs[jobId].status = 'Terminated';
        jobRegistry.jobs[jobId].output = 'Job terminated during server restart';

        try {
          await Job.update(
            {
              status: 'Terminated',
              output: 'Job terminated during server restart'
            },
            { where: { id: jobId } }
          );
          logger.info({ jobId }, 'Pending job marked as Terminated');
        } catch (err) {
          logger.error({ err, jobId }, 'Failed to update pending job in database');
        }
      }
    }
  }
}

module.exports = new JobRecovery();
