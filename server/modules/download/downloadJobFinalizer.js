// Finalization of a finished yt-dlp run: derives the terminal job status,
// persists it, broadcasts the final WebSocket payload, reports to the run
// tracker, dispatches notifications, and triggers completion side effects.
// Pure decision logic stays in downloadStatusResolver; this module owns the
// I/O sequencing. finalizeDownloadJob never throws: its catch is the
// last-resort path that keeps the job queue moving.
const logger = require('../../logger');
const configModule = require('../configModule');
const jobModule = require('../jobModule');
const MessageEmitter = require('../messageEmitter');
const VideoMetadataProcessor = require('./videoMetadataProcessor');
const downloadRunTracker = require('./downloadRunTracker');
const notificationModule = require('../notificationModule');
const downloadResultProcessor = require('./downloadResultProcessor');
const downloadCleanup = require('./downloadCleanup');
const transient403RetryPlanner = require('./transient403RetryPlanner');
const { runCompletionSideEffects } = require('./downloadCompletionEffects');
const {
  computeOutcomeFlags,
  describeNonZeroExit,
  resolveTerminalStatus,
  resolveFinalPresentation,
  buildJobDataPayload
} = require('./downloadStatusResolver');

// yt-dlp writes certain warnings to stderr that do not indicate a problem with
// the download: the media still downloads and yt-dlp exits 0. These must not
// flip a successful job to "Complete with Warnings".
const BENIGN_STDERR_WARNING_PATTERNS = [
  // Emitted while fetching subtitles when no curl_cffi impersonation target is
  // installed. The subtitle still downloads; the message is purely advisory.
  /WARNING:.*extractor specified to use impersonation/i,
  // Emitted because our output template (-o) is an absolute temp path, so
  // yt-dlp ignores the --paths temp: redirect. The download still succeeds.
  /WARNING:.*--paths is ignored since an absolute path is given/i,
];

// True when everything yt-dlp wrote to stderr is known-benign warnings (or
// whitespace). Used to avoid flagging a clean, exit-0 download as "Complete
// with Warnings" over informational noise like the subtitle impersonation
// notice. Returns false for empty stderr so callers keep their own guard.
function stderrHasOnlyBenignWarnings(stderrBuffer = '') {
  const lines = String(stderrBuffer)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return false;
  }

  return lines.every((line) =>
    BENIGN_STDERR_WARNING_PATTERNS.some((pattern) => pattern.test(line))
  );
}

async function persistCompletedVideosBeforeTerminalUpdate(jobId, videoData, failedVideosList) {
  if (!videoData || videoData.length === 0) {
    return;
  }

  const currentJob = jobModule.getJob(jobId);
  if (!currentJob) {
    logger.warn({ jobId }, 'Unable to persist completed videos before terminal update; job not found');
    return;
  }

  currentJob.data = currentJob.data || {};
  currentJob.data.videos = videoData;
  currentJob.data.failedVideos = failedVideosList || [];
  await jobModule.saveJobOnly(jobId, currentJob);
}

async function saveIntermediateGroupResults(jobId, output, videoData, failedVideosList, skippedCount, extraFields = {}, terminatedChannelsForGroup = [], terminationFailuresForGroup = []) {
  const currentJob = jobModule.getJob(jobId);
  if (!currentJob) {
    logger.warn({ jobId }, 'Unable to merge intermediate group results; job not found');
    return;
  }

  const existingVideos = currentJob.data?.videos || [];
  const existingFailedVideos = currentJob.data?.failedVideos || [];
  const existingSkippedCount = currentJob.data?.cumulativeSkipped || 0;
  const existingTerminated = currentJob.data?.terminatedChannels || [];
  const existingFailures = currentJob.data?.terminationFailures || [];

  // First write wins so original uploader/url/date stick across groups.
  const seenChannelIds = new Set(existingTerminated.map(c => c.channelId));
  const mergedTerminated = [...existingTerminated];
  for (const entry of (terminatedChannelsForGroup || [])) {
    if (!entry || !entry.channelId || seenChannelIds.has(entry.channelId)) continue;
    seenChannelIds.add(entry.channelId);
    mergedTerminated.push(entry);
  }

  // Dedupe failures by channel id across groups.
  const mergedFailures = Array.from(new Set([...existingFailures, ...(terminationFailuresForGroup || [])]));

  await jobModule.updateJob(jobId, {
    output: output,
    ...extraFields,
    data: {
      videos: [...existingVideos, ...(videoData || [])],
      failedVideos: [...existingFailedVideos, ...(failedVideosList || [])],
      cumulativeSkipped: existingSkippedCount + (skippedCount || 0),
      terminatedChannels: mergedTerminated,
      terminationFailures: mergedFailures
    },
  });

  const updatedJob = jobModule.getJob(jobId);
  if (updatedJob && updatedJob.data && updatedJob.data.videos) {
    await jobModule.saveJobOnly(jobId, updatedJob);
  }
}

