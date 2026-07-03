/* eslint-env jest */

const {
  planAutoRetry,
  isTransient403Failure,
  resolveRetryCount,
  MAX_AUTO_RETRY_COUNT,
  DEFAULT_AUTO_RETRY_COUNT,
} = require('../transient403RetryPlanner');

const failedVideo = (overrides = {}) => ({
  youtubeId: 'abc123def45',
  title: 'Some Video',
  channel: 'Some Channel',
  error: 'unable to download video data: HTTP Error 403: Forbidden',
  url: null,
  ...overrides,
});

describe('transient403RetryPlanner', () => {
  describe('isTransient403Failure', () => {
    it('matches the classic mid-stream data 403 error', () => {
      expect(isTransient403Failure(failedVideo())).toBe(true);
    });

    it('matches the alternate "403: Forbidden" format case-insensitively', () => {
      expect(isTransient403Failure(failedVideo({ error: 'HTTP ERROR 403: FORBIDDEN' }))).toBe(true);
      expect(isTransient403Failure(failedVideo({ error: 'Request returned 403: forbidden' }))).toBe(true);
    });

    it('matches fragment failures only when the run-level 403 flag is set', () => {
      const fragmentError = failedVideo({ error: 'fragment 3 not found, unable to continue' });
      expect(isTransient403Failure(fragmentError, { httpForbiddenDetected: true })).toBe(true);
      expect(isTransient403Failure(fragmentError, { httpForbiddenDetected: false })).toBe(false);
    });

    it('matches "giving up after N fragment retries" when the run-level 403 flag is set', () => {
      const givingUp = failedVideo({ error: 'Giving up after 10 fragment retries' });
      expect(isTransient403Failure(givingUp, { httpForbiddenDetected: true })).toBe(true);
      expect(isTransient403Failure(givingUp, { httpForbiddenDetected: false })).toBe(false);
    });

    it('does not match unrelated failures even when the run-level 403 flag is set', () => {
      const unrelated = failedVideo({ error: 'Media file not found or incomplete' });
      expect(isTransient403Failure(unrelated, { httpForbiddenDetected: true })).toBe(false);
      expect(isTransient403Failure(failedVideo({ error: 'Video unavailable' }))).toBe(false);
    });

    it('handles a missing error message', () => {
      expect(isTransient403Failure(failedVideo({ error: undefined }))).toBe(false);
      expect(isTransient403Failure(undefined)).toBe(false);
    });
  });

  describe('resolveRetryCount', () => {
    it('falls back to the default when the config value is missing or invalid', () => {
      expect(resolveRetryCount(undefined)).toBe(DEFAULT_AUTO_RETRY_COUNT);
      expect(resolveRetryCount(null)).toBe(DEFAULT_AUTO_RETRY_COUNT);
      expect(resolveRetryCount('not-a-number')).toBe(DEFAULT_AUTO_RETRY_COUNT);
    });

    it('clamps to the hard ceiling and floor', () => {
      expect(resolveRetryCount(10)).toBe(MAX_AUTO_RETRY_COUNT);
      expect(resolveRetryCount(-1)).toBe(0);
      expect(resolveRetryCount(0)).toBe(0);
      expect(resolveRetryCount(2)).toBe(2);
    });
  });

  describe('planAutoRetry', () => {
    it('returns the 403 failures with reconstructed URLs and attempt 1', () => {
      const plan = planAutoRetry({ failedVideosList: [failedVideo()] });

      expect(plan).toEqual({
        retryVideos: [{
          youtubeId: 'abc123def45',
          url: 'https://www.youtube.com/watch?v=abc123def45',
        }],
        nextAttempt: 1,
      });
    });

    it('keeps the recorded URL when the failure already has one', () => {
      const plan = planAutoRetry({
        failedVideosList: [failedVideo({ url: 'https://youtu.be/abc123def45' })],
      });

      expect(plan.retryVideos[0].url).toBe('https://youtu.be/abc123def45');
    });

    it('filters non-403 failures out of the retry set', () => {
      const plan = planAutoRetry({
        failedVideosList: [
          failedVideo(),
          failedVideo({ youtubeId: 'other1234567', error: 'Postprocessing failed' }),
        ],
      });

      expect(plan.retryVideos).toHaveLength(1);
      expect(plan.retryVideos[0].youtubeId).toBe('abc123def45');
    });

    it('returns null when no failure matches the 403 signature', () => {
      const plan = planAutoRetry({
        failedVideosList: [failedVideo({ error: 'Postprocessing failed' })],
      });

      expect(plan).toBeNull();
    });

    it('returns null when bot detection fired', () => {
      expect(planAutoRetry({ failedVideosList: [failedVideo()], botDetected: true })).toBeNull();
    });

    it('returns null when the job was terminated', () => {
      expect(planAutoRetry({ failedVideosList: [failedVideo()], wasTerminated: true })).toBeNull();
    });

    it('returns null when there are no failures', () => {
      expect(planAutoRetry({ failedVideosList: [] })).toBeNull();
      expect(planAutoRetry({})).toBeNull();
    });

    it('returns null when auto-retry is disabled via maxAttempts 0', () => {
      expect(planAutoRetry({ failedVideosList: [failedVideo()], maxAttempts: 0 })).toBeNull();
    });

    it('stops once the attempt budget is spent', () => {
      const sourceJobData = { autoRetryAttempt: 1 };

      expect(planAutoRetry({ failedVideosList: [failedVideo()], sourceJobData })).toBeNull();
      expect(planAutoRetry({ failedVideosList: [failedVideo()], sourceJobData, maxAttempts: 2 }))
        .toEqual(expect.objectContaining({ nextAttempt: 2 }));
    });

    it('never exceeds the hard ceiling even with an oversized maxAttempts', () => {
      const sourceJobData = { autoRetryAttempt: MAX_AUTO_RETRY_COUNT };

      expect(planAutoRetry({ failedVideosList: [failedVideo()], sourceJobData, maxAttempts: 99 })).toBeNull();
    });

    it('reads the attempt counter from nested queued-job data', () => {
      const sourceJobData = { data: { autoRetryAttempt: 1 } };

      expect(planAutoRetry({ failedVideosList: [failedVideo()], sourceJobData })).toBeNull();
    });

    it('retries fragment failures when the run-level 403 flag is set', () => {
      const plan = planAutoRetry({
        failedVideosList: [failedVideo({ error: 'Giving up after 5 fragment retries' })],
        httpForbiddenDetected: true,
      });

      expect(plan).not.toBeNull();
    });
  });
});
