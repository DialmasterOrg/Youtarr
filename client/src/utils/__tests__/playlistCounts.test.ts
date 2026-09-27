import {
  formatDownloadPercent,
  formatPlaylistCounts,
  formatVideoTotal,
  isPlaylistAtLimit,
  playlistCountParts,
} from '../playlistCounts';

describe('isPlaylistAtLimit', () => {
  test('is false below the tracking limit', () => {
    expect(isPlaylistAtLimit(4999)).toBe(false);
  });

  test('is true at the tracking limit', () => {
    expect(isPlaylistAtLimit(5000)).toBe(true);
  });
});

describe('formatVideoTotal', () => {
  test('groups thousands below the limit', () => {
    expect(formatVideoTotal(1234)).toBe('1,234');
  });

  test('marks a playlist at the limit as possibly larger', () => {
    expect(formatVideoTotal(5000)).toBe('5,000+');
  });
});

describe('formatDownloadPercent', () => {
  test('rounds down', () => {
    expect(formatDownloadPercent(199, 200)).toBe('99%');
  });

  test('shows 100% only when everything is downloaded', () => {
    expect(formatDownloadPercent(20, 20)).toBe('100%');
  });

  test('never exceeds 100%', () => {
    expect(formatDownloadPercent(21, 20)).toBe('100%');
  });

  test('shows <1% when some videos are downloaded but the share rounds to zero', () => {
    expect(formatDownloadPercent(1, 620)).toBe('<1%');
  });

  test('shows 0% when nothing is downloaded', () => {
    expect(formatDownloadPercent(0, 20)).toBe('0%');
  });

  test('has no percent for an empty playlist', () => {
    expect(formatDownloadPercent(0, 0)).toBeNull();
  });

  test('has no percent for a playlist at the limit', () => {
    expect(formatDownloadPercent(5000, 5000)).toBeNull();
  });
});

describe('playlistCountParts', () => {
  test('puts the downloaded count with its percent before the total', () => {
    expect(playlistCountParts(20, 16)).toEqual(['16 downloaded (80%)', '20 videos']);
  });

  test('returns only the total when the downloaded count is unknown', () => {
    expect(playlistCountParts(620, null)).toEqual(['620 videos']);
  });

  test('uses the singular for one video', () => {
    expect(playlistCountParts(1, 0)).toEqual(['0 downloaded (0%)', '1 video']);
  });

  test('leaves out the percent at the limit', () => {
    expect(playlistCountParts(5000, 0)).toEqual(['0 downloaded', '5,000+ videos']);
  });
});

describe('formatPlaylistCounts', () => {
  test('joins the parts', () => {
    expect(formatPlaylistCounts(620, 12)).toBe('12 downloaded (1%) • 620 videos');
  });
});
