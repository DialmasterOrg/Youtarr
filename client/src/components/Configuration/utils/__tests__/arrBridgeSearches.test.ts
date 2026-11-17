import {
  ArrSearch,
  ArrSearchCandidate,
  REJECTION_LABELS,
  SEARCH_NOTE_LABELS,
  SEARCH_STAGE_LABELS,
  TITLE_STAGE_SKIPPED_LABELS,
  describeAsked,
  formatLength,
  labelOf,
  offeredFirst,
  searchOutcome,
} from '../arrBridgeSearches';

const search = (overrides: Partial<ArrSearch> = {}): ArrSearch => ({
  id: 1,
  at: '2025-06-10T10:00:00.000Z',
  firstAt: '2025-06-10T10:00:00.000Z',
  count: 1,
  kind: 'tv',
  shape: 'episode',
  asked: {
    text: 'The Beverly Hillbillies', textSource: 'title', season: 1, episode: 15,
    year: null, month: null, day: null, limit: 100,
  },
  outcome: 'nothing',
  offered: 0,
  note: null,
  titleStageSkipped: null,
  stages: [],
  ...overrides,
});

const asked = (overrides: Partial<ArrSearch['asked']>): ArrSearch['asked'] => ({ ...search().asked, ...overrides });

describe('the labels', () => {
  // The codes the server sets: REJECTION in server/modules/arrBridge/candidateFilter.js,
  // NOTE and TITLE_STAGE_SKIPPED in recentSearches.js, EMPTY_REASON in
  // newznabRequest.js, and the matchers in searchService.js.
  test.each([
    [REJECTION_LABELS, [
      'excluded-word', 'unknown-length', 'too-short', 'outside-runtime', 'name-missing', 'no-episode-marker',
      'wrong-episode', 'several-episodes', 'another-series', 'episode-title-missing', 'another-episode-title',
      'episode-number-missing', 'wrong-date', 'year-missing', 'failed-recently', 'not-closest-channel',
      'no-release-name', 'duplicate-name', 'over-limit',
    ]],
    [SEARCH_NOTE_LABELS, [
      'no-query', 'daily-needs-api', 'no-search-text', 'not-searchable', 'search-held-too-long', 'search-failed',
      'later-page', 'no-text', 'movie-without-year', 'unknown-kind', 'no-season', 'year-season', 'invalid-date',
    ]],
    [TITLE_STAGE_SKIPPED_LABELS, ['no-connection', 'unknown-series', 'no-usable-title', 'no-runtime']],
    [SEARCH_STAGE_LABELS, ['episode-title', 'episode-code', 'season', 'daily', 'movie']],
  ])('have a plain label for every code the server sets', (labels, codes) => {
    expect(Object.keys(labels).sort()).toEqual([...codes].sort());
    for (const code of codes) expect(labels[code]).not.toBe(code);
  });

  test('a code this page does not know is shown as it is', () => {
    expect(labelOf(REJECTION_LABELS, 'brand-new-reason')).toBe('brand-new-reason');
    expect(labelOf(REJECTION_LABELS, 'too-short')).toBe('Shorter than the shortest length allowed');
  });
});

describe('describeAsked', () => {
  test.each([
    ['an episode', search(), 'The Beverly Hillbillies S01E15'],
    ['a season', search({ shape: 'season', asked: asked({ text: 'Bluey', season: 2, episode: null }) }), 'Bluey season 2'],
    [
      'a daily episode',
      search({ shape: 'daily', asked: asked({ text: 'Last Week Tonight', season: null, episode: null, year: 2024, month: 5, day: 5 }) }),
      'Last Week Tonight 2024-05-05',
    ],
    [
      'a movie',
      search({ kind: 'movie', shape: 'movie', asked: asked({ text: 'Plan 9 from Outer Space', season: null, episode: null, year: 1957 }) }),
      'Plan 9 from Outer Space (1957)',
    ],
    ['the no-query feed for TV', search({ shape: 'rss', asked: asked({ text: null, season: null, episode: null }) }), 'Newest episodes'],
    [
      'the no-query feed for movies',
      search({ kind: 'movie', shape: 'rss', asked: asked({ text: null, season: null, episode: null }) }),
      'Newest movies',
    ],
    ['a request that was not searched', search({ shape: 'empty', asked: asked({ text: 'Bluey', season: null, episode: null }) }), 'Bluey'],
    ['a request without a name', search({ shape: 'empty', asked: asked({ text: null, season: null, episode: null }) }), 'No name'],
  ])('%s', (_name, entry, expected) => {
    expect(describeAsked(entry)).toBe(expected);
  });
});

describe('searchOutcome', () => {
  test.each([
    [search({ outcome: 'offered', offered: 3 }), { label: '3 offered', tone: 'success' }],
    [search({ outcome: 'nothing' }), { label: 'Nothing offered', tone: 'warning' }],
    [search({ outcome: 'not-searched' }), { label: 'Not searched', tone: 'default' }],
    [search({ outcome: 'failed' }), { label: 'Could not search', tone: 'error' }],
  ])('%#', (entry, expected) => {
    expect(searchOutcome(entry)).toEqual(expected);
  });
});

describe('formatLength', () => {
  test.each([
    [1318, '21:58'],
    [6, '0:06'],
    [4745, '1:19:05'],
    [null, 'length unknown'],
  ])('%s reads %s', (seconds, expected) => {
    expect(formatLength(seconds)).toBe(expected);
  });
});

test('offeredFirst puts the offered videos first and keeps the order otherwise', () => {
  const candidate = (youtubeId: string, outcome: ArrSearchCandidate['outcome']): ArrSearchCandidate => ({
    youtubeId, title: youtubeId, channelName: null, duration: null, outcome, reason: null, releaseTitle: null,
  });
  const list = [candidate('a', 'rejected'), candidate('b', 'offered'), candidate('c', 'rejected'), candidate('d', 'offered')];

  expect(offeredFirst(list).map(({ youtubeId }) => youtubeId)).toEqual(['b', 'd', 'a', 'c']);
});
