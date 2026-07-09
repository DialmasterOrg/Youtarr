const {
  isUploadsPlaylist,
  selectSeedEntries,
  selectNewSinceBaseline,
  BASELINE_TOLERANCE_MS,
} = require('../playlistAutoSelection');

const c = (over) => ({
  youtube_id: 'v', channel_id: null, channel_name: null, title: 't',
  position: 1, added_at: new Date('2026-07-01T00:00:00Z'),
  downloaded: false, unavailable: false, ...over,
});

describe('isUploadsPlaylist', () => {
  it('is true for UU-prefixed ids and false otherwise', () => {
    expect(isUploadsPlaylist('UUabc')).toBe(true);
    expect(isUploadsPlaylist('PLabc')).toBe(false);
    expect(isUploadsPlaylist(null)).toBe(false);
  });
});

describe('selectSeedEntries', () => {
  it('takes the tail (highest positions) for regular playlists, preserving old behavior', () => {
    const candidates = [1, 2, 3, 4].map((p) => c({ youtube_id: `v${p}`, position: p }));
    const out = selectSeedEntries({ candidates, playlistId: 'PLx', limit: 2 });
    expect(out.map((e) => e.youtube_id)).toEqual(['v4', 'v3']);
  });

  it('takes the head (lowest positions) for UU uploads playlists, which are newest-first', () => {
    const candidates = [1, 2, 3, 4].map((p) => c({ youtube_id: `v${p}`, position: p }));
    const out = selectSeedEntries({ candidates, playlistId: 'UUx', limit: 2 });
    expect(out.map((e) => e.youtube_id)).toEqual(['v1', 'v2']);
  });

  it('excludes downloaded and unavailable rows before capping', () => {
    const candidates = [
      c({ youtube_id: 'v1', position: 1 }),
      c({ youtube_id: 'v2', position: 2, downloaded: true }),
      c({ youtube_id: 'v3', position: 3, unavailable: true }),
      c({ youtube_id: 'v4', position: 4 }),
    ];
    const out = selectSeedEntries({ candidates, playlistId: 'PLx', limit: 3 });
    expect(out.map((e) => e.youtube_id)).toEqual(['v4', 'v1']);
  });
});

describe('selectNewSinceBaseline', () => {
  const baselineAt = new Date('2026-07-01T12:00:00Z');
  const before = new Date('2026-07-01T11:00:00Z');
  const after = new Date('2026-07-02T00:00:00Z');
  const later = new Date('2026-07-03T00:00:00Z');

  it('selects only undownloaded rows first seen after the baseline', () => {
    const candidates = [
      c({ youtube_id: 'backlog', added_at: before }),
      c({ youtube_id: 'new1', added_at: after }),
      c({ youtube_id: 'newDownloaded', added_at: after, downloaded: true }),
    ];
    const out = selectNewSinceBaseline({ candidates, baselineAt, limit: 5 });
    expect(out.map((e) => e.youtube_id)).toEqual(['new1']);
  });

  it('excludes rows within the tolerance window of the baseline (same-second seed refresh rows)', () => {
    const candidates = [
      c({ youtube_id: 'sameSecond', added_at: new Date(baselineAt.getTime() + BASELINE_TOLERANCE_MS) }),
      c({ youtube_id: 'clearlyAfter', added_at: after }),
    ];
    const out = selectNewSinceBaseline({ candidates, baselineAt, limit: 5 });
    expect(out.map((e) => e.youtube_id)).toEqual(['clearlyAfter']);
  });

  it('orders newest-first by added_at with position ASC as tie-break, then caps', () => {
    const candidates = [
      c({ youtube_id: 'older', added_at: after, position: 9 }),
      c({ youtube_id: 'tieHigh', added_at: later, position: 5 }),
      c({ youtube_id: 'tieLow', added_at: later, position: 2 }),
    ];
    const out = selectNewSinceBaseline({ candidates, baselineAt, limit: 2 });
    expect(out.map((e) => e.youtube_id)).toEqual(['tieLow', 'tieHigh']);
  });

  it('overflow catches up: rows beyond the cap remain eligible for the next run', () => {
    const candidates = [1, 2, 3].map((p) => c({ youtube_id: `v${p}`, position: p, added_at: after }));
    const first = selectNewSinceBaseline({ candidates, baselineAt, limit: 2 });
    const downloadedIds = new Set(first.map((e) => e.youtube_id));
    const nextRun = candidates.map((x) => ({ ...x, downloaded: downloadedIds.has(x.youtube_id) }));
    const second = selectNewSinceBaseline({ candidates: nextRun, baselineAt, limit: 2 });
    expect(second.map((e) => e.youtube_id)).toEqual(['v3']);
  });
});
