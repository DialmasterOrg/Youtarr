jest.mock('../../../logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

// ytDlpRunner pulls in tempPathManager and configModule behind it; mock both
// so requiring the real ytDlpRunner stays side-effect free (the real
// configModule starts an fs.watch at require time, which keeps jest from
// exiting). The executor tests use the real ytDlpRunner predicates, so we do too.
jest.mock('../tempPathManager');
jest.mock('../../configModule', () => ({
  getConfig: jest.fn(),
  directoryPath: '/mock/output'
}));

const {
  YtdlpErrorTracker,
  isExpectedYtdlpSkipMessage,
  isMembersOnlyMessage,
  extractYoutubeIdFromYtdlpError,
  extractChannelIdFromYtdlpError,
} = require('../YtdlpErrorTracker');

const TERMINATED_CHANNEL_ID = 'UCabcdefghijklmnopqrstuv';
const TERMINATED_LINE = `ERROR: [youtube:tab] ${TERMINATED_CHANNEL_ID}: This account has been terminated for a violation of YouTube's Terms of Service.`;

function createTracker(overrides = {}) {
  const deps = {
    persistMembersOnlyAvailability: jest.fn(),
    persistTerminatedChannel: jest.fn().mockResolvedValue({
      uploader: 'Some Channel',
      url: 'https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv',
      terminated_at: new Date('2026-01-01T00:00:00Z'),
    }),
    emitWarningMessage: jest.fn(),
    ...overrides,
  };
  return { tracker: new YtdlpErrorTracker(deps), deps };
}

describe('YtdlpErrorTracker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('handleErrorLine', () => {
    it.each(['stdout', 'stderr'])('keeps a video successful when SponsorBlock times out on %s', (source) => {
      const { tracker } = createTracker();
      tracker.trackVideoStart('abc123def45');

      const consumed = tracker.handleErrorLine(
        'ERROR: Unable to communicate with SponsorBlock API: Read timed out.', source
      );

      expect(consumed).toBe(true);
      expect(tracker.failedVideos.size).toBe(0);
      expect(tracker.unexpectedErrorCount).toBe(0);
      expect(tracker.sponsorBlockFailureCount).toBe(1);
    });

    it('counts affected videos rather than repeated SponsorBlock error lines', () => {
      const { tracker } = createTracker();
      const line = 'ERROR: Unable to communicate with SponsorBlock API: Read timed out.';
      tracker.trackVideoStart('abc123def45');
      tracker.handleErrorLine(line, 'stdout');
      tracker.handleErrorLine(line, 'stderr');
      tracker.trackVideoStart('def456ghi78');
      tracker.handleErrorLine(line, 'stderr');

      expect(tracker.sponsorBlockFailureCount).toBe(2);
    });

    it('still records a SponsorBlock preprocessing error as a video failure', () => {
      const { tracker } = createTracker();
      tracker.trackVideoStart('abc123def45');
      tracker.handleErrorLine(
        'ERROR: Preprocessing: Unable to communicate with SponsorBlock API: Read timed out.', 'stderr'
      );

      expect(tracker.failedVideos.has('abc123def45')).toBe(true);
      expect(tracker.sponsorBlockFailureCount).toBe(0);
    });

    it('does not erase a real failure when a SponsorBlock error follows it', () => {
      const { tracker } = createTracker();
      tracker.trackVideoStart('abc123def45');
      tracker.handleErrorLine('ERROR: Unable to download video data', 'stderr');
      tracker.handleErrorLine('ERROR: Unable to communicate with SponsorBlock API: Read timed out.', 'stderr');

      expect(tracker.failedVideos.get('abc123def45').error).toBe('Unable to download video data');
      expect(tracker.unexpectedErrorCount).toBe(1);
    });

    it('returns false and records nothing for a non-ERROR line', () => {
      const { tracker } = createTracker();

      const consumed = tracker.handleErrorLine('[download] 50.0% of 10MiB', 'stdout');

      expect(consumed).toBe(false);
      expect(tracker.expectedSkipCount).toBe(0);
      expect(tracker.unexpectedErrorCount).toBe(0);
      expect(tracker.failedVideos.size).toBe(0);
    });

    it('counts an expected-skip ERROR without recording a failed video', () => {
      const { tracker } = createTracker();

      const consumed = tracker.handleErrorLine('ERROR: This live event will begin in a few moments', 'stdout');

      expect(consumed).toBe(true);
      expect(tracker.expectedSkipCount).toBe(1);
      expect(tracker.failedVideos.size).toBe(0);
    });

    it('records members-only video id extracted from the error message', () => {
      const { tracker, deps } = createTracker();

      const consumed = tracker.handleErrorLine(
        'ERROR: [youtube] abc123def45: Join this channel to get access to members-only content',
        'stdout'
      );

      expect(consumed).toBe(true);
      expect(tracker.membersOnlyVideoIds.has('abc123def45')).toBe(true);
      expect(deps.persistMembersOnlyAvailability).toHaveBeenCalledWith('abc123def45');
    });

    it('falls back to currentVideoId when the members-only error has no extractable id', () => {
      const { tracker, deps } = createTracker();
      tracker.trackVideoStart('fallbackVid');

      tracker.handleErrorLine('ERROR: Join this channel to get access to members-only content', 'stderr');

      expect(tracker.membersOnlyVideoIds.has('fallbackVid')).toBe(true);
      expect(deps.persistMembersOnlyAvailability).toHaveBeenCalledWith('fallbackVid');
    });

    it('records a terminated channel and emits the disabled warning on successful persistence', async () => {
      const { tracker, deps } = createTracker();

      const consumed = tracker.handleErrorLine(TERMINATED_LINE, 'stdout');
      await tracker.settlePersistence();

      expect(consumed).toBe(true);
      expect(deps.persistTerminatedChannel).toHaveBeenCalledWith(TERMINATED_CHANNEL_ID);
      expect(tracker.terminatedChannelIds.has(TERMINATED_CHANNEL_ID)).toBe(true);
      expect(tracker.terminatedChannels).toEqual([
        {
          channelId: TERMINATED_CHANNEL_ID,
          uploader: 'Some Channel',
          url: 'https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv',
          terminatedAt: new Date('2026-01-01T00:00:00Z'),
        },
      ]);
      expect(deps.emitWarningMessage).toHaveBeenCalledWith(
        expect.stringContaining('marked terminated by YouTube; scheduled downloads disabled')
      );
    });

    it('records a termination failure when persistence resolves null', async () => {
      const { tracker, deps } = createTracker({
        persistTerminatedChannel: jest.fn().mockResolvedValue(null),
      });

      tracker.handleErrorLine(TERMINATED_LINE, 'stdout');
      await tracker.settlePersistence();

      expect(tracker.unexpectedErrorCount).toBe(1);
      expect(tracker.terminationFailures).toEqual([TERMINATED_CHANNEL_ID]);
      expect(tracker.terminatedChannelIds.size).toBe(0);
      expect(deps.emitWarningMessage).toHaveBeenCalledWith(
        expect.stringContaining('could not be auto-disabled')
      );
    });

    it('persists a terminated channel only once across stdout and stderr', () => {
      const { tracker, deps } = createTracker();

      expect(tracker.handleErrorLine(TERMINATED_LINE, 'stdout')).toBe(true);
      expect(tracker.handleErrorLine(TERMINATED_LINE, 'stderr')).toBe(true);

      expect(deps.persistTerminatedChannel).toHaveBeenCalledTimes(1);
    });

    it('treats a terminated-account error without a channel id as an unexpected error', () => {
      const { tracker, deps } = createTracker();

      const consumed = tracker.handleErrorLine(
        'ERROR: This account has been terminated for a violation of YouTube\'s Terms of Service.',
        'stderr'
      );

      expect(consumed).toBe(false);
      expect(tracker.unexpectedErrorCount).toBe(1);
      expect(deps.persistTerminatedChannel).not.toHaveBeenCalled();
    });

    it('records the first failure for the current video and does not overwrite it', () => {
      const { tracker } = createTracker();
      tracker.trackVideoStart('vid12345678');

      const consumed = tracker.handleErrorLine('ERROR: Something bad happened', 'stdout');
      tracker.handleErrorLine('ERROR: A different later failure', 'stdout');

      expect(consumed).toBe(false);
      expect(tracker.failedVideos.get('vid12345678')).toEqual({
        youtubeId: 'vid12345678',
        error: 'Something bad happened',
        url: null,
      });
    });

    it('counts an unexpected error without a current video but records no failed video', () => {
      const { tracker } = createTracker();

      const consumed = tracker.handleErrorLine('ERROR: Something bad happened', 'stderr');

      expect(consumed).toBe(false);
      expect(tracker.unexpectedErrorCount).toBe(1);
      expect(tracker.failedVideos.size).toBe(0);
    });
  });

  describe('handleWarningLine', () => {
    const SUBTITLE_ERROR_LINE = 'ERROR: [download] Got error: HTTPSConnectionPool(host=\'www.youtube.com\', port=443): Read timed out. (read timeout=30.0). Giving up after 2 retries';
    const SUBTITLE_WARNING_LINE = 'WARNING: Unable to download video subtitles for \'en\': HTTPSConnectionPool(host=\'www.youtube.com\', port=443): Read timed out. (read timeout=30.0)';

    it('drops the failure recorded from a subtitle download ERROR when the subtitle WARNING follows', () => {
      const { tracker } = createTracker();
      tracker.trackVideoStart('vid12345678');
      tracker.handleErrorLine(SUBTITLE_ERROR_LINE, 'stderr');

      const consumed = tracker.handleWarningLine(SUBTITLE_WARNING_LINE, 'stderr');

      expect(consumed).toBe(true);
      expect(tracker.failedVideos.size).toBe(0);
      expect(tracker.unexpectedErrorCount).toBe(0);
    });

    it('counts each dropped subtitle failure', () => {
      const { tracker } = createTracker();
      tracker.trackVideoStart('vid12345678');
      tracker.handleErrorLine(SUBTITLE_ERROR_LINE, 'stderr');
      tracker.handleWarningLine(SUBTITLE_WARNING_LINE, 'stderr');
      tracker.trackVideoStart('vid87654321');
      tracker.handleErrorLine(SUBTITLE_ERROR_LINE, 'stderr');
      tracker.handleWarningLine(SUBTITLE_WARNING_LINE, 'stderr');

      expect(tracker.subtitleFailureCount).toBe(2);
    });

    it('keeps an earlier unrelated failure when the subtitle WARNING explains a later error', () => {
      const { tracker } = createTracker();
      tracker.trackVideoStart('vid12345678');
      tracker.handleErrorLine('ERROR: Something bad happened', 'stderr');
      tracker.handleErrorLine(SUBTITLE_ERROR_LINE, 'stderr');

      const consumed = tracker.handleWarningLine(SUBTITLE_WARNING_LINE, 'stderr');

      expect(consumed).toBe(false);
      expect(tracker.failedVideos.get('vid12345678').error).toBe('Something bad happened');
      expect(tracker.unexpectedErrorCount).toBe(2);
    });

    it('handles one subtitle failure per language independently', () => {
      const { tracker } = createTracker();
      tracker.trackVideoStart('vid12345678');
      tracker.handleErrorLine(SUBTITLE_ERROR_LINE, 'stderr');
      tracker.handleWarningLine(SUBTITLE_WARNING_LINE, 'stderr');
      tracker.handleErrorLine(SUBTITLE_ERROR_LINE, 'stderr');

      const consumed = tracker.handleWarningLine(SUBTITLE_WARNING_LINE.replace('\'en\'', '\'de\''), 'stderr');

      expect(consumed).toBe(true);
      expect(tracker.failedVideos.size).toBe(0);
      expect(tracker.unexpectedErrorCount).toBe(0);
    });

    it('returns false and changes nothing for a WARNING that is not about subtitles', () => {
      const { tracker } = createTracker();
      tracker.trackVideoStart('vid12345678');
      tracker.handleErrorLine(SUBTITLE_ERROR_LINE, 'stderr');

      const consumed = tracker.handleWarningLine(
        'WARNING: The extractor specified to use impersonation for this download, but no impersonate target is available.',
        'stderr'
      );

      expect(consumed).toBe(false);
      expect(tracker.failedVideos.size).toBe(1);
      expect(tracker.unexpectedErrorCount).toBe(1);
    });

    it('returns false when no video is being tracked', () => {
      const { tracker } = createTracker();
      tracker.handleErrorLine(SUBTITLE_ERROR_LINE, 'stderr');

      const consumed = tracker.handleWarningLine(SUBTITLE_WARNING_LINE, 'stderr');

      expect(consumed).toBe(false);
      expect(tracker.unexpectedErrorCount).toBe(1);
    });
  });

  describe('dropSubtitleOnlyFailure', () => {
    const VIDEO_ID = 'vid12345678';
    const SUBTITLE_PATH = '/tmp/youtarr/Channel/Title [vid12345678].en.vtt';
    const MEDIA_PATH = '/tmp/youtarr/Channel/Title [vid12345678].f137.mp4';
    // yt-dlp prints this, with no WARNING after it, when YouTube sends an empty subtitle file
    const EMPTY_SUBTITLE_ERROR_LINE = 'ERROR: Did not get any data blocks';

    const startVideoWithEmptySubtitle = (tracker) => {
      tracker.trackVideoStart(VIDEO_ID);
      tracker.trackSubtitleWrite(SUBTITLE_PATH);
      tracker.handleErrorLine(EMPTY_SUBTITLE_ERROR_LINE, 'stderr');
    };

    it('records an ERROR while subtitles are written as a failure until the video file is confirmed', () => {
      const { tracker } = createTracker();
      startVideoWithEmptySubtitle(tracker);

      expect(tracker.failedVideos.has(VIDEO_ID)).toBe(true);
    });

    it('drops the failure when the only errors came while subtitles were written', () => {
      const { tracker } = createTracker();
      startVideoWithEmptySubtitle(tracker);

      const dropped = tracker.dropSubtitleOnlyFailure(VIDEO_ID);

      expect(dropped).toBe(true);
      expect(tracker.failedVideos.has(VIDEO_ID)).toBe(false);
    });

    it('counts the dropped error as a subtitle failure instead of an unexpected error', () => {
      const { tracker } = createTracker();
      startVideoWithEmptySubtitle(tracker);

      tracker.dropSubtitleOnlyFailure(VIDEO_ID);

      expect({
        unexpectedErrorCount: tracker.unexpectedErrorCount,
        subtitleFailureCount: tracker.subtitleFailureCount,
      }).toEqual({ unexpectedErrorCount: 0, subtitleFailureCount: 1 });
    });

    it('counts every subtitle error of the video', () => {
      const { tracker } = createTracker();
      startVideoWithEmptySubtitle(tracker);
      tracker.trackSubtitleWrite(SUBTITLE_PATH.replace('.en.', '.de.'));
      tracker.handleErrorLine(EMPTY_SUBTITLE_ERROR_LINE, 'stderr');

      tracker.dropSubtitleOnlyFailure(VIDEO_ID);

      expect({
        unexpectedErrorCount: tracker.unexpectedErrorCount,
        subtitleFailureCount: tracker.subtitleFailureCount,
      }).toEqual({ unexpectedErrorCount: 0, subtitleFailureCount: 2 });
    });

    it('still treats an ERROR after a subtitle\'s own download destination as a subtitle error', () => {
      const { tracker } = createTracker();
      tracker.trackVideoStart(VIDEO_ID);
      tracker.trackSubtitleWrite(SUBTITLE_PATH);
      tracker.trackDownloadDestination(SUBTITLE_PATH);
      tracker.handleErrorLine('ERROR: Read timed out.', 'stderr');

      expect(tracker.dropSubtitleOnlyFailure(VIDEO_ID)).toBe(true);
    });

    it('does not drop an ERROR that came after the media download started', () => {
      const { tracker } = createTracker();
      tracker.trackVideoStart(VIDEO_ID);
      tracker.trackSubtitleWrite(SUBTITLE_PATH);
      tracker.trackDownloadDestination(MEDIA_PATH);
      tracker.handleErrorLine('ERROR: unable to download video data: HTTP Error 403: Forbidden', 'stderr');

      expect(tracker.dropSubtitleOnlyFailure(VIDEO_ID)).toBe(false);
    });

    it('does not drop an ERROR that came after the next video started', () => {
      const { tracker } = createTracker();
      tracker.trackVideoStart(VIDEO_ID);
      tracker.trackSubtitleWrite(SUBTITLE_PATH);
      tracker.trackVideoStart('vid87654321');
      tracker.handleErrorLine('ERROR: Requested format is not available', 'stderr');

      expect(tracker.dropSubtitleOnlyFailure('vid87654321')).toBe(false);
    });

    it('keeps the video failed when the media download also failed', () => {
      const { tracker } = createTracker();
      startVideoWithEmptySubtitle(tracker);
      tracker.trackDownloadDestination(MEDIA_PATH);
      tracker.handleErrorLine('ERROR: unable to download video data: HTTP Error 403: Forbidden', 'stderr');

      tracker.dropSubtitleOnlyFailure(VIDEO_ID);

      expect(tracker.failedVideos.has(VIDEO_ID)).toBe(true);
    });

    it('does not count a subtitle failure twice after its WARNING already dropped it', () => {
      const { tracker } = createTracker();
      tracker.trackVideoStart(VIDEO_ID);
      tracker.trackSubtitleWrite(SUBTITLE_PATH);
      tracker.handleErrorLine('ERROR: [download] Got error: Read timed out. Giving up after 2 retries', 'stderr');
      tracker.handleWarningLine('WARNING: Unable to download video subtitles for \'en\': Read timed out.', 'stderr');

      tracker.dropSubtitleOnlyFailure(VIDEO_ID);

      expect(tracker.subtitleFailureCount).toBe(1);
    });

    it('returns false for a video with no failure', () => {
      const { tracker } = createTracker();
      tracker.trackVideoStart(VIDEO_ID);
      tracker.trackSubtitleWrite(SUBTITLE_PATH);

      expect(tracker.dropSubtitleOnlyFailure(VIDEO_ID)).toBe(false);
    });
  });

  describe('video tracking', () => {
    it('trackVideoStart clears lastErrorMessage', () => {
      const { tracker } = createTracker();
      tracker.handleErrorLine('ERROR: Something bad happened', 'stdout');

      tracker.trackVideoStart('vid12345678');

      expect(tracker.currentVideoId).toBe('vid12345678');
      expect(tracker.lastErrorMessage).toBeNull();
    });

    it('trackVideoFromDestination does not clear lastErrorMessage', () => {
      const { tracker } = createTracker();
      tracker.handleErrorLine('ERROR: Something bad happened', 'stdout');

      tracker.trackVideoFromDestination('vid12345678');

      expect(tracker.currentVideoId).toBe('vid12345678');
      expect(tracker.lastErrorMessage).toBe('Something bad happened');
    });
  });

  describe('settlePersistence', () => {
    it('resolves even when a persistence promise rejects', async () => {
      const { tracker } = createTracker({
        persistTerminatedChannel: jest.fn().mockRejectedValue(new Error('db down')),
      });
      tracker.handleErrorLine(TERMINATED_LINE, 'stdout');

      await expect(tracker.settlePersistence()).resolves.toBeUndefined();
    });
  });

  describe('isExpectedYtdlpSkipMessage', () => {
    it.each([
      'ERROR: [youtube] abc123: Join this channel to get access to members-only content like this video, and other exclusive perks.',
      'ERROR: [youtube] abc123: This video is available to this channel\'s members on level: Assistant (or any higher level).',
      'ERROR: [youtube] abc123: This live event will begin in 21 hours.',
      'WARNING: [youtube] This live event will begin in a few moments.',
      'ERROR: [youtube] abc123: Premiere will begin shortly.',
      'ERROR: [youtube] abc123: This pre-release video is not yet available.'
    ])('identifies expected skip text: %s', (message) => {
      expect(isExpectedYtdlpSkipMessage(message)).toBe(true);
    });

    it.each([
      'ERROR: [youtube] abc123: Private video. Sign in if you have been granted access.',
      'ERROR: [youtube] abc123: Sign in to confirm you are not a bot.',
      'ERROR: [youtube] abc123: HTTP Error 403: Forbidden',
      'ERROR: [youtube] abc123: Video unavailable. This content is not available.',
      'ERROR: [youtube] abc123: The following content is not available on this app.',
      'Unable to download webpage'
    ])('does not classify real failures as expected skips: %s', (message) => {
      expect(isExpectedYtdlpSkipMessage(message)).toBe(false);
    });
  });

  describe('isMembersOnlyMessage', () => {
    it.each([
      'ERROR: [youtube] abc123: Join this channel to get access to members-only content like this video, and other exclusive perks.',
      'ERROR: [youtube] abc123: This video is available to this channel\'s members on level: Assistant (or any higher level).',
      'ERROR: [youtube] abc123: members-only content',
      'ERROR: [youtube] abc123: subscriber_only',
    ])('matches members-only patterns: %s', (message) => {
      expect(isMembersOnlyMessage(message)).toBe(true);
    });

    it.each([
      'ERROR: [youtube] abc123: This live event will begin in 21 hours.',
      'WARNING: [youtube] This live event will begin in a few moments.',
      'ERROR: [youtube] abc123: Premiere will begin shortly.',
      'ERROR: [youtube] abc123: This pre-release video is not yet available.',
      'ERROR: [youtube] abc123: Release time of video is not known.',
      'ERROR: [youtube] abc123: Sign in to confirm you are not a bot.',
    ])('does NOT match premiere, pre-release, or unrelated patterns: %s', (message) => {
      expect(isMembersOnlyMessage(message)).toBe(false);
    });
  });

  describe('extractYoutubeIdFromYtdlpError', () => {
    it('extracts the authoritative youtube id from yt-dlp error text', () => {
      const message = 'ERROR: [youtube] OOUclRI0Ae4: Join this channel to get access to members-only content.';
      expect(extractYoutubeIdFromYtdlpError(message)).toBe('OOUclRI0Ae4');
    });

    it('returns null when yt-dlp error text has no video id', () => {
      expect(extractYoutubeIdFromYtdlpError('members-only content')).toBeNull();
      expect(extractYoutubeIdFromYtdlpError('no id in this message')).toBeNull();
    });
  });

  describe('extractChannelIdFromYtdlpError', () => {
    it('extracts the canonical channel_id from a [youtube:tab] error line', () => {
      const message = 'ERROR: [youtube:tab] UC1lg-nYUcZ1pjo6EC2Nj5Sw: YouTube said: This account has been terminated for violating Google\'s Terms of Service.';
      expect(extractChannelIdFromYtdlpError(message)).toBe('UC1lg-nYUcZ1pjo6EC2Nj5Sw');
    });

    it('returns null when the line is a [youtube] (video) error rather than [youtube:tab]', () => {
      const message = 'ERROR: [youtube] OOUclRI0Ae4: Join this channel to get access to members-only content.';
      expect(extractChannelIdFromYtdlpError(message)).toBeNull();
    });

    it('returns null when no UC... id is present', () => {
      expect(extractChannelIdFromYtdlpError('account has been terminated for violating')).toBeNull();
      expect(extractChannelIdFromYtdlpError('[youtube:tab] notachannel: gone')).toBeNull();
      expect(extractChannelIdFromYtdlpError('')).toBeNull();
    });
  });
});
