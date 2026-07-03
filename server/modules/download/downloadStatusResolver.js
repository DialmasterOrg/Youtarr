// Pure decision functions for a finished yt-dlp run. No I/O; the executor
// performs all persistence and emission based on what these return.

function computeOutcomeFlags({
  code,
  expectedSkipCount,
  terminatedChannelCount,
  failedCount,
  unexpectedErrorCount,
  botDetected,
  httpForbiddenDetected
}) {
  // yt-dlp exited with code 1 only because every error it emitted was an
  // expected skip (members-only, upcoming live, premiere, etc.). Treat
  // these as a clean completion rather than a failure. unexpectedErrorCount
  // catches real ERRORs that miss failedVideosList because currentVideoId
  // was null (covers both stdout and stderr). monitor.hasError on its own
  // would only catch the stdout path.
  const hasOnlyExpectedSkips = code === 1 &&
    expectedSkipCount > 0 &&
    failedCount === 0 &&
    unexpectedErrorCount === 0 &&
    !botDetected &&
    !httpForbiddenDetected;

  // Like hasOnlyExpectedSkips but also admits recognized terminations.
  // Mixed failure modes still report as an error.
  const hasOnlyHandledErrors = code === 1 &&
    (expectedSkipCount > 0 || terminatedChannelCount > 0) &&
    failedCount === 0 &&
    unexpectedErrorCount === 0 &&
    !botDetected &&
    !httpForbiddenDetected;

  return { hasOnlyExpectedSkips, hasOnlyHandledErrors };
}

function describeNonZeroExit({
  code,
  signal,
  videoCount,
  videoDataCount,
  terminatedChannelCount,
  httpForbiddenDetected,
  flags,
  failureDetails
}) {
  let status = signal === 'SIGKILL' ? 'Killed' : 'Error';
  const hasPartialSuccess = code === 1 && videoDataCount > 0;
  let output;
  let notes;
  let errorCode;

  if (flags.hasOnlyExpectedSkips && terminatedChannelCount === 0) {
    status = 'Complete';
    output = `${videoCount} videos.`;
  } else if (flags.hasOnlyHandledErrors && terminatedChannelCount > 0) {
    // Code 1 but every error was recognized: warning-shaped success.
    output = `${videoCount} videos, ${terminatedChannelCount} channel${terminatedChannelCount !== 1 ? 's' : ''} marked terminated.`;
    notes = `${terminatedChannelCount} channel${terminatedChannelCount !== 1 ? 's' : ''} marked terminated by YouTube`;
  } else if (httpForbiddenDetected) {
    // Failed with 403 errors - likely authentication issue
    output = `${videoCount} videos. Error: YouTube returned HTTP 403 (Forbidden)`;
    notes = 'YouTube denied access (HTTP 403). Configure cookies in Settings to resolve this issue.';
    errorCode = 'COOKIES_RECOMMENDED';
  } else {
    // Failed with other error
    output = `${videoCount} videos. Error: Command exited with code ${code}`;

    // Add stall detection note if applicable
    const failureReason = failureDetails && failureDetails.stalled
      ? `stall detected at ${failureDetails.progress.percent.toFixed(1)}% (${Math.round(
        failureDetails.progress.speedBytesPerSecond / 1024
      )} KiB/s)`
      : signal || `exit ${code}`;
    notes = hasPartialSuccess
      ? `Some videos failed (${failureReason})`
      : `Download failed (${failureReason})`;
  }

  return { status, output, notes, errorCode, hasPartialSuccess };
}

function resolveTerminalStatus({ status, flags, terminatedChannelCount, hasPartialSuccess }) {
  let terminalStatus = status;
  if (flags.hasOnlyHandledErrors && terminatedChannelCount > 0) {
    terminalStatus = 'Complete with Warnings';
  } else if (flags.hasOnlyExpectedSkips) {
    terminalStatus = 'Complete';
  } else if (hasPartialSuccess) {
    terminalStatus = 'Complete with Warnings';
  }
  return terminalStatus;
}

