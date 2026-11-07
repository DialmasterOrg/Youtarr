import { SearchResult } from '../types';
import { DEFAULT_SORT, SORT_OPTIONS, defaultDirectionFor, sortResults } from '../sortResults';

function makeResult(overrides: Partial<SearchResult> & { youtubeId: string }): SearchResult {
  return {
    title: 'Title',
    channelName: 'Channel',
    channelId: null,
    duration: null,
    thumbnailUrl: null,
    publishedAt: null,
    viewCount: null,
    status: 'never_downloaded',
    ...overrides,
  };
}

const ids = (results: SearchResult[]) => results.map((r) => r.youtubeId);

describe('sortResults', () => {
  const results = [
    makeResult({ youtubeId: 'b', title: 'Bravo', channelName: 'Zed', duration: 300, publishedAt: '2024-01-01T00:00:00Z', viewCount: 10 }),
    makeResult({ youtubeId: 'n', title: 'Null', channelName: 'Mid' }),
    makeResult({ youtubeId: 'a', title: 'alpha', channelName: 'Alpha', duration: 30, publishedAt: '2026-01-01T00:00:00Z', viewCount: 1000 }),
  ];

  test('relevance keeps the input order in both directions', () => {
    expect(ids(sortResults(results, 'relevance', 'desc'))).toEqual(['b', 'n', 'a']);
    expect(ids(sortResults(results, 'relevance', 'asc'))).toEqual(['b', 'n', 'a']);
  });

  test('does not mutate the input', () => {
    sortResults(results, 'title', 'asc');
    expect(ids(results)).toEqual(['b', 'n', 'a']);
  });

  test('sorts titles case-insensitively', () => {
    expect(ids(sortResults(results, 'title', 'asc'))).toEqual(['a', 'b', 'n']);
    expect(ids(sortResults(results, 'title', 'desc'))).toEqual(['n', 'b', 'a']);
  });

  test('sorts by channel name', () => {
    expect(ids(sortResults(results, 'channel', 'asc'))).toEqual(['a', 'n', 'b']);
  });

  test('puts a missing date, duration, or view count last in either direction', () => {
    expect(ids(sortResults(results, 'published', 'desc'))).toEqual(['a', 'b', 'n']);
    expect(ids(sortResults(results, 'published', 'asc'))).toEqual(['b', 'a', 'n']);
    expect(ids(sortResults(results, 'duration', 'desc'))).toEqual(['b', 'a', 'n']);
    expect(ids(sortResults(results, 'views', 'asc'))).toEqual(['b', 'a', 'n']);
  });

  test('is stable for equal keys', () => {
    const tied = [
      makeResult({ youtubeId: 'one', viewCount: 5 }),
      makeResult({ youtubeId: 'two', viewCount: 5 }),
      makeResult({ youtubeId: 'three', viewCount: 5 }),
    ];
    expect(ids(sortResults(tied, 'views', 'desc'))).toEqual(['one', 'two', 'three']);
  });
});

describe('sort defaults', () => {
  test('text columns start ascending, numeric and date columns descending', () => {
    expect(defaultDirectionFor('title')).toBe('asc');
    expect(defaultDirectionFor('channel')).toBe('asc');
    expect(defaultDirectionFor('published')).toBe('desc');
    expect(defaultDirectionFor('duration')).toBe('desc');
    expect(defaultDirectionFor('views')).toBe('desc');
  });

  test('relevance is the default and the only undirected option', () => {
    expect(DEFAULT_SORT).toEqual({ key: 'relevance', direction: 'desc' });
    expect(SORT_OPTIONS.filter((o) => o.undirected).map((o) => o.key)).toEqual(['relevance']);
  });
});
