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
