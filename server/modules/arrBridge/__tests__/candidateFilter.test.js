/* eslint-env jest */
const {
  matchTerms,
  episodeMarkers,
  looseEpisodeNumbers,
  hasEpisodeRange,
  hasExcludedTerm,
  filterTvEpisode,
  filterTvSeason,
  filterTvDaily,
  filterMovie,
} = require('../candidateFilter');

const TWENTY_MINUTES = 20 * 60;
const TWO_HOURS = 2 * 60 * 60;

function candidate(title, overrides = {}) {
  return {
    youtubeId: 'abcdefghijk',
    title,
    channelName: 'Some Channel',
    duration: TWENTY_MINUTES,
    publishedAt: '2025-02-16T22:00:00.000Z',
    ...overrides,
  };
}

function settings(overrides = {}) {
  return {
    looseMatching: false,
    excludeTerms: ['trailer', 'review', 'behind the scenes'],
    minTvSeconds: 600,
    minMovieSeconds: 3600,
    ...overrides,
  };
}

const titles = (list) => list.map((item) => item.title);

describe('candidateFilter', () => {
  describe('matchTerms', () => {
    test('drops stopwords and a trailing parenthesized tag', () => {
      expect(matchTerms('The Office (US)', {})).toEqual(['office']);
    });

    test('keeps single digits but drops single letters', () => {
      expect(matchTerms('9-1-1', {})).toEqual(['9', '1', '1']);
      expect(matchTerms('Marvel\'s Agents of S.H.I.E.L.D.', {})).toEqual(['marvels', 'agents']);
    });

    test('drops a trailing year only when asked and other terms remain', () => {
      expect(matchTerms('Shogun 2024', { dropTrailingYear: true })).toEqual(['shogun']);
      expect(matchTerms('Shogun 2024', {})).toEqual(['shogun', '2024']);
      expect(matchTerms('1899', { dropTrailingYear: true })).toEqual(['1899']);
    });

    test('folds accents', () => {
      expect(matchTerms('Shōgun', {})).toEqual(['shogun']);
    });

    test('falls back to every token when only stopwords are left', () => {
      expect(matchTerms('The A', {})).toEqual(['the', 'a']);
    });

    test('returns nothing for text without letters or digits', () => {
      expect(matchTerms('!!!', {})).toEqual([]);
    });
  });

  describe('episodeMarkers', () => {
    test.each([
      ['Show S01E02 Full Episode', [{ season: 1, episode: 2 }]],
      ['Show s1 e2', [{ season: 1, episode: 2 }]],
      ['Show S01.E02', [{ season: 1, episode: 2 }]],
      ['Show 1x02', [{ season: 1, episode: 2 }]],
      ['Show - Season 1 Episode 2', [{ season: 1, episode: 2 }]],
      ['Show Series 1, Ep. 2', [{ season: 1, episode: 2 }]],
      ['Show Season 3: Episode 10', [{ season: 3, episode: 10 }]],
      ['Show S2024E05', [{ season: 2024, episode: 5 }]],
      ['Show S01E01 + S01E02', [{ season: 1, episode: 1 }, { season: 1, episode: 2 }]],
      ['Show S01E02 (Season 1 Episode 2)', [{ season: 1, episode: 2 }]],
    ])('%s', (title, expected) => {
      expect(episodeMarkers(title)).toEqual(expected);
    });

    test.each([
      ['Show 2024'], ['Wallpaper 1920x1080'], ['Show Episode 2'], ['Shows1e2'],
      ['Top Gear 4x4 Challenge'], ['Truck 6x6 review'],
    ])('finds none in %s', (title) => {
      expect(episodeMarkers(title)).toEqual([]);
    });
  });

  describe('hasEpisodeRange', () => {
    test.each([
      ['Bluey S01E01-E10 Full Episodes'],
      ['Bluey S01E01 - E10'],
      ['Bluey S01E01-03'],
      ['Bluey S01E01-S01E03'],
      ['Bluey S1E1 & 2'],
      ['Bluey S01E01, E02, E03'],
      ['Bluey S01E01 to E05'],
      ['Bluey Season 1 Episodes 1-10'],
      ['Bluey Season 1 Episode 1 & 2'],
      ['Bluey Season 1 Episodes 1 and 2'],
      ['Bluey 1x01-1x03'],
    ])('sees more than one episode in %s', (title) => {
      expect(hasEpisodeRange(title)).toBe(true);
    });

    test.each([
      ['Bluey S01E01 Magic Xylophone'],
      ['Bluey S01E01 - Magic Xylophone'],
      ['Bluey S01E01 | Full Episode'],
      ['Bluey Season 1 Episode 1 Full Episode'],
      ['The Beverly Hillbillies S01E01 (1962) The Clampetts Strike Oil'],
    ])('sees one episode in %s', (title) => {
      expect(hasEpisodeRange(title)).toBe(false);
    });
  });

  test('looseEpisodeNumbers reads the common episode-only forms', () => {
    expect(looseEpisodeNumbers('Show Episode 5')).toEqual([5]);
    expect(looseEpisodeNumbers('Show Ep. 5')).toEqual([5]);
    expect(looseEpisodeNumbers('Show E05')).toEqual([5]);
    expect(looseEpisodeNumbers('Show #5')).toEqual([5]);
    expect(looseEpisodeNumbers('Show Part 5')).toEqual([5]);
    expect(looseEpisodeNumbers('Show S02E05')).toEqual([]);
    expect(looseEpisodeNumbers('Show 2024')).toEqual([]);
  });

  describe('hasExcludedTerm', () => {
    test('matches a whole word or phrase', () => {
      expect(hasExcludedTerm('The Matrix 1999 Official Trailer', ['trailer'], 'Matrix')).toBe(true);
      expect(hasExcludedTerm('Show: Behind the Scenes!', ['behind the scenes'], 'Show')).toBe(true);
    });

    test('does not match inside a longer word', () => {
      expect(hasExcludedTerm('Trailers Park S01E01', ['trailer'], 'Trailers Park')).toBe(false);
    });

    test('ignores a term the request itself contains', () => {
      expect(hasExcludedTerm('The Review S01E01', ['review'], 'The Review')).toBe(false);
    });
  });

  describe('filterTvEpisode', () => {
    const request = { text: 'The Office (US)', season: 1, episode: 2 };

    test('keeps only candidates carrying the wanted episode marker', () => {
      const candidates = [
        candidate('The Office S01E02 Diversity Day'),
        candidate('The Office S01E03 Health Care'),
        candidate('The Office - Season 1 Episode 2'),
        candidate('The Office best moments'),
      ];
      expect(titles(filterTvEpisode(candidates, { ...request, settings: settings() })))
        .toEqual(['The Office S01E02 Diversity Day', 'The Office - Season 1 Episode 2']);
    });

    describe('another series whose name starts with the requested one', () => {
      const beyblade = { text: 'Beyblade', season: 1, episode: 29 };

      test('strict matching rejects extra words between the series name and the marker', () => {
        const candidates = [
          candidate('Beyblade Metal Fusion S01E29 in hindi'),
          candidate('Beyblade Burst - Season 1 Episode 29'),
        ];
        expect(filterTvEpisode(candidates, { ...beyblade, settings: settings() })).toEqual([]);
      });

      test.each([
        ['Beyblade S01E29'],
        ['Beyblade - Season 1, Episode 29 - Play It Again, Dizzi!'],
        ['BEYBLADE | S01E29 | Full Episode'],
        ['Beyblade Full Episode S01E29'],
        ['Beyblade (2001) S01E29 HD'],
        ['Beyblade Official: Beyblade S01E29'],
        ['S01E29 Beyblade'],
      ])('strict matching keeps %s', (title) => {
        expect(filterTvEpisode([candidate(title)], { ...beyblade, settings: settings() })).toHaveLength(1);
      });

      test('a tag from the requested title may sit before the marker', () => {
        const candidates = [candidate('The Office US S01E02')];
        expect(filterTvEpisode(candidates, { ...request, settings: settings() })).toHaveLength(1);
      });

      test('loose matching does not apply the rule', () => {
        const candidates = [candidate('Beyblade Metal Fusion S01E29')];
        expect(filterTvEpisode(candidates, { ...beyblade, settings: settings({ looseMatching: true }) }))
          .toHaveLength(1);
      });
    });

    test('never offers a video that holds several episodes as one of them', () => {
      const candidates = [
        candidate('The Office S01E01 + S01E02 + S01E03 Full Episodes'),
        candidate('The Office S01E02-E06'),
        candidate('The Office S01E02-04'),
        candidate('The Office Season 1 Episodes 2-6'),
      ];
      expect(filterTvEpisode(candidates, { ...request, settings: settings() })).toEqual([]);
      expect(filterTvEpisode(candidates, { ...request, settings: settings({ looseMatching: true }) })).toEqual([]);
    });

    test('drops a candidate missing a significant term', () => {
      const candidates = [candidate('Parks and Recreation S01E02')];
      expect(filterTvEpisode(candidates, { ...request, settings: settings() })).toEqual([]);
    });

    test('strict matching rejects an episode-only number that loose matching accepts', () => {
      const candidates = [candidate('The Office Episode 2')];
      expect(filterTvEpisode(candidates, { ...request, settings: settings() })).toEqual([]);
      expect(filterTvEpisode(candidates, { ...request, settings: settings({ looseMatching: true }) }))
        .toHaveLength(1);
    });

    test('loose matching still rejects a marker for another season', () => {
      const candidates = [candidate('The Office S02E02')];
      expect(filterTvEpisode(candidates, { ...request, settings: settings({ looseMatching: true }) }))
        .toEqual([]);
    });

    test('drops excluded terms and short videos', () => {
      const candidates = [
        candidate('The Office S01E02 Review'),
        candidate('The Office S01E02', { duration: 9 * 60 }),
      ];
      expect(filterTvEpisode(candidates, { ...request, settings: settings() })).toEqual([]);
    });

    test('an unknown duration fails strict matching and passes loose matching', () => {
      const candidates = [candidate('The Office S01E02', { duration: null })];
      expect(filterTvEpisode(candidates, { ...request, settings: settings() })).toEqual([]);
      expect(filterTvEpisode(candidates, { ...request, settings: settings({ looseMatching: true }) }))
        .toHaveLength(1);
    });

    test('keeps the source order', () => {
      const candidates = [candidate('The Office 1x02 b'), candidate('The Office S01E02 a')];
      expect(titles(filterTvEpisode(candidates, { ...request, settings: settings() })))
        .toEqual(['The Office 1x02 b', 'The Office S01E02 a']);
    });

    test('returns nothing when the request text has no terms', () => {
      const candidates = [candidate('S01E02')];
      expect(filterTvEpisode(candidates, { text: '!!!', season: 1, episode: 2, settings: settings() }))
        .toEqual([]);
    });
  });

  describe('filterTvSeason', () => {
    const request = { text: 'Show', season: 2 };

    test('names each candidate from its own marker', () => {
      const candidates = [candidate('Show S02E03'), candidate('Show Season 2 Episode 7')];
      const result = filterTvSeason(candidates, { ...request, settings: settings() });
      expect(result.map((entry) => entry.episode)).toEqual([3, 7]);
      expect(result[0].candidate.title).toBe('Show S02E03');
    });

    test('skips other seasons, compilations and unmarked videos', () => {
      const candidates = [
        candidate('Show S01E03'),
        candidate('Show S02E01 + S02E02'),
        candidate('Show season 2 full'),
      ];
      expect(filterTvSeason(candidates, { ...request, settings: settings() })).toEqual([]);
    });

    test('skips another series whose name starts with the requested one', () => {
      const candidates = [candidate('Show Reloaded S02E03'), candidate('Show S02E04')];
      const result = filterTvSeason(candidates, { ...request, settings: settings() });
      expect(result.map((entry) => entry.episode)).toEqual([4]);
    });

    test('skips a video whose single marker starts a range of episodes', () => {
      const candidates = [candidate('Show S02E01-E10 Full Episodes'), candidate('Show S02E01-03')];
      expect(filterTvSeason(candidates, { ...request, settings: settings() })).toEqual([]);
    });

    test('stays strict when loose matching is on', () => {
      const candidates = [candidate('Show Episode 3')];
      expect(filterTvSeason(candidates, { ...request, settings: settings({ looseMatching: true }) }))
        .toEqual([]);
    });
  });

  describe('filterTvDaily', () => {
    const request = { text: 'Last Week Tonight', date: new Date(Date.UTC(2025, 1, 16)) };

    test('keeps a candidate published on or next to the air date', () => {
      const candidates = [
        candidate('Last Week Tonight: Tariffs', { publishedAt: '2025-02-16T23:30:00.000Z' }),
        candidate('Last Week Tonight: Next day', { publishedAt: '2025-02-17T08:00:00.000Z' }),
      ];
      expect(filterTvDaily(candidates, { ...request, settings: settings() })).toHaveLength(2);
    });

    test('drops a candidate published days away or with no date', () => {
      const candidates = [
        candidate('Last Week Tonight: Old', { publishedAt: '2025-02-12T23:30:00.000Z' }),
        candidate('Last Week Tonight: Undated', { publishedAt: null }),
      ];
      expect(filterTvDaily(candidates, { ...request, settings: settings() })).toEqual([]);
    });

    test('still needs the series terms', () => {
      const candidates = [candidate('The Daily Show', { publishedAt: '2025-02-16T23:30:00.000Z' })];
      expect(filterTvDaily(candidates, { ...request, settings: settings() })).toEqual([]);
    });
  });

  describe('filterMovie', () => {
    const request = { title: 'The Matrix', year: 1999 };
    const movie = (title, overrides = {}) => candidate(title, { duration: TWO_HOURS, ...overrides });

    test('strict matching needs the year in the candidate title', () => {
      const candidates = [movie('The Matrix (1999) Full Movie'), movie('The Matrix Full Movie')];
      expect(titles(filterMovie(candidates, { ...request, settings: settings() })))
        .toEqual(['The Matrix (1999) Full Movie']);
    });

    test('loose matching drops the year requirement', () => {
      const candidates = [movie('The Matrix Full Movie')];
      expect(filterMovie(candidates, { ...request, settings: settings({ looseMatching: true }) }))
        .toHaveLength(1);
    });

    test('drops trailers and anything under the movie minimum', () => {
      const candidates = [
        movie('The Matrix 1999 Official Trailer'),
        movie('The Matrix 1999', { duration: 50 * 60 }),
      ];
      expect(filterMovie(candidates, { ...request, settings: settings() })).toEqual([]);
    });

    test('keeps a year that is part of the movie title as a required term', () => {
      const candidates = [movie('Blade Runner (2017) full film'), movie('Blade Runner 2049 (2017)')];
      expect(titles(filterMovie(candidates, { title: 'Blade Runner 2049', year: 2017, settings: settings() })))
        .toEqual(['Blade Runner 2049 (2017)']);
    });
  });
});
