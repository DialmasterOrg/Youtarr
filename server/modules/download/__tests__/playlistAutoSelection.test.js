const { selectBatchEntries, selectNewSinceBaseline } = require('../playlistAutoSelection');

const entry = (over = {}) => ({
  id: 1, youtube_id: 'v1', position: 1, published_at: '20260901',
  added_at: new Date('2026-09-01T00:00:00Z'),
  first_seen_at: new Date('2026-09-01T00:00:00Z'),
  downloaded: false, unavailable: false, ...over,
});
const ids = (rows) => rows.map((r) => r.youtube_id);

describe('explicit existing batches', () => {
  test.each(['asc', 'desc'])('publication selection is independent of %s playlist order', (direction) => {
    const candidates = [
      entry({ youtube_id: 'old', position: direction === 'asc' ? 1 : 3, published_at: '20200101' }),
      entry({ youtube_id: 'new', position: direction === 'asc' ? 3 : 1, published_at: '20260901' }),
      entry({ youtube_id: 'middle', position: 2, published_at: '20260801' }),
    ];
    expect(ids(selectBatchEntries({ candidates, order: 'published', limit: 2 }).selected)).toEqual(['new', 'middle']);
  });

  test('selects either end without claiming that position means recency', () => {
    const candidates = [1, 2, 3].map((position) => entry({ youtube_id: `v${position}`, position }));
    expect(ids(selectBatchEntries({ candidates, order: 'asc', limit: 2 }).selected)).toEqual(['v1', 'v2']);
    expect(ids(selectBatchEntries({ candidates, order: 'desc', limit: 2 }).selected)).toEqual(['v3', 'v2']);
  });

  test('missing dates require a positional or manual choice', () => {
    const candidates = [entry(), entry({ youtube_id: 'unknown', position: 2, published_at: null })];
    expect(selectBatchEntries({ candidates, order: 'published', limit: 1 })).toEqual({ selected: [], missingDates: 1 });
    expect(ids(selectBatchEntries({ candidates, order: 'desc', limit: 1 }).selected)).toEqual(['unknown']);
  });

  test.each(['20260230', '', 'not a date', null])('does not treat invalid date %s as old', (value) => {
    expect(selectBatchEntries({ candidates: [entry({ published_at: value })], order: 'published', limit: 1 }))
      .toEqual({ selected: [], missingDates: 1 });
  });

  test('skips downloaded, unavailable and excluded entries before applying the count', () => {
    const candidates = [entry({ downloaded: true }), entry({ unavailable: true }), entry({ ignored: true }), entry({ youtube_id: 'eligible' })];
    expect(ids(selectBatchEntries({ candidates, order: 'asc', limit: 1 }).selected)).toEqual(['eligible']);
  });
});

