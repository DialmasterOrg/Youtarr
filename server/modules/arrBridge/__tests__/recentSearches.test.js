/* eslint-env jest */
const { createRecentSearches, DEFAULT_MAX_ENTRIES } = require('../recentSearches');

const AT = new Date('2025-06-01T10:00:00.000Z');
const minutesLater = (minutes) => new Date(AT.getTime() + minutes * 60 * 1000);

function episodeRequest(overrides = {}) {
  return {
    t: 'tvsearch', kind: 'tv', shape: 'episode', text: 'Beyblade', textSource: 'title',
    season: 1, episode: 29, year: null, month: null, day: null, limit: 100, offset: 0, emptyReason: null,
    ...overrides,
  };
}

const rssRequest = (kind) => episodeRequest({ shape: 'rss', kind, text: null, textSource: null, season: null, episode: null });

const result = (youtubeId, overrides = {}) => ({
  youtubeId, title: `Video ${youtubeId}`, channelName: 'Uploads', duration: 1320, publishedAt: '2024-03-01T12:00:00.000Z',
  ...overrides,
});

describe('recentSearches', () => {
  test('lists nothing before a request is answered', () => {
    const searches = createRecentSearches();

    searches.start(episodeRequest(), AT);

    expect(searches.list()).toEqual([]);
  });

  test('records what was asked, the search that ran and what became of each result', () => {
    const searches = createRecentSearches();
    const offered = result('aaaaaaaaaaa');
    const rejected = result('bbbbbbbbbbb', { duration: undefined });

    const record = searches.start(episodeRequest(), AT);
    const stage = record.stage({ matcher: 'episode-code', query: 'Beyblade S01E29' }, [offered, rejected]);
    stage.offer(offered, 'Beyblade.S01E29.1080p.YT.WEB-DL-Uploads');
    stage.reject(rejected, 'unknown-length');
    record.answered(1);

    expect(searches.list()).toEqual([{
      id: 1,
      at: '2025-06-01T10:00:00.000Z',
      firstAt: '2025-06-01T10:00:00.000Z',
      count: 1,
      kind: 'tv',
      shape: 'episode',
      asked: {
        text: 'Beyblade', textSource: 'title', season: 1, episode: 29, year: null, month: null, day: null, limit: 100,
      },
      outcome: 'offered',
      offered: 1,
      note: null,
      titleStageSkipped: null,
      stages: [{
        matcher: 'episode-code',
        query: 'Beyblade S01E29',
        results: 2,
        candidates: [
          {
            youtubeId: 'aaaaaaaaaaa', title: 'Video aaaaaaaaaaa', channelName: 'Uploads', duration: 1320,
            outcome: 'offered', reason: null, releaseTitle: 'Beyblade.S01E29.1080p.YT.WEB-DL-Uploads',
          },
          {
            youtubeId: 'bbbbbbbbbbb', title: 'Video bbbbbbbbbbb', channelName: 'Uploads', duration: null,
            outcome: 'rejected', reason: 'unknown-length', releaseTitle: null,
          },
        ],
      }],
    }]);
  });

  test('a search that ran and offered nothing is "nothing"; one that never ran is "not-searched"', () => {
    const searches = createRecentSearches();

    const searched = searches.start(episodeRequest(), AT);
    searched.stage({ matcher: 'episode-code', query: 'Beyblade S01E29' }, []);
    searched.skipTitleStage('no-connection');
    searched.answered(0);
    const skipped = searches.start(episodeRequest({ shape: 'empty', emptyReason: 'no-season' }), AT);
    skipped.notSearched('no-season');
    skipped.answered(0);

    expect(searches.list().map(({ outcome, note, titleStageSkipped }) => ({ outcome, note, titleStageSkipped }))).toEqual([
      { outcome: 'not-searched', note: 'no-season', titleStageSkipped: null },
      { outcome: 'nothing', note: null, titleStageSkipped: 'no-connection' },
    ]);
  });

  test('a failed search is listed with the stages that ran before it failed', () => {
    const searches = createRecentSearches();

    const record = searches.start(episodeRequest(), AT);
    record.stage({ matcher: 'episode-title', query: 'Beyblade Play It Again Dizzi' }, [result('aaaaaaaaaaa')]);
    record.failed('search-failed');
    record.answered(3);

    expect(searches.list()).toHaveLength(1);
    expect(searches.list()[0]).toMatchObject({ outcome: 'failed', offered: 0, note: 'search-failed' });
    expect(searches.list()[0].stages).toHaveLength(1);
  });

  test('keeps the newest searches and drops the oldest past the limit', () => {
    const searches = createRecentSearches();

    for (let index = 0; index < DEFAULT_MAX_ENTRIES + 5; index += 1) {
      searches.start(episodeRequest({ episode: index }), minutesLater(index)).answered(0);
    }

    const list = searches.list();
    expect(list).toHaveLength(50);
    expect(list[0].asked.episode).toBe(54);
    expect(list[49].asked.episode).toBe(5);
  });

  describe('the no-query feed, asked on every RSS sync', () => {
    function askPlaceholder(searches, kind, at) {
      const record = searches.start(rssRequest(kind), at);
      record.notSearched('no-query');
      record.answered(0);
    }

    test('shares one row per kind, counted, at the time of the latest request', () => {
      const searches = createRecentSearches();

      askPlaceholder(searches, 'tv', AT);
      askPlaceholder(searches, 'movie', minutesLater(1));
      askPlaceholder(searches, 'tv', minutesLater(15));

      expect(searches.list().map(({ kind, count, at, firstAt }) => ({ kind, count, at, firstAt }))).toEqual([
        { kind: 'tv', count: 2, at: '2025-06-01T10:15:00.000Z', firstAt: '2025-06-01T10:00:00.000Z' },
        { kind: 'movie', count: 1, at: '2025-06-01T10:01:00.000Z', firstAt: '2025-06-01T10:01:00.000Z' },
      ]);
    });

    test('never pushes a real search out of the list', () => {
      const searches = createRecentSearches({ max: 3 });
      searches.start(episodeRequest(), AT).answered(0);

      for (let index = 1; index <= 10; index += 1) askPlaceholder(searches, 'tv', minutesLater(index));

      expect(searches.list().map(({ shape, count }) => ({ shape, count }))).toEqual([
        { shape: 'rss', count: 10 },
        { shape: 'episode', count: 1 },
      ]);
    });

    test('does not fold other requests that ran no search', () => {
      const searches = createRecentSearches();

      for (let index = 0; index < 2; index += 1) {
        const record = searches.start(episodeRequest({ shape: 'empty' }), minutesLater(index));
        record.notSearched('no-season');
        record.answered(0);
      }

      expect(searches.list().map(({ count }) => count)).toEqual([1, 1]);
    });
  });

  test('cuts overlong text', () => {
    const searches = createRecentSearches();
    const long = 'x'.repeat(500);
    const video = result('aaaaaaaaaaa', { title: long, channelName: long });

    const record = searches.start(episodeRequest({ text: long }), AT);
    const stage = record.stage({ matcher: 'episode-code', query: long }, [video]);
    stage.offer(video, long);
    record.answered(1);

    const [entry] = searches.list();
    const [candidate] = entry.stages[0].candidates;
    expect([
      entry.asked.text, entry.stages[0].query, candidate.title, candidate.channelName, candidate.releaseTitle,
    ].map((text) => text.length)).toEqual([200, 200, 200, 200, 200]);
  });

  test('ignores a result the stage was not started with', () => {
    const searches = createRecentSearches();
    const record = searches.start(episodeRequest(), AT);
    const stage = record.stage({ matcher: 'episode-code', query: 'Beyblade S01E29' }, [result('aaaaaaaaaaa')]);

    stage.offer(result('zzzzzzzzzzz'), 'Other.S01E01');
    stage.reject(result('zzzzzzzzzzz'), 'too-short');
    record.answered(0);

    expect(searches.list()[0].stages[0].candidates).toEqual([
      expect.objectContaining({ youtubeId: 'aaaaaaaaaaa', outcome: 'rejected', reason: null }),
    ]);
  });
});
