/* eslint-env jest */
const { createRecentSearches } = require('../recentSearches');

const AT = new Date('2025-06-01T10:00:00.000Z');

function episodeRequest(overrides = {}) {
  return {
    t: 'tvsearch', kind: 'tv', shape: 'episode', text: 'Beyblade', textSource: 'title',
    season: 1, episode: 29, year: null, month: null, day: null, limit: 100, offset: 0, emptyReason: null,
    ...overrides,
  };
}

// The recorder and what it handed on, in the order it did.
function recording() {
  const saved = [];
  return { searches: createRecentSearches({ save: (entry) => saved.push(entry) }), saved };
}

const result = (youtubeId, overrides = {}) => ({
  youtubeId, title: `Video ${youtubeId}`, channelName: 'Uploads', duration: 1320, publishedAt: '2024-03-01T12:00:00.000Z',
  ...overrides,
});

describe('recentSearches', () => {
  test('hands on nothing before a request is answered', () => {
    const { searches, saved } = recording();

    searches.start(episodeRequest(), AT);

    expect(saved).toEqual([]);
  });

  test('records without anywhere to hand the search on', () => {
    const record = createRecentSearches().start(episodeRequest(), AT);

    expect(() => record.answered(0)).not.toThrow();
  });

  test('records what was asked, the search that ran and what became of each result', () => {
    const { searches, saved } = recording();
    const offered = result('aaaaaaaaaaa');
    const rejected = result('bbbbbbbbbbb', { duration: undefined });

    const record = searches.start(episodeRequest(), AT);
    const stage = record.stage({ matcher: 'episode-code', query: 'Beyblade S01E29' }, [offered, rejected]);
    stage.offer(offered, 'Beyblade.S01E29.1080p.YT.WEB-DL-Uploads');
    stage.reject(rejected, 'unknown-length');
    record.answered(1);

    expect(saved).toEqual([{
      at: AT,
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
    const { searches, saved } = recording();

    const searched = searches.start(episodeRequest(), AT);
    searched.stage({ matcher: 'episode-code', query: 'Beyblade S01E29' }, []);
    searched.skipTitleStage('no-connection');
    searched.answered(0);
    const skipped = searches.start(episodeRequest({ shape: 'empty', emptyReason: 'no-season' }), AT);
    skipped.notSearched('no-season');
    skipped.answered(0);

    expect(saved.map(({ outcome, note, titleStageSkipped }) => ({ outcome, note, titleStageSkipped }))).toEqual([
      { outcome: 'nothing', note: null, titleStageSkipped: 'no-connection' },
      { outcome: 'not-searched', note: 'no-season', titleStageSkipped: null },
    ]);
  });

  test('a failed search is handed on once, with the stages that ran before it failed', () => {
    const { searches, saved } = recording();

    const record = searches.start(episodeRequest(), AT);
    record.stage({ matcher: 'episode-title', query: 'Beyblade Play It Again Dizzi' }, [result('aaaaaaaaaaa')]);
    record.failed('search-failed');
    record.answered(3);

    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ outcome: 'failed', offered: 0, note: 'search-failed' });
    expect(saved[0].stages).toHaveLength(1);
  });

  test('cuts overlong text', () => {
    const { searches, saved } = recording();
    const long = 'x'.repeat(500);
    const video = result('aaaaaaaaaaa', { title: long, channelName: long });

    const record = searches.start(episodeRequest({ text: long }), AT);
    const stage = record.stage({ matcher: 'episode-code', query: long }, [video]);
    stage.offer(video, long);
    record.answered(1);

    const [entry] = saved;
    const [candidate] = entry.stages[0].candidates;
    expect([
      entry.asked.text, entry.stages[0].query, candidate.title, candidate.channelName, candidate.releaseTitle,
    ].map((text) => text.length)).toEqual([200, 200, 200, 200, 200]);
  });

  test('ignores a result the stage was not started with', () => {
    const { searches, saved } = recording();
    const record = searches.start(episodeRequest(), AT);
    const stage = record.stage({ matcher: 'episode-code', query: 'Beyblade S01E29' }, [result('aaaaaaaaaaa')]);

    stage.offer(result('zzzzzzzzzzz'), 'Other.S01E01');
    stage.reject(result('zzzzzzzzzzz'), 'too-short');
    record.answered(0);

    expect(saved[0].stages[0].candidates).toEqual([
      expect.objectContaining({ youtubeId: 'aaaaaaaaaaa', outcome: 'rejected', reason: null }),
    ]);
  });
});