async function finalizeDownloadJob({
  jobId,
  jobType,
  code,
  signal,
  monitor,
  errorTracker,
  timeoutController,
  router,
  wasManuallyTerminated,
  manualReason,
  initialCount,
  originalUrls,
  allowRedownload,
  skipJobTransition,
  runId,
  tempChannelsFile,
  onTempChannelsFileCleaned,
  enqueueAutoRetry = null,
}) {
  // True once the job's terminal status has been persisted; the catch
  // below must not overwrite it with 'Error' for failures that happen
  // after that point (broadcast, run tracking, completion side effects).
  let terminalUpdateDone = false;
  try {
    // Per-run output state snapshot from the router. botDetected and
    // httpForbiddenDetected may be upgraded by the full stderr buffer rescan
    // below, so they are locals rather than direct reads.
    const { stderrBuffer, partialDestinations } = router;
    let botDetected = router.botDetected;
    let httpForbiddenDetected = router.httpForbiddenDetected;

    // Also check the complete stderr buffer for bot detection
    if (!botDetected && stderrBuffer &&
        stderrBuffer.includes('Sign in to confirm') &&
        stderrBuffer.includes('not a bot')) {
      botDetected = true;
      logger.info('Bot detection found in stderr buffer');
    }

    if (!httpForbiddenDetected && stderrBuffer) {
      const lowerStderr = stderrBuffer.toLowerCase();
      if (lowerStderr.includes('http error 403') || lowerStderr.includes('403: forbidden')) {
        httpForbiddenDetected = true;
        logger.info('HTTP 403 detected in stderr buffer');
        router.emitCookiesSuggestion();
      }
    }

    // Wait for terminated-channel lookups before deriving finalState.
    await errorTracker.settlePersistence();

    const urlsToProcess = downloadResultProcessor.resolveUrlsToProcess(jobType, originalUrls, initialCount);

    const videoCount = urlsToProcess.length;
    let videoData = await VideoMetadataProcessor.processVideoMetadata(urlsToProcess);

    const { successfulVideos, failedVideosList } = downloadResultProcessor.partitionDownloadResults(videoData, errorTracker, urlsToProcess);
    // Use successful videos for further processing (archive, database, etc.)
    videoData = successfulVideos;

    await downloadResultProcessor.reconcileArchive({ allowRedownload, failedVideosList, videoData, errorTracker });

    const wasTerminated = Boolean(timeoutController.shutdownInProgress || timeoutController.shutdownReason || wasManuallyTerminated);

    // Auto-retry transient 403 failures. Enqueue while this job is still
    // In Progress so the retry queues as Pending behind it, and read job data
    // now, before the terminal update replaces it. Handed-off failures are
    // tagged so run summaries and notifications report the post-retry outcome
    // instead of a failure the retry is about to fix.
    let autoRetryQueuedCount = 0;
    if (typeof enqueueAutoRetry === 'function') {
      const preTerminalJob = jobModule.getJob(jobId);
      const sourceJobData = (preTerminalJob && preTerminalJob.data) || {};
      const retryPlan = transient403RetryPlanner.planAutoRetry({
        failedVideosList,
        httpForbiddenDetected,
        botDetected,
        wasTerminated,
        sourceJobData,
        maxAttempts: configModule.getConfig().downloadAutoRetryCount,
      });
      if (retryPlan) {
        try {
          await enqueueAutoRetry({
            retryVideos: retryPlan.retryVideos,
            autoRetryAttempt: retryPlan.nextAttempt,
            runId,
            sourceJobData,
          });
          const retryIds = new Set(retryPlan.retryVideos.map((video) => video.youtubeId));
          for (const failedVideo of failedVideosList) {
            if (retryIds.has(failedVideo.youtubeId)) {
              failedVideo.autoRetryQueued = true;
            }
          }
          autoRetryQueuedCount = retryPlan.retryVideos.length;
          logger.info(
            { jobId, count: autoRetryQueuedCount, attempt: retryPlan.nextAttempt },
            'Queued auto-retry job for transient 403 failures'
          );
        } catch (err) {
          logger.error({ err, jobId }, 'Failed to enqueue auto-retry for transient 403 failures');
        }
      }
    }
    // Failures handed off to the retry job are excluded from run totals and
    // summaries (the retry job reports their final outcome); the full list,
    // tags included, still persists in job.data for history.
    const reportableFailedVideos = failedVideosList.filter((video) => !video.autoRetryQueued);

    logger.info({ jobType, jobId }, 'Job complete (with or without errors)');

    const flags = computeOutcomeFlags({
      code,
      expectedSkipCount: errorTracker.expectedSkipCount,
      terminatedChannelCount: errorTracker.terminatedChannelIds.size,
      failedCount: failedVideosList.length,
      unexpectedErrorCount: errorTracker.unexpectedErrorCount,
      botDetected,
      httpForbiddenDetected
    });

    const dataPayload = buildJobDataPayload({
      videoData,
      failedVideosList,
      terminatedChannels: errorTracker.terminatedChannels,
      terminatedChannelIds: errorTracker.terminatedChannelIds,
      terminationFailures: errorTracker.terminationFailures
    });

    if (errorTracker.terminatedChannelIds.size > 0) {
      logger.warn({ terminatedChannels: errorTracker.terminatedChannels }, 'Channels marked terminated during this job');
    }

    let status = '';
    let output = '';
    let jobErrorCode;

    if (botDetected) {
      status = 'Error';
      output = 'Bot detection encountered. Please set cookies in your Configuration.';

      await persistCompletedVideosBeforeTerminalUpdate(jobId, videoData, failedVideosList);
      await jobModule.updateJob(jobId, {
        status: status,
        endDate: Date.now(),
        output: output,
        data: dataPayload,
        notes: 'YouTube requires authentication. Enable cookies in Configuration to resolve this issue.',
        error: 'COOKIES_REQUIRED'
      });
      jobErrorCode = 'COOKIES_REQUIRED';
    } else if (timeoutController.shutdownInProgress || timeoutController.shutdownReason || wasManuallyTerminated) {
      // Handle timeout/graceful shutdown or manual termination
      await downloadCleanup.cleanupInProgressVideos(jobId);

      const completedCount = videoData.length;
      status = 'Terminated';
      output = `${completedCount} video${completedCount !== 1 ? 's' : ''} completed before termination`;

      const terminationReason = wasManuallyTerminated
        ? manualReason
        : (timeoutController.shutdownReason || 'Download terminated due to timeout');

      // Persist videos to DB before updateJob reloads them from DB.
      await persistCompletedVideosBeforeTerminalUpdate(jobId, videoData, failedVideosList);

      await jobModule.updateJob(jobId, {
        status: status,
        endDate: Date.now(),
        output: output,
        data: dataPayload,
        notes: terminationReason,
      });

      logger.info({ terminationReason, completedCount, failedCount: failedVideosList.length }, 'Job terminated, saved completed videos');
    } else if (code !== 0) {
      // Download actually failed (non-zero exit code)
      await downloadCleanup.cleanupPartialFiles(Array.from(partialDestinations));

      const failureDetails = monitor.lastParsed || null;

      const nonZero = describeNonZeroExit({
        code,
        signal,
        videoCount,
        videoDataCount: videoData.length,
        terminatedChannelCount: errorTracker.terminatedChannelIds.size,
        httpForbiddenDetected,
        flags,
        failureDetails
      });
      status = nonZero.status;
      output = nonZero.output;

      if (nonZero.errorCode) {
        jobErrorCode = nonZero.errorCode;
      }

      if (skipJobTransition) {
        await saveIntermediateGroupResults(
          jobId,
          output,
          videoData,
          failedVideosList,
          monitor.videoCount.skipped || 0,
          {
            notes: nonZero.notes,
            ...(nonZero.errorCode ? { error: nonZero.errorCode } : {})
          },
          [...errorTracker.terminatedChannels],
          [...errorTracker.terminationFailures]
        );
      } else {
        await persistCompletedVideosBeforeTerminalUpdate(jobId, videoData, failedVideosList);
        const terminalStatus = resolveTerminalStatus({
          status: nonZero.status,
          flags,
          terminatedChannelCount: errorTracker.terminatedChannelIds.size,
          hasPartialSuccess: nonZero.hasPartialSuccess
        });
        await jobModule.updateJob(jobId, {
          status: terminalStatus,
          endDate: Date.now(),
          output: output,
          data: dataPayload,
          notes: nonZero.notes,
          ...(nonZero.errorCode ? { error: nonZero.errorCode } : {})
        });
      }
    } else if (stderrBuffer && !monitor.hasError && !stderrHasOnlyBenignWarnings(stderrBuffer)) {
      status = 'Complete with Warnings';
      output = `${videoCount} videos.`;
      // Intermediate group: just save videos, don't mark complete yet.
      if (skipJobTransition) {
        await saveIntermediateGroupResults(
          jobId,
          output,
          videoData,
          failedVideosList,
          monitor.videoCount.skipped || 0,
          {},
          [...errorTracker.terminatedChannels],
          [...errorTracker.terminationFailures]
        );
      } else {
        // Persist videos to DB before updateJob reloads them from DB.
        await persistCompletedVideosBeforeTerminalUpdate(jobId, videoData, failedVideosList);

        await jobModule.updateJob(jobId, {
          status: status,
          output: output,
          data: dataPayload,
        });
      }
    } else {
      // Upgrade to warning shape when terminations were recorded.
      if (errorTracker.terminatedChannelIds.size > 0) {
        status = 'Complete with Warnings';
        output = `${videoCount} videos, ${errorTracker.terminatedChannelIds.size} channel${errorTracker.terminatedChannelIds.size !== 1 ? 's' : ''} marked terminated.`;
      } else {
        status = 'Complete';
        output = `${videoCount} videos.`;
      }
      // Intermediate group: just save videos, don't mark complete yet.
      if (skipJobTransition) {
        await saveIntermediateGroupResults(
          jobId,
          output,
          videoData,
          failedVideosList,
          monitor.videoCount.skipped || 0,
          {},
          [...errorTracker.terminatedChannels],
          [...errorTracker.terminationFailures]
        );
      } else {
        // Persist videos to DB before updateJob reloads them from DB.
        await persistCompletedVideosBeforeTerminalUpdate(jobId, videoData, failedVideosList);

        await jobModule.updateJob(jobId, {
          status: status,
          output: output,
          data: dataPayload,
        });
      }
    }

    // Every branch above ends in exactly one terminal persist
    // (updateJob or saveIntermediateGroupResults).
    terminalUpdateDone = true;

    const presentation = resolveFinalPresentation({
      code,
      jobErrorCode,
      wasTerminated,
      terminationReason: wasManuallyTerminated ? manualReason : timeoutController.shutdownReason,
      botDetected,
      monitorHasError: monitor.hasError,
      flags,
      videoDataCount: videoData.length,
      failedCount: failedVideosList.length,
      skippedCount: monitor.videoCount.skipped || 0,
      terminatedChannelCount: errorTracker.terminatedChannelIds.size,
      terminationFailureCount: errorTracker.terminationFailures.length,
      videoCount,
      monitorCompletedCount: monitor.videoCount.completed,
      unexpectedErrorCount: errorTracker.unexpectedErrorCount,
      httpForbiddenDetected,
      autoRetryQueuedCount
    });
    const { debugFlags } = presentation;

    logger.debug({
      code,
      hasProcessedVideos: debugFlags.hasProcessedVideos,
      hasDownloadedNewVideos: debugFlags.hasDownloadedNewVideos,
      isWarningOnly: debugFlags.isWarningOnly,
      hasError: monitor.hasError,
      hasFailures: debugFlags.hasFailures,
      hasSuccesses: debugFlags.hasSuccesses,
      hasNonFatalPartialSuccess: debugFlags.hasNonFatalPartialSuccess,
      expectedSkipCount: errorTracker.expectedSkipCount,
      unexpectedErrorCount: errorTracker.unexpectedErrorCount,
      hasOnlyExpectedSkips: flags.hasOnlyExpectedSkips,
      hasOnlyHandledErrors: flags.hasOnlyHandledErrors,
      terminatedChannelCount: errorTracker.terminatedChannelIds.size,
      successCount: videoData.length,
      failureCount: failedVideosList.length,
      finalState: debugFlags.finalState
    }, 'Final state determination');

    const { finalState, finalText, finalErrorCode } = presentation;

    // Make sure final counts are accurate
    if (monitor.videoCount.completed === 0 && videoData.length > 0 && (finalState === 'complete' || finalState === 'warning')) {
      monitor.videoCount.completed = videoData.length;
    }

    const isFinalError = finalState !== 'complete' && finalState !== 'warning';
    const finalProgress = monitor.snapshot(finalState);
    const finalPayload = {
      text: finalText,
      progress: finalProgress
    };

    // When this job belongs to a run, the run owns the summary and notification.
    const runActive = !skipJobTransition && downloadRunTracker.isActive(runId);

    // Only include finalSummary if this is the final completion (not an intermediate group)
    // For multi-group downloads, skipJobTransition=true means more groups are coming
    if (!skipJobTransition && !runActive) {
      finalPayload.finalSummary = {
        // Use actual videoData.length for successful downloads
        totalDownloaded: videoData.length,
        totalSkipped: monitor.videoCount.skipped || 0,
        totalFailed: reportableFailedVideos.length,
        totalAutoRetried: autoRetryQueuedCount,
        totalMembersOnly: errorTracker.membersOnlyVideoIds.size,
        totalTerminatedChannels: errorTracker.terminatedChannelIds.size,
        totalTerminationFailures: errorTracker.terminationFailures.length,
        failedVideos: reportableFailedVideos,
        terminatedChannels: [...errorTracker.terminatedChannels],
        terminationFailures: [...errorTracker.terminationFailures],
        jobType: jobType,
        completedAt: new Date().toISOString()
      };
    }

    if (finalState === 'terminated') {
      // Terminated jobs are warnings, not full errors
      finalPayload.warning = true;
      finalPayload.terminationReason = wasManuallyTerminated ? manualReason : timeoutController.shutdownReason;
    } else if (finalState === 'warning') {
      // Partial failures - some videos succeeded, some failed
      finalPayload.warning = true;
      if (finalErrorCode) {
        finalPayload.errorCode = finalErrorCode;
      }
    } else if (isFinalError) {
      // Complete failure
      finalPayload.error = true;
      if (finalErrorCode) {
        finalPayload.errorCode = finalErrorCode;
      }
    }

    MessageEmitter.emitMessage(
      'broadcast',
      null,
      'download',
      'downloadProgress',
      finalPayload
    );

    // Fold this job's totals into the run; it emits one aggregated summary + notification when its last job finishes.
    if (runActive) {
      downloadRunTracker.recordJobResult(runId, jobId, {
        totalDownloaded: videoData.length,
        totalSkipped: monitor.videoCount.skipped || 0,
        totalFailed: reportableFailedVideos.length,
        totalMembersOnly: errorTracker.membersOnlyVideoIds.size,
        failedVideos: reportableFailedVideos,
        terminatedChannels: [...errorTracker.terminatedChannels],
        terminationFailures: [...errorTracker.terminationFailures],
        videoData: videoData,
        jobType,
      });
    }

    // Send notification if download was successful and notifications are enabled
    // Skip notifications for intermediate groups (only send for final completion)
    if ((finalState === 'complete' || finalState === 'warning') && !isFinalError && !skipJobTransition && !runActive) {
      notificationModule.sendDownloadNotification({
        finalSummary: finalPayload.finalSummary,
        videoData: videoData,
        channelName: monitor.currentChannelName
      }).catch(err => {
        logger.error({ err }, 'Failed to send notification');
        // Continue execution - don't crash if notification fails
      });
    }

    await runCompletionSideEffects({
      jobId,
      videoData,
      skipJobTransition,
      tempChannelsFile,
      onTempChannelsFileCleaned,
    });
  } catch (err) {
    // Finalization failed partway (e.g. DB outage). Without this catch the
    // promise never settles, the job stays 'In Progress' forever, and the
    // queue stalls.
    logger.error({ err, jobId }, 'Unexpected error finalizing download job');
    if (!terminalUpdateDone) {
      await jobModule.updateJob(jobId, {
        status: 'Error',
        endDate: Date.now(),
        output: 'Job finalization error: ' + err.message,
      }).catch((dbErr) => logger.debug({ err: dbErr, jobId }, 'Best-effort error update failed'));
    }
    if (!skipJobTransition) {
      jobModule.startNextJob().catch(err2 => {
        logger.error({ err: err2 }, 'Failed to start next job');
      });
    }
  }
}

module.exports = {
  finalizeDownloadJob,
  saveIntermediateGroupResults,
  persistCompletedVideosBeforeTerminalUpdate,
  stderrHasOnlyBenignWarnings,
};
