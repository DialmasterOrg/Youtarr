const {
  computeOutcomeFlags,
  describeNonZeroExit,
  resolveTerminalStatus,
  resolveFinalPresentation,
  buildJobDataPayload
} = require('../downloadStatusResolver');

describe('downloadStatusResolver', () => {
  describe('computeOutcomeFlags', () => {
    const baseInput = {
      code: 1,
      expectedSkipCount: 0,
      terminatedChannelCount: 0,
      failedCount: 0,
      unexpectedErrorCount: 0,
      botDetected: false,
      httpForbiddenDetected: false
    };

    it('treats exit 1 with only expected skips as both flags true', () => {
      const flags = computeOutcomeFlags({ ...baseInput, expectedSkipCount: 2 });
      expect(flags).toEqual({ hasOnlyExpectedSkips: true, hasOnlyHandledErrors: true });
    });

    it('returns both flags false when skips are mixed with unexpected errors', () => {
      const flags = computeOutcomeFlags({ ...baseInput, expectedSkipCount: 2, unexpectedErrorCount: 1 });
      expect(flags).toEqual({ hasOnlyExpectedSkips: false, hasOnlyHandledErrors: false });
    });

    it('returns both flags false when skips are mixed with failed videos', () => {
      const flags = computeOutcomeFlags({ ...baseInput, expectedSkipCount: 2, failedCount: 1 });
      expect(flags).toEqual({ hasOnlyExpectedSkips: false, hasOnlyHandledErrors: false });
    });

    it('treats terminations-only as handled errors but not expected skips', () => {
      const flags = computeOutcomeFlags({ ...baseInput, terminatedChannelCount: 1 });
      expect(flags).toEqual({ hasOnlyExpectedSkips: false, hasOnlyHandledErrors: true });
    });

    it('forces both flags false when bot detection fired', () => {
      const flags = computeOutcomeFlags({ ...baseInput, expectedSkipCount: 2, terminatedChannelCount: 1, botDetected: true });
      expect(flags).toEqual({ hasOnlyExpectedSkips: false, hasOnlyHandledErrors: false });
    });

    it('forces both flags false when HTTP 403 was detected', () => {
      const flags = computeOutcomeFlags({ ...baseInput, expectedSkipCount: 2, terminatedChannelCount: 1, httpForbiddenDetected: true });
      expect(flags).toEqual({ hasOnlyExpectedSkips: false, hasOnlyHandledErrors: false });
    });

    it('returns both flags false on exit code 0', () => {
      const flags = computeOutcomeFlags({ ...baseInput, code: 0, expectedSkipCount: 2, terminatedChannelCount: 1 });
      expect(flags).toEqual({ hasOnlyExpectedSkips: false, hasOnlyHandledErrors: false });
    });
  });

  describe('describeNonZeroExit', () => {
    const noFlags = { hasOnlyExpectedSkips: false, hasOnlyHandledErrors: false };
    const baseInput = {
      code: 1,
      signal: null,
      videoCount: 0,
      videoDataCount: 0,
      terminatedChannelCount: 0,
      httpForbiddenDetected: false,
      flags: noFlags,
      failureDetails: null
    };

    it('reports status Killed when the process was SIGKILLed', () => {
      const result = describeNonZeroExit({ ...baseInput, code: 137, signal: 'SIGKILL' });
      expect(result.status).toBe('Killed');
    });

    it('upgrades to Complete when only expected skips occurred with no terminations', () => {
      const result = describeNonZeroExit({
        ...baseInput,
        videoCount: 3,
        flags: { hasOnlyExpectedSkips: true, hasOnlyHandledErrors: true }
      });
      expect(result.status).toBe('Complete');
      expect(result.output).toBe('3 videos.');
      expect(result.notes).toBeUndefined();
      expect(result.errorCode).toBeUndefined();
    });

    it('describes handled terminations in output and notes', () => {
      const result = describeNonZeroExit({
        ...baseInput,
        videoCount: 5,
        terminatedChannelCount: 2,
        flags: { hasOnlyExpectedSkips: false, hasOnlyHandledErrors: true }
      });
      expect(result.status).toBe('Error');
      expect(result.output).toBe('5 videos, 2 channels marked terminated.');
      expect(result.notes).toBe('2 channels marked terminated by YouTube');
    });

    it('prefers the handled-terminations branch over skips-only Complete when channels were terminated', () => {
      const result = describeNonZeroExit({
        ...baseInput,
        videoCount: 3,
        terminatedChannelCount: 2,
        flags: { hasOnlyExpectedSkips: true, hasOnlyHandledErrors: true }
      });
      expect(result.status).toBe('Error');
      expect(result.output).toBe('3 videos, 2 channels marked terminated.');
      expect(result.notes).toBe('2 channels marked terminated by YouTube');
    });

    it('uses singular wording for a single terminated channel', () => {
      const result = describeNonZeroExit({
        ...baseInput,
        videoCount: 1,
        terminatedChannelCount: 1,
        flags: { hasOnlyExpectedSkips: false, hasOnlyHandledErrors: true }
      });
      expect(result.output).toBe('1 videos, 1 channel marked terminated.');
      expect(result.notes).toBe('1 channel marked terminated by YouTube');
    });

    it('recommends cookies when HTTP 403 was detected without cookies configured', () => {
      const result = describeNonZeroExit({ ...baseInput, videoCount: 2, httpForbiddenDetected: true });
      expect(result.errorCode).toBe('COOKIES_RECOMMENDED');
      expect(result.output).toBe('2 videos. Error: YouTube returned HTTP 403 (Forbidden)');
      expect(result.notes).toBe('YouTube denied access (HTTP 403). Configure cookies in Settings -> Cookies to resolve this issue.');
    });

    it('recommends refreshing or disabling cookies when HTTP 403 was detected with cookies enabled', () => {
      const result = describeNonZeroExit({
        ...baseInput,
        videoCount: 2,
        httpForbiddenDetected: true,
        cookiesEnabled: true
      });
      expect(result.errorCode).toBe('COOKIES_RECOMMENDED');
      expect(result.output).toBe('2 videos. Error: YouTube returned HTTP 403 (Forbidden)');
      expect(result.notes).toMatch(/re-export fresh cookies/i);
      expect(result.notes).toMatch(/disable cookies/i);
      expect(result.notes).not.toMatch(/configure cookies/i);
    });

    it('describes a generic failure with the exit code when nothing succeeded', () => {
      const result = describeNonZeroExit({ ...baseInput, code: 2, videoCount: 4 });
      expect(result.output).toBe('4 videos. Error: Command exited with code 2');
      expect(result.notes).toBe('Download failed (exit 2)');
      expect(result.errorCode).toBeUndefined();
    });

    it('notes partial failure when some videos succeeded on exit 1', () => {
      const result = describeNonZeroExit({ ...baseInput, videoCount: 4, videoDataCount: 2 });
      expect(result.notes).toBe('Some videos failed (exit 1)');
    });

    it('includes stall detection details in the failure reason', () => {
      const result = describeNonZeroExit({
        ...baseInput,
        code: 2,
        failureDetails: {
          stalled: true,
          progress: { percent: 45.67, speedBytesPerSecond: 10240 }
        }
      });
      expect(result.notes).toBe('Download failed (stall detected at 45.7% (10 KiB/s))');
    });

    it('uses the signal as the failure reason when present', () => {
      const result = describeNonZeroExit({ ...baseInput, code: 143, signal: 'SIGTERM' });
      expect(result.notes).toBe('Download failed (SIGTERM)');
    });

    it('returns hasPartialSuccess true only for exit 1 with successful videos', () => {
      expect(describeNonZeroExit({ ...baseInput, code: 1, videoDataCount: 1 }).hasPartialSuccess).toBe(true);
      expect(describeNonZeroExit({ ...baseInput, code: 2, videoDataCount: 1 }).hasPartialSuccess).toBe(false);
      expect(describeNonZeroExit({ ...baseInput, code: 1, videoDataCount: 0 }).hasPartialSuccess).toBe(false);
    });
  });

  describe('resolveTerminalStatus', () => {
    const noFlags = { hasOnlyExpectedSkips: false, hasOnlyHandledErrors: false };

    it('upgrades to Complete with Warnings for handled errors with terminations', () => {
      const status = resolveTerminalStatus({
        status: 'Error',
        flags: { hasOnlyExpectedSkips: false, hasOnlyHandledErrors: true },
        terminatedChannelCount: 1,
        hasPartialSuccess: false
      });
      expect(status).toBe('Complete with Warnings');
    });

    it('upgrades to Complete when only expected skips occurred', () => {
      const status = resolveTerminalStatus({
        status: 'Error',
        flags: { hasOnlyExpectedSkips: true, hasOnlyHandledErrors: true },
        terminatedChannelCount: 0,
        hasPartialSuccess: false
      });
      expect(status).toBe('Complete');
    });

    it('upgrades to Complete with Warnings on partial success', () => {
      const status = resolveTerminalStatus({
        status: 'Error',
        flags: noFlags,
        terminatedChannelCount: 0,
        hasPartialSuccess: true
      });
      expect(status).toBe('Complete with Warnings');
    });

    it('lets only-expected-skips Complete win over partial-success warnings', () => {
      const status = resolveTerminalStatus({
        status: 'Error',
        flags: { hasOnlyExpectedSkips: true, hasOnlyHandledErrors: false },
        terminatedChannelCount: 0,
        hasPartialSuccess: true
      });
      expect(status).toBe('Complete');
    });

    it('passes the input status through when no upgrade applies', () => {
      const status = resolveTerminalStatus({
        status: 'Killed',
        flags: noFlags,
        terminatedChannelCount: 0,
        hasPartialSuccess: false
      });
      expect(status).toBe('Killed');
    });
  });

  describe('resolveFinalPresentation', () => {
    const noFlags = { hasOnlyExpectedSkips: false, hasOnlyHandledErrors: false };
    const baseInput = {
      code: 0,
      jobErrorCode: undefined,
      wasTerminated: false,
      terminationReason: undefined,
      botDetected: false,
      monitorHasError: false,
      flags: noFlags,
      videoDataCount: 0,
      failedCount: 0,
      skippedCount: 0,
      terminatedChannelCount: 0,
      terminationFailureCount: 0,
      videoCount: 0,
      monitorCompletedCount: 0,
      unexpectedErrorCount: 0,
      httpForbiddenDetected: false
    };

    it('reports a clean success with the downloaded count', () => {
      const result = resolveFinalPresentation({
        ...baseInput,
        videoDataCount: 3,
        videoCount: 3,
        monitorCompletedCount: 3
      });
      expect(result.finalState).toBe('complete');
      expect(result.finalText).toBe('Download completed: 3 videos downloaded');
    });

    it('reports no new videos when nothing was downloaded or skipped', () => {
      const result = resolveFinalPresentation(baseInput);
      expect(result.finalState).toBe('complete');
      expect(result.finalText).toBe('Download completed: No new videos to download');
    });

    it('reports warning with failed count on clean exit with failures', () => {
      const result = resolveFinalPresentation({
        ...baseInput,
        videoDataCount: 1,
        failedCount: 2,
        videoCount: 3
      });
      expect(result.finalState).toBe('warning');
      expect(result.finalText).toBe('Download completed with errors: 1 video downloaded, 2 failed');
    });

    it('treats exit 1 with only expected skips as complete', () => {
      const result = resolveFinalPresentation({
        ...baseInput,
        code: 1,
        flags: { hasOnlyExpectedSkips: true, hasOnlyHandledErrors: true }
      });
      expect(result.finalState).toBe('complete');
    });

    it('mentions skipped existing videos in the final text', () => {
      const result = resolveFinalPresentation({
        ...baseInput,
        videoDataCount: 1,
        skippedCount: 3,
        videoCount: 1,
        monitorCompletedCount: 1
      });
      expect(result.finalText).toBe('Download completed: 1 video downloaded, 3 already existed');
    });

    it('reports warning for a single handled termination on exit 1', () => {
      const result = resolveFinalPresentation({
        ...baseInput,
        code: 1,
        flags: { hasOnlyExpectedSkips: false, hasOnlyHandledErrors: true },
        terminatedChannelCount: 1
      });
      expect(result.finalState).toBe('warning');
      expect(result.finalText).toBe('Download completed with errors: 1 channel marked terminated');
    });

    it('pluralizes multiple handled terminations on exit 1', () => {
      const result = resolveFinalPresentation({
        ...baseInput,
        code: 1,
        flags: { hasOnlyExpectedSkips: false, hasOnlyHandledErrors: true },
        terminatedChannelCount: 2
      });
      expect(result.finalState).toBe('warning');
      expect(result.finalText).toBe('Download completed with errors: 2 channels marked terminated');
    });

    it('reports warning for terminations on a clean exit', () => {
      const result = resolveFinalPresentation({
        ...baseInput,
        terminatedChannelCount: 1
      });
      expect(result.finalState).toBe('warning');
      expect(result.finalText).toBe('Download completed with errors: 1 channel marked terminated');
    });

    it('mentions termination failures that could not be auto-disabled', () => {
      const result = resolveFinalPresentation({
        ...baseInput,
        terminationFailureCount: 1
      });
      expect(result.finalText).toContain('1 termination could not be auto-disabled');
    });

    it('pluralizes multiple termination failures that could not be auto-disabled', () => {
      const result = resolveFinalPresentation({
        ...baseInput,
        terminationFailureCount: 2
      });
      expect(result.finalText).toContain('2 terminations could not be auto-disabled');
    });

    it('reports warning with errors wording for partial success on exit 1', () => {
      const result = resolveFinalPresentation({
        ...baseInput,
        code: 1,
        videoDataCount: 2,
        failedCount: 1,
        videoCount: 3,
        monitorCompletedCount: 2
      });
      expect(result.finalState).toBe('warning');
      expect(result.finalText).toBe('Download completed with errors: 2 videos downloaded, 1 failed');
    });

    it('reports a fully handed-off failure as queued for auto-retry, not failed', () => {
      // Matches finalSummary's split: the handed-off video is totalAutoRetried,
      // not totalFailed, so the text must not double-count it.
      const result = resolveFinalPresentation({
        ...baseInput,
        code: 1,
        videoDataCount: 2,
        failedCount: 1,
        videoCount: 3,
        monitorCompletedCount: 2,
        autoRetryQueuedCount: 1
      });
      expect(result.finalState).toBe('warning');
      expect(result.finalText).toBe('Download completed with errors: 2 videos downloaded, 1 queued for auto-retry');
    });

    it('reports non-retried failures separately from queued auto-retries', () => {
      const result = resolveFinalPresentation({
        ...baseInput,
        code: 1,
        videoDataCount: 2,
        failedCount: 2,
        videoCount: 4,
        monitorCompletedCount: 2,
        autoRetryQueuedCount: 1
      });
      expect(result.finalState).toBe('warning');
      expect(result.finalText).toBe('Download completed with errors: 2 videos downloaded, 1 failed, 1 queued for auto-retry');
    });

    it('mentions queued auto-retries when a hard failure processed nothing', () => {
      const result = resolveFinalPresentation({
        ...baseInput,
        code: 1,
        failedCount: 1,
        autoRetryQueuedCount: 1
      });
      expect(result.finalState).toBe('error');
      expect(result.finalText).toBe('Download failed: 1 video queued for auto-retry');
    });

    it('pluralizes queued auto-retries in the hard-failure text', () => {
      const result = resolveFinalPresentation({
        ...baseInput,
        code: 1,
        failedCount: 2,
        autoRetryQueuedCount: 2
      });
      expect(result.finalText).toBe('Download failed: 2 videos queued for auto-retry');
    });

    it('mentions non-retried failures in the hard-failure text', () => {
      const result = resolveFinalPresentation({
        ...baseInput,
        code: 1,
        failedCount: 3,
        autoRetryQueuedCount: 1
      });
      expect(result.finalText).toBe('Download failed: 1 video queued for auto-retry, 2 other failures');
    });

    it('reports error when a hard failure processed nothing', () => {
      const result = resolveFinalPresentation({
        ...baseInput,
        code: 2
      });
      expect(result.finalState).toBe('error');
      expect(result.finalText).toBe('Download failed');
    });

    it('reports failed with COOKIES_REQUIRED when bot detection fired', () => {
      const result = resolveFinalPresentation({
        ...baseInput,
        code: 1,
        botDetected: true
      });
      expect(result.finalState).toBe('failed');
      expect(result.finalErrorCode).toBe('COOKIES_REQUIRED');
      expect(result.finalText).toBe('Download failed: Bot detection encountered. Please set cookies in your Configuration or try different cookies to resolve this issue.');
    });

    it('uses stale-cookie messaging for bot detection when cookies are enabled', () => {
      const result = resolveFinalPresentation({
        ...baseInput,
        code: 1,
        botDetected: true,
        cookiesEnabled: true
      });
      expect(result.finalState).toBe('failed');
      expect(result.finalErrorCode).toBe('COOKIES_REQUIRED');
      expect(result.finalText).toMatch(/expired or rotated/i);
      expect(result.finalText).toMatch(/re-export fresh cookies/i);
      expect(result.finalText).not.toMatch(/set cookies/i);
    });

    it('reports terminated with the reason and singular completed count', () => {
      const result = resolveFinalPresentation({
        ...baseInput,
        wasTerminated: true,
        terminationReason: 'Manually terminated by user',
        videoDataCount: 1
      });
      expect(result.finalState).toBe('terminated');
      expect(result.finalText).toBe('Download terminated: Manually terminated by user. 1 video completed successfully.');
    });

    it('pluralizes completed videos in the terminated message', () => {
      const result = resolveFinalPresentation({
        ...baseInput,
        wasTerminated: true,
        terminationReason: 'Download timeout',
        videoDataCount: 2
      });
      expect(result.finalText).toBe('Download terminated: Download timeout. 2 videos completed successfully.');
    });

    it('overrides a would-be-complete state to error when the monitor saw an error', () => {
      const result = resolveFinalPresentation({
        ...baseInput,
        monitorHasError: true,
        videoDataCount: 1,
        videoCount: 1
      });
      expect(result.finalState).toBe('error');
      expect(result.finalText).toBe('Download failed');
    });

    it('does not apply the monitor error override when all errors were handled', () => {
      const result = resolveFinalPresentation({
        ...baseInput,
        code: 1,
        monitorHasError: true,
        flags: { hasOnlyExpectedSkips: true, hasOnlyHandledErrors: true }
      });
      expect(result.finalState).toBe('complete');
    });

    it('passes jobErrorCode through as finalErrorCode when not bot-detected', () => {
      const result = resolveFinalPresentation({
        ...baseInput,
        code: 2,
        jobErrorCode: 'COOKIES_RECOMMENDED',
        httpForbiddenDetected: true
      });
      expect(result.finalErrorCode).toBe('COOKIES_RECOMMENDED');
    });

    it('returns debugFlags describing the pre-override derivation', () => {
      const result = resolveFinalPresentation({
        ...baseInput,
        code: 1,
        videoDataCount: 1,
        failedCount: 1,
        videoCount: 2,
        monitorCompletedCount: 1
      });
      expect(result.debugFlags).toEqual({
        hasProcessedVideos: true,
        hasDownloadedNewVideos: true,
        isWarningOnly: true,
        hasFailures: true,
        hasSuccesses: true,
        hasNonFatalPartialSuccess: true,
        finalState: 'warning'
      });
    });

    it('keeps the pre-override state in debugFlags when an override applies', () => {
      const result = resolveFinalPresentation({
        ...baseInput,
        code: 2,
        wasTerminated: true,
        terminationReason: 'Download timeout'
      });
      expect(result.finalState).toBe('terminated');
      expect(result.debugFlags.finalState).toBe('error');
    });
  });

  describe('buildJobDataPayload', () => {
    const buildInput = () => ({
      videoData: [{ youtubeId: 'abc' }],
      failedVideosList: [{ youtubeId: 'def' }],
      terminatedChannels: [{ channelId: 'chan1' }],
      terminatedChannelIds: new Set(['chan1', 'chan2']),
      terminationFailures: [{ channelId: 'chan3' }]
    });

    it('maps every field with totals derived from the collections', () => {
      const payload = buildJobDataPayload(buildInput());
      expect(payload).toEqual({
        videos: [{ youtubeId: 'abc' }],
        failedVideos: [{ youtubeId: 'def' }],
        diagnoses: [],
        terminatedChannels: [{ channelId: 'chan1' }],
        totalTerminatedChannels: 2,
        terminationFailures: [{ channelId: 'chan3' }],
        totalTerminationFailures: 1
      });
    });

    it('defaults videos and failedVideos to empty arrays', () => {
      const payload = buildJobDataPayload({
        ...buildInput(),
        videoData: null,
        failedVideosList: undefined
      });
      expect(payload.videos).toEqual([]);
      expect(payload.failedVideos).toEqual([]);
    });

    it('includes the diagnoses list in the payload', () => {
      const diagnoses = [{ key: 'http-403-cookies-enabled', title: 't', message: 'm', count: 2 }];
      const payload = buildJobDataPayload({ ...buildInput(), diagnoses });

      expect(payload.diagnoses).toEqual(diagnoses);
    });

    it('defaults diagnoses to an empty array when not provided', () => {
      const payload = buildJobDataPayload(buildInput());

      expect(payload.diagnoses).toEqual([]);
    });

    it('copies the termination arrays so later mutation does not change the payload', () => {
      const input = buildInput();
      const payload = buildJobDataPayload(input);

      input.terminatedChannels.push({ channelId: 'late' });
      input.terminationFailures.push({ channelId: 'late' });

      expect(payload.terminatedChannels).toEqual([{ channelId: 'chan1' }]);
      expect(payload.terminationFailures).toEqual([{ channelId: 'chan3' }]);
    });
  });
});
