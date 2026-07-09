// Pure decision logic for auto-retrying videos that failed with a transient
// HTTP 403 mid-download. googlevideo sometimes rejects an already-issued
// stream URL mid-transfer; yt-dlp's own --retries re-request the same
// rejected URL, so only a fresh yt-dlp run (fresh extraction) can recover.
// The finalizer consults this planner after partitioning results and
// enqueues a follow-up URL-list job for the retryable subset. No I/O here.

// Hard ceiling on retry attempts regardless of configuration, so a blocked IP
// isn't retried endlessly.
const MAX_AUTO_RETRY_COUNT = 3;
const DEFAULT_AUTO_RETRY_COUNT = 1;

const HTTP_403_PATTERN = /http error 403|403[:\s]+forbidden/i;

// Fragment-based 403 failures surface the 403 only in WARNING lines; the final
// ERROR line just reports the data/fragment failure. When the run-level 403
// flag is set, treat these error shapes as 403-caused.
const DATA_DOWNLOAD_FAILURE_PATTERNS = [
  /unable to download video data/i,
  /fragment \S+ not found/i,
  /giving up after \d+ fragment retries/i,
];

// Job data may be the flat payload or a queued-job wrapper with the payload
// nested under .data (see downloadModule.getJobDataValue).
function readJobDataValue(jobData, key) {
  if (!jobData) return undefined;
  if (Object.prototype.hasOwnProperty.call(jobData, key)) return jobData[key];
  if (jobData.data && Object.prototype.hasOwnProperty.call(jobData.data, key)) {
    return jobData.data[key];
  }
  return undefined;
}

// 0 disables auto-retry.
function resolveRetryCount(configValue) {
  const parsed = Number(configValue);
  if (configValue === undefined || configValue === null || !Number.isFinite(parsed)) {
    return DEFAULT_AUTO_RETRY_COUNT;
  }
  return Math.min(Math.max(Math.trunc(parsed), 0), MAX_AUTO_RETRY_COUNT);
}

// Permanent skips (members-only, premiere, terminated channel) never reach
// failedVideosList, so they cannot match here.
function isTransient403Failure(failedVideo, { httpForbiddenDetected = false } = {}) {
  const error = String((failedVideo && failedVideo.error) || '');
  if (HTTP_403_PATTERN.test(error)) {
    return true;
  }
  if (httpForbiddenDetected) {
    return DATA_DOWNLOAD_FAILURE_PATTERNS.some((pattern) => pattern.test(error));
  }
  return false;
}

// Decides whether (and for which videos) to enqueue an auto-retry job.
// botDetected means a retry can't help (cookies are required); sourceJobData
// carries the attempt counter. Returns { retryVideos, nextAttempt } or null.
function planAutoRetry({
  failedVideosList,
  httpForbiddenDetected = false,
  botDetected = false,
  wasTerminated = false,
  sourceJobData = {},
  maxAttempts,
} = {}) {
  if (botDetected || wasTerminated) return null;
  if (!Array.isArray(failedVideosList) || failedVideosList.length === 0) return null;

  const budget = resolveRetryCount(maxAttempts);
  const attempt = Number(readJobDataValue(sourceJobData, 'autoRetryAttempt')) || 0;
  if (attempt >= budget) return null;

  const retryVideos = failedVideosList
    .filter((video) => video && video.youtubeId)
    .filter((video) => isTransient403Failure(video, { httpForbiddenDetected }))
    .map((video) => ({
      youtubeId: video.youtubeId,
      // Channel-sweep failures never enter the archive diff, so their url is
      // usually null; reconstruct it from the youtube id.
      url: video.url || `https://www.youtube.com/watch?v=${video.youtubeId}`,
    }));

  if (retryVideos.length === 0) return null;

  return { retryVideos, nextAttempt: attempt + 1 };
}

module.exports = {
  planAutoRetry,
  isTransient403Failure,
  resolveRetryCount,
  MAX_AUTO_RETRY_COUNT,
  DEFAULT_AUTO_RETRY_COUNT,
};
