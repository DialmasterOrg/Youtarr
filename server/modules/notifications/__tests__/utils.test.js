/* eslint-env jest */

const {
  buildTitle,
  getSubtitle,
  getTerminatedCount,
  buildTerminatedCountLabel,
  formatTerminatedChannelLine,
  getTerminationFailureCount,
  buildTerminationFailureCountLabel,
  formatTerminationFailureLine,
} = require('../utils');

describe('notification utils - terminated channel helpers', () => {
  describe('buildTitle', () => {
    test('uses video headline when totalDownloaded > 0 regardless of terminations', () => {
      expect(buildTitle(3, 1)).toBe('🎬 3 New Videos Downloaded');
      expect(buildTitle(1, 0)).toBe('🎬 New Video Downloaded');
    });

    test('switches to termination headline when zero videos and one termination', () => {
      expect(buildTitle(0, 1)).toBe('⚠️ Channel Termination Detected');
    });

    test('pluralizes the termination headline for multiple events', () => {
      expect(buildTitle(0, 3)).toBe('⚠️ 3 Channel Terminations Detected');
    });

    test('combines successes and failures in the title count', () => {
      expect(buildTitle(0, 1, 1)).toBe('⚠️ 2 Channel Terminations Detected');
      expect(buildTitle(0, 0, 1)).toBe('⚠️ Channel Termination Detected');
    });

    test('falls back to video headline when all counts are zero', () => {
      expect(buildTitle(0, 0)).toBe('🎬 0 New Videos Downloaded');
    });
  });

  describe('getSubtitle', () => {
    test('labels channel downloads', () => {
      expect(getSubtitle('Channel Downloads')).toBe('Channel Video Downloads');
      expect(getSubtitle('Channel Downloads - 2 group(s)')).toBe('Channel Video Downloads');
    });

    test('labels manual downloads', () => {
      expect(getSubtitle('Manually Added Urls')).toBe('Manually Selected Downloads');
      expect(getSubtitle('Manually Added Urls (via API: my-key)')).toBe('Manually Selected Downloads');
    });

    test('labels playlist runs and single-playlist jobs', () => {
      expect(getSubtitle('Playlist downloads')).toBe('Playlist Downloads');
      expect(getSubtitle('Playlist: 💯🔥 CHALLENGE VIDEOS')).toBe('Playlist Downloads');
    });

    test('does not misclassify a playlist whose title contains "Channel"', () => {
      expect(getSubtitle('Playlist: My Channel Mix')).toBe('Playlist Downloads');
    });

    test('labels a mixed channel + playlist run', () => {
      expect(getSubtitle('Channel & playlist update')).toBe('Channel & Playlist Downloads');
    });

    test('defaults to manual when given an empty job type', () => {
      expect(getSubtitle('')).toBe('Manually Selected Downloads');
      expect(getSubtitle()).toBe('Manually Selected Downloads');
    });
  });

  describe('getTerminatedCount', () => {
    test('prefers totalTerminatedChannels when present', () => {
      expect(getTerminatedCount({ totalTerminatedChannels: 2, terminatedChannels: [] })).toBe(2);
    });

    test('falls back to terminatedChannels length', () => {
      expect(getTerminatedCount({ terminatedChannels: [{ channelId: 'UC1' }, { channelId: 'UC2' }] })).toBe(2);
    });

    test('returns 0 for missing/empty summaries', () => {
      expect(getTerminatedCount({})).toBe(0);
      expect(getTerminatedCount()).toBe(0);
    });
  });

  describe('buildTerminatedCountLabel', () => {
    test('singular form for count of 1', () => {
      expect(buildTerminatedCountLabel(1)).toBe('1 channel marked terminated');
    });

    test('plural form for other counts', () => {
      expect(buildTerminatedCountLabel(2)).toBe('2 channels marked terminated');
      expect(buildTerminatedCountLabel(0)).toBe('0 channels marked terminated');
    });
  });

  describe('formatTerminatedChannelLine', () => {
    test('uses uploader when present', () => {
      expect(formatTerminatedChannelLine({ uploader: 'My Channel', channelId: 'UC123' })).toBe(
        'My Channel: scheduled downloads disabled'
      );
    });

    test('falls back to channelId when uploader missing', () => {
      expect(formatTerminatedChannelLine({ channelId: 'UC123' })).toBe(
        'UC123: scheduled downloads disabled'
      );
    });

    test('falls back to placeholder when both missing', () => {
      expect(formatTerminatedChannelLine({})).toBe('Unknown channel: scheduled downloads disabled');
    });
  });

  describe('getTerminationFailureCount', () => {
    test('prefers totalTerminationFailures when present', () => {
      expect(getTerminationFailureCount({ totalTerminationFailures: 2, terminationFailures: [] })).toBe(2);
    });

    test('falls back to terminationFailures length', () => {
      expect(getTerminationFailureCount({ terminationFailures: ['UC1', 'UC2'] })).toBe(2);
    });

    test('returns 0 for missing/empty summaries', () => {
      expect(getTerminationFailureCount({})).toBe(0);
      expect(getTerminationFailureCount()).toBe(0);
    });
  });

  describe('buildTerminationFailureCountLabel', () => {
    test('singular form', () => {
      expect(buildTerminationFailureCountLabel(1)).toBe('1 termination could not be auto-disabled');
    });

    test('plural form', () => {
      expect(buildTerminationFailureCountLabel(3)).toBe('3 terminations could not be auto-disabled');
    });
  });

  describe('formatTerminationFailureLine', () => {
    test('renders a channel id with the auto-disable failure note', () => {
      expect(formatTerminationFailureLine('UC123')).toBe(
        'UC123: detected as terminated but could not be auto-disabled (check the channel manually)'
      );
    });
  });
});
