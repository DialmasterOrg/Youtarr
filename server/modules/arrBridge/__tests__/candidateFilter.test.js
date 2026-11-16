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
  runtimeWindow,
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
      ['Bluey Season 1 Episode 1-2'],
      ['Bluey Season 1 Episode 1 - 2'],
      ['Bluey (Season 1 Episode 1 - 2)'],
      ['Bluey Season 1 Episode 1, 2'],
      ['Bluey 1x01 - 1x03'],
      ['Bluey 1x01-03'],
      ['Bluey 1x01 & 02'],
      ['Bluey 1x01 - 02'],
      ['Bluey Season 1 Episode 1 - 3 (Full Episodes)'],
      ['Bluey Season 1 Episode 1 - 2 Full Episodes'],
      ['Bluey Season 1 Episode 1 - 2 HD'],
      ['Bluey 1x01 - 03 [HD]'],
    ])('sees more than one episode in %s', (title) => {
      expect(hasEpisodeRange(title)).toBe(true);
    });

    test.each([
      ['Bluey S01E01 Magic Xylophone'],
      ['Bluey S01E01 - Magic Xylophone'],
      ['Bluey S01E01 | Full Episode'],
      ['Bluey Season 1 Episode 1 Full Episode'],
      ['The Beverly Hillbillies S01E01 (1962) The Clampetts Strike Oil'],
      ['Kitchen Nightmares Season 1 Episode 5 - 24 Hours to Hell'],
      ['Kitchen Nightmares Season 1 Episode 5 - 1080p HD'],
      ['Kitchen Nightmares Season 1 Episode 5-1080p'],
      ['Kitchen Nightmares Season 1 Episode 5, 2007'],
      ['Kitchen Nightmares 1x05 - 4K Remaster'],
      ['Kitchen Nightmares 1x05 - 24 Hours to Hell'],
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

  describe('runtimeWindow', () => {
    test.each([
      ['a 25 minute series', 1500, 'tv', { minSeconds: 900, maxSeconds: 2025 }],
      ['a 7 minute series, widened to 3 minutes either side', 420, 'tv', { minSeconds: 240, maxSeconds: 600 }],
      ['a 45 minute series', 2700, 'tv', { minSeconds: 1620, maxSeconds: 3645 }],
      ['a 2 minute series, held at the sample threshold', 120, 'tv', { minSeconds: 90, maxSeconds: 300 }],
      ['a 78 minute movie', 4680, 'movie', { minSeconds: 3978, maxSeconds: 5382 }],
    ])('%s', (_label, runtimeSeconds, kind, expected) => {
      expect(runtimeWindow(runtimeSeconds, kind)).toEqual(expected);
    });

    test.each([[0], [null], [undefined], [-60], ['1500']])('is null for the runtime %p', (runtimeSeconds) => {
      expect(runtimeWindow(runtimeSeconds, 'tv')).toBeNull();
    });
  });

  describe('with a known runtime', () => {
    const BEYBLADE = { text: 'Beyblade', season: 1, episode: 29, runtimeSeconds: 1500 };

    test('an episode of the right length passes below the fixed minimum', () => {
      const candidates = [candidate('Bluey S01E01 Magic Xylophone', { duration: 7 * 60 })];
      const request = { text: 'Bluey', season: 1, episode: 1, settings: settings() };

      expect(filterTvEpisode(candidates, request)).toEqual([]);
      expect(filterTvEpisode(candidates, { ...request, runtimeSeconds: 420 })).toHaveLength(1);
    });

    test('a double-length video is rejected even with the right marker', () => {
      const candidates = [candidate('Beyblade S01E29', { duration: 2635 })];

      expect(filterTvEpisode(candidates, { ...BEYBLADE, runtimeSeconds: null, settings: settings() })).toHaveLength(1);
      expect(filterTvEpisode(candidates, { ...BEYBLADE, settings: settings() })).toEqual([]);
      expect(filterTvEpisode(candidates, { ...BEYBLADE, settings: settings({ looseMatching: true }) })).toEqual([]);
    });

    test('an unknown duration still fails strict matching and passes loose matching', () => {
      const candidates = [candidate('Beyblade S01E29', { duration: null })];

      expect(filterTvEpisode(candidates, { ...BEYBLADE, settings: settings() })).toEqual([]);
      expect(filterTvEpisode(candidates, { ...BEYBLADE, settings: settings({ looseMatching: true }) })).toHaveLength(1);
    });

    test('a season answer uses the window too', () => {
      const candidates = [
        candidate('Bluey S01E01', { duration: 7 * 60 }),
        candidate('Bluey S01E02', { duration: 60 * 60 }),
      ];

      const matches = filterTvSeason(candidates, { text: 'Bluey', season: 1, runtimeSeconds: 420, settings: settings() });

      expect(matches.map((match) => match.episode)).toEqual([1]);
    });

    test('a daily answer uses the window too', () => {
      const date = new Date(Date.UTC(2025, 1, 16));
      const candidates = [
        candidate('Last Week Tonight: Tariffs', { duration: 33 * 60 }),
        candidate('Last Week Tonight: Web Exclusive', { duration: 12 * 60 }),
      ];

      const kept = filterTvDaily(candidates, { text: 'Last Week Tonight', date, runtimeSeconds: 1980, settings: settings() });

      expect(titles(kept)).toEqual(['Last Week Tonight: Tariffs']);
    });

    test('a movie far from its runtime is rejected even with the year', () => {
      const candidates = [
        candidate('Plan 9 from Outer Space (1957)', { duration: 79 * 60 }),
        candidate('Plan 9 from Outer Space (1957) colorized cut', { duration: 120 * 60 }),
      ];

      const kept = filterMovie(candidates, {
        title: 'Plan 9 from Outer Space', year: 1957, runtimeSeconds: 4680, settings: settings(),
      });

      expect(titles(kept)).toEqual(['Plan 9 from Outer Space (1957)']);
    });

    test('a short film passes below the fixed movie minimum', () => {
      const candidates = [candidate('A Trip to the Moon (1902)', { duration: 14 * 60 })];
      const request = { title: 'A Trip to the Moon', year: 1902, settings: settings() };

      expect(filterMovie(candidates, request)).toEqual([]);
      expect(filterMovie(candidates, { ...request, runtimeSeconds: 14 * 60 })).toHaveLength(1);
    });
  });
});