function resolveFinalPresentation({
  code,
  jobErrorCode,
  wasTerminated,
  terminationReason,
  botDetected,
  monitorHasError,
  flags,
  videoDataCount,
  failedCount,
  skippedCount,
  terminatedChannelCount,
  terminationFailureCount,
  videoCount,
  monitorCompletedCount,
  unexpectedErrorCount,
  httpForbiddenDetected,
  // Failures already handed off to a queued auto-retry job. Affects only the
  // presented text; state derivation still counts them as failures.
  autoRetryQueuedCount = 0
}) {
  // Consider it successful if:
  // - Exit code is 0 (normal success), OR
  // - Exit code is 1 with stderr warnings but videos were processed (yt-dlp returns 1 for warnings)
  // - We found new video files that were downloaded
  // Only treat as real error if exit code > 1, was killed, or nothing was processed
  const hasProcessedVideos = (monitorCompletedCount > 0 || skippedCount > 0);
  const hasDownloadedNewVideos = videoCount > 0;
  const isWarningOnly = (code === 1 && !monitorHasError && (hasProcessedVideos || hasDownloadedNewVideos));

  // If videos failed but some succeeded, treat as warning rather than complete error
  const hasFailures = failedCount > 0;
  const hasSuccesses = videoDataCount > 0;
  const hasNonFatalPartialSuccess = code === 1 && hasSuccesses;

  const hasOnlySuccessfulTerminationsOnCleanExit = code === 0 &&
    terminatedChannelCount > 0 &&
    failedCount === 0 &&
    unexpectedErrorCount === 0 &&
    !botDetected &&
    !httpForbiddenDetected;

  let finalState;
  if ((flags.hasOnlyHandledErrors && terminatedChannelCount > 0) || hasOnlySuccessfulTerminationsOnCleanExit) {
    // Warning-shaped when the only detected issue is a handled
    // terminated channel, including when --ignore-errors exits 0.
    finalState = 'warning';
  } else if (code === 0 || flags.hasOnlyExpectedSkips) {
    finalState = hasFailures ? 'warning' : 'complete';
  } else if (isWarningOnly || hasNonFatalPartialSuccess) {
    finalState = 'warning';
  } else {
    finalState = 'error';
  }

  // The executor logs these intermediates (plus the pre-override finalState)
  // in its 'Final state determination' debug entry.
  const debugFlags = {
    hasProcessedVideos,
    hasDownloadedNewVideos,
    isWarningOnly,
    hasFailures,
    hasSuccesses,
    hasNonFatalPartialSuccess,
    finalState
  };

  let finalText;
  let finalErrorCode = jobErrorCode;
  if (wasTerminated) {
    finalState = 'terminated';
    const completedCount = videoDataCount;
    finalText = `Download terminated: ${terminationReason}. ${completedCount} video${completedCount !== 1 ? 's' : ''} completed successfully.`;
  } else if (botDetected) {
    finalState = 'failed';
    finalErrorCode = 'COOKIES_REQUIRED';
    finalText = 'Download failed: Bot detection encountered. Please set cookies in your Configuration or try different cookies to resolve this issue.';
  } else if (monitorHasError && finalState === 'complete' && !flags.hasOnlyHandledErrors) {
    // Don't let a recognized termination flip the state back to error
    // via DownloadProgressMonitor's broad hasError flag.
    finalState = 'error';
    finalText = 'Download failed';
  } else if (finalState === 'complete' || finalState === 'warning') {
    const actualCount = videoDataCount;

    const parts = [];
    if (actualCount > 0) {
      parts.push(`${actualCount} video${actualCount !== 1 ? 's' : ''} downloaded`);
    }
    // Failures handed to a queued auto-retry are reported under the retry
    // part only, matching finalSummary's totalFailed/totalAutoRetried split.
    const reportedFailedCount = Math.max(0, failedCount - autoRetryQueuedCount);
    if (reportedFailedCount > 0) {
      parts.push(`${reportedFailedCount} failed`);
    }
    if (autoRetryQueuedCount > 0) {
      parts.push(`${autoRetryQueuedCount} queued for auto-retry`);
    }
    if (skippedCount > 0) {
      parts.push(`${skippedCount} already existed`);
    }
    if (terminatedChannelCount > 0) {
      parts.push(`${terminatedChannelCount} channel${terminatedChannelCount !== 1 ? 's' : ''} marked terminated`);
    }
    if (terminationFailureCount > 0) {
      parts.push(`${terminationFailureCount} termination${terminationFailureCount !== 1 ? 's' : ''} could not be auto-disabled`);
    }

    if (parts.length > 0) {
      const statusText = finalState === 'warning' ? 'completed with errors' : 'completed';
      finalText = `Download ${statusText}: ${parts.join(', ')}`;
    } else {
      finalText = 'Download completed: No new videos to download';
    }
  } else if (autoRetryQueuedCount > 0) {
    finalText = `Download failed: ${autoRetryQueuedCount} video${autoRetryQueuedCount !== 1 ? 's' : ''} queued for auto-retry`;
    const remainingFailedCount = Math.max(0, failedCount - autoRetryQueuedCount);
    if (remainingFailedCount > 0) {
      finalText += `, ${remainingFailedCount} other failure${remainingFailedCount !== 1 ? 's' : ''}`;
    }
  } else {
    finalText = 'Download failed';
  }

  return { finalState, finalText, finalErrorCode, debugFlags };
}

function buildJobDataPayload({ videoData, failedVideosList, terminatedChannels, terminatedChannelIds, terminationFailures }) {
  return {
    videos: videoData || [],
    failedVideos: failedVideosList || [],
    terminatedChannels: [...terminatedChannels],
    totalTerminatedChannels: terminatedChannelIds.size,
    terminationFailures: [...terminationFailures],
    totalTerminationFailures: terminationFailures.length
  };
}

module.exports = {
  computeOutcomeFlags,
  describeNonZeroExit,
  resolveTerminalStatus,
  resolveFinalPresentation,
  buildJobDataPayload
};