describe('following discoveries and saved retries', () => {
  const request = (id, overrides = {}) => entry({ id, youtube_id: `r${id}`, auto_download_requested: true, ...overrides });
  const discovery = (id, overrides = {}) => entry({ id, youtube_id: `d${id}`, ...overrides });
  const cases = [
    { name: 'empty pools', candidates: [], discoveries: [], retries: [] },
    { name: 'old uploads inserted anywhere are discoveries', candidates: [
      discovery(11, { position: 1, published_at: '20100101' }),
      discovery(12, { position: 3 }), discovery(13, { position: 5 }), entry({ id: 5 }),
    ], limit: 3, discoveries: ['d11', 'd12', 'd13'], retries: [] },
    { name: 'empty baseline starts at zero', candidates: [discovery(1)], baselineId: 0, discoveries: ['d1'], retries: [] },
    { name: 'reordering or downloading does not make an old entry new', candidates: [entry({ id: 5, position: 99, downloaded_at: new Date('2026-09-07') })], discoveries: [], retries: [] },
    { name: 'failed requests cannot consume discovery slots', candidates: [
      request(1), request(2), request(3),
      discovery(11), discovery(12, { first_seen_at: new Date('2026-09-02') }), discovery(13, { first_seen_at: new Date('2026-09-03') }),
    ], discoveries: ['d13', 'd12'], retries: ['r1', 'r2'] },
    { name: 'a limit of one permits one entry in each pool', candidates: [request(1), request(2), discovery(11)], limit: 1, discoveries: ['d11'], retries: ['r1'] },
    { name: 'unused discovery allowance does not expand retries', candidates: [request(1), request(2), request(3)], discoveries: [], retries: ['r1', 'r2'] },
    { name: 'unused retry allowance does not expand discoveries', candidates: [discovery(11), discovery(12), discovery(13)], discoveries: ['d11', 'd12'], retries: [] },
    { name: 'requested discoveries belong only to the discovery pool', candidates: [request(11), request(1)], discoveries: ['r11'], retries: ['r1'] },
    { name: 'overflowing requested discoveries cannot borrow retry slots', candidates: [
      discovery(12, { first_seen_at: new Date('2026-09-02') }), request(11), request(1),
    ], limit: 1, discoveries: ['d12'], retries: ['r1'] },
    { name: 'previous attempts rotate behind older attempts', candidates: [
      request(1, { auto_download_last_attempt_at: new Date('2026-09-03') }),
      request(2, { auto_download_last_attempt_at: '2026-09-01T00:00:00Z' }),
      request(3, { auto_download_last_attempt_at: new Date('2026-09-02') }),
    ], discoveries: [], retries: ['r2', 'r3'] },
    { name: 'unknown attempts join the bounded retry pool first', candidates: [
      request(1, { auto_download_last_attempt_at: new Date('2026-09-01') }), request(2), request(3),
    ], discoveries: [], retries: ['r2', 'r3'] },
    { name: 'ties use stable row ids rather than mutable playlist position', candidates: [request(2, { position: 1 }), request(1, { position: 99 })], discoveries: [], retries: ['r1', 'r2'] },
    { name: 'a large unattempted submission is still bounded', candidates: [
      ...Array.from({ length: 1001 }, (_, i) => request(i + 1)), discovery(1002),
    ], baselineId: 1001, discoveries: ['d1002'], retries: ['r1', 'r2'] },
    { name: 'downloaded unavailable and ignored entries are excluded in both pools', candidates: [
      request(1, { downloaded: true }), request(2, { unavailable: true }), request(3, { ignored: true }),
      discovery(11, { downloaded: true }), discovery(12, { unavailable: true }), discovery(13, { ignored: true }),
    ], discoveries: [], retries: [] },
    { name: 'legacy cutoffs retain second-precision tolerance and discovery precedence', baselineId: null,
      baselineAt: new Date('2026-09-01T00:00:00Z'), candidates: [
        entry(), request(2, { added_at: new Date('2026-09-01T00:00:01Z') }),
        request(3, { added_at: new Date('2026-09-01T00:00:02Z') }),
      ], discoveries: ['r3'], retries: ['r2'] },
  ];

  test.each(cases)('$name', ({ candidates, baselineId = 10, baselineAt, limit = 2, discoveries, retries }) => {
    const result = selectNewSinceBaseline({ candidates, baselineId, baselineAt, limit });
    expect({ discoveries: ids(result.discoveries), retries: ids(result.retries) }).toEqual({ discoveries, retries });
  });

  test('selection never stamps attempts or changes the supplied rows or ordering', () => {
    const candidates = Object.freeze([Object.freeze(request(2)), Object.freeze(request(1)), Object.freeze(discovery(11))]);
    const result = selectNewSinceBaseline({ candidates, baselineId: 10, limit: 1 });
    expect(ids(result.retries)).toEqual(['r1']);
    expect(ids(candidates)).toEqual(['r2', 'r1', 'd11']);
    expect(candidates[1].auto_download_last_attempt_at).toBeUndefined();
  });
});
