/* eslint-env jest */
const { filterByEpisodeTitle, canMatchByTitle, seriesChannelRank, bareEpisodeNumbers } = require('../episodeMatcher');

function candidate(youtubeId, title, channelName, duration) {
  return { youtubeId, title, channelName, duration, publishedAt: '2020-08-30T16:00:24.000Z' };
}

function settings(overrides = {}) {
  return {
    looseMatching: false,
    excludeTerms: ['trailer', 'review', 'interview', 'behind the scenes'],
    minTvSeconds: 600,
    ...overrides,
  };
}

const LOOSE = settings({ looseMatching: true });

// What YouTube returned for "Beyblade Play It Again Dizzi" on 2026-11-15.
const OFFICIAL = candidate('g7VYYfoNaf0', 'BEYBLADE EN Episode 29: Play it Again Dizzi!', 'BEYBLADE Official', 1318);
const CLIP = candidate('Ema1nx3zz4g', 'Episode 29: Play It Again Dizzi!', 'justin fielding', 6);
const CLASSIC = candidate('avUFb3DESfw', 'Play it Again Dizzi', 'Beyblade: The Classic First Season', 1321);
const DOUBLE = candidate(
  'b9Xi2xAKqi4',
  'BEYBLADE | Ep.29 Play it Again Dizzi! | Ep.30 Cruising for a Bruising',
  'BEYBLADE English - Official Channel',
  2635
);
const UNRELATED = candidate('WMfoWbXSSBQ', 'BEYBLADE X | Meet the Bladers: THE DREAMS!', 'BEYBLADE English - Official Channel', 76);
const SEARCH_RESULTS = [OFFICIAL, CLIP, CLASSIC, DOUBLE, UNRELATED];

// What Sonarr 4 holds for Beyblade S01E29.
function beyblade(overrides = {}) {
  return {
    seriesTitle: 'Beyblade',
    seriesTitles: ['Beyblade'],
    episodeTitle: 'Play It Again, Dizzi!',
    otherEpisodeTitles: ['Bottom of the Ninth', 'Cruising for a Bruising', 'London Calling'],
    runtimeSeconds: 1500,
    season: 1,
    episode: 29,
    absoluteNumber: 29,
    ...overrides,
  };
}

function show(episodeTitle, overrides = {}) {
  return {
    seriesTitle: 'Some Show',
    seriesTitles: ['Some Show'],
    episodeTitle,
    otherEpisodeTitles: [],
    runtimeSeconds: 1500,
    season: 1,
    episode: 5,
    absoluteNumber: null,
    ...overrides,
  };
}

const ids = (list) => list.map((item) => item.youtubeId);
const video = (title, overrides = {}) => ({ ...candidate('abcdefghijk', title, 'Uploads', 1320), ...overrides });
const passes = (title, episode, options = settings(), overrides = {}) => (
  filterByEpisodeTitle([video(title, overrides)], { episode, settings: options }).length === 1
);
// The reason reported for one candidate, or null when it is kept.
function reasonFor(item, episode, options = settings()) {
  const reported = [];
  const kept = filterByEpisodeTitle([item], { episode, settings: options, onReject: (_rejected, reason) => reported.push(reason) });
  expect(reported).toHaveLength(kept.length === 1 ? 0 : 1);
  return reported[0] ?? null;
}

describe('episodeMatcher', () => {
  describe('Beyblade S01E29, "Play It Again, Dizzi!"', () => {
    test('finds the 22 minute official upload and the classic-channel upload, in source order', () => {
      const kept = filterByEpisodeTitle(SEARCH_RESULTS, { episode: beyblade(), settings: settings() });

      expect(ids(kept)).toEqual(['g7VYYfoNaf0', 'avUFb3DESfw']);
    });

    test('rejects the 44 minute double episode', () => {
      expect(filterByEpisodeTitle([DOUBLE], { episode: beyblade(), settings: settings() })).toEqual([]);
    });

    test('rejects the double episode by its title alone, when its length would pass', () => {
      const shortened = { ...DOUBLE, duration: 1400 };

      expect(filterByEpisodeTitle([shortened], { episode: beyblade(), settings: settings() })).toEqual([]);
    });

    test('rejects the double episode by its two episode numbers, when Sonarr lists no other titles', () => {
      const shortened = { ...DOUBLE, duration: 1400 };
      const episode = beyblade({ otherEpisodeTitles: [] });

      expect(filterByEpisodeTitle([shortened], { episode, settings: settings() })).toEqual([]);
    });

    test('rejects the double episode by the other episode\'s title, when it carries no numbers', () => {
      const unnumbered = video('BEYBLADE | Play it Again Dizzi! | Cruising for a Bruising');

      expect(filterByEpisodeTitle([unnumbered], { episode: beyblade(), settings: settings() })).toEqual([]);
    });

    test('rejects the double episode with loose matching on', () => {
      expect(filterByEpisodeTitle([DOUBLE, { ...DOUBLE, duration: 1400 }], { episode: beyblade(), settings: LOOSE }))
        .toEqual([]);
    });

    test('rejects the 6 second clip', () => {
      expect(filterByEpisodeTitle([CLIP], { episode: beyblade(), settings: settings() })).toEqual([]);
      expect(filterByEpisodeTitle([CLIP], { episode: beyblade(), settings: LOOSE })).toEqual([]);
    });
  });

  describe('the episode title', () => {
    test.each([
      ['punctuation and case', 'Play It Again, Dizzi!', 'Some Show - PLAY IT AGAIN DIZZI'],
      ['accents', 'Déjà Vu All Over Again', 'Some Show: Deja vu all over again'],
      ['an ampersand', 'Law & Order', 'Some Show | Law and Order'],
      ['apostrophes', 'It\'s All Relative', 'Some Show Its All Relative'],
    ])('%s do not matter', (_label, episodeTitle, title) => {
      expect(passes(title, show(episodeTitle))).toBe(true);
    });

    test('the words must be the phrase, not scattered', () => {
      expect(passes('Some Show - Again I Play Dizzi', show('Play It Again, Dizzi!'))).toBe(false);
    });

    test('part of a longer word is not the phrase', () => {
      expect(passes('Some Show - Replay It Again Dizzi', show('Play It Again, Dizzi!'))).toBe(false);
    });
  });

  describe('the series name', () => {
    test('may come from the channel name', () => {
      expect(passes('Play it Again Dizzi', show('Play It Again, Dizzi!'), settings(), { channelName: 'Some Show Official' }))
        .toBe(true);
    });

    // What YouTube returned for "MrBeast I Granted 100 Kids Their Biggest Wish"
    // on 2026-11-15: two re-uploads around the show's own video.
    test('a channel named after the series comes before re-uploads that only mention it', () => {
      const episode = show('I Granted 100 Kids Their Biggest Wish!', {
        seriesTitle: 'MrBeast', seriesTitles: ['MrBeast'], runtimeSeconds: 840,
      });
      const results = [
        candidate('SaHE3nRRX0w', 'I Granted 100 Kids Their Biggest Wish! #mrbeast', 'Rsk', 850),
        candidate('lVylRtlPOIE', 'I Granted 100 Kids Their Biggest Wish!', 'MrBeast', 875),
        candidate('y5DX6n_dVAI', 'I Granted 100 Kids Their Biggest Wish!@MrBeast', 'Badol', 871),
      ];

      expect(ids(filterByEpisodeTitle(results, { episode, settings: settings() })))
        .toEqual(['lVylRtlPOIE', 'SaHE3nRRX0w', 'y5DX6n_dVAI']);
      expect(ids(filterByEpisodeTitle(results, { episode, settings: LOOSE })))
        .toEqual(['lVylRtlPOIE', 'SaHE3nRRX0w', 'y5DX6n_dVAI']);
    });

    // "MrBeast 103M view 6 hours ago" was a real channel re-uploading S2026E16.
    test('a channel with exactly the series name comes before one that only contains it', () => {
      const episode = show('Escape 100 Cops, Win $500,000', {
        seriesTitle: 'MrBeast', seriesTitles: ['MrBeast'], runtimeSeconds: 1200,
      });
      const results = [
        candidate('aLNBbQUcpXI', 'Escape 100 Cops, Win $500,000', 'MrBeast 103M view 6 hours ago', 1190),
        candidate('Qtl8lJwbd4g', 'Escape 100 Cops, Win $500,000', 'MrBeast', 1195),
      ];

      expect(ids(filterByEpisodeTitle(results, { episode, settings: settings() }))).toEqual(['Qtl8lJwbd4g', 'aLNBbQUcpXI']);
      expect(results.map((result) => seriesChannelRank(result, episode, settings()))).toEqual([1, 2]);
      expect(seriesChannelRank(candidate('x', 'Escape 100 Cops, Win $500,000 #mrbeast', 'Rsk', 1190), episode, settings()))
        .toBe(0);
    });

    test('a tag or an article in the series name does not stop a channel from having exactly its name', () => {
      const episode = show('Diversity Day', { seriesTitle: 'The Office (US)', seriesTitles: ['The Office (US)'] });

      expect(seriesChannelRank(video('Diversity Day', { channelName: 'The Office' }), episode, settings())).toBe(2);
    });

    describe('a channel named after the series with an excluded word ("Mission Impossible Reviews")', () => {
      const episode = show('The Lions', {
        seriesTitle: 'Mission: Impossible (1988)',
        seriesTitles: ['Mission: Impossible (1988)'],
        runtimeSeconds: 2700,
        season: 1,
        episode: 10,
      });
      // What YouTube returned for "Mission Impossible The Lions" on 2026-11-16:
      // a 29 minute review and the 47 minute episode.
      const review = candidate('qQmJpJ-ChgI', '1988 S01E10: THE LIONS', 'Mission Impossible Reviews', 1773);
      const upload = candidate('qHAsaUolgws', 'Mission: Impossible (1988) S01E10 The Lions', 'Alisha H', 2823);

      test('is not the series\' channel, so its name does not stand in for the series name', () => {
        expect(ids(filterByEpisodeTitle([review, upload], { episode, settings: settings() }))).toEqual(['qHAsaUolgws']);
        expect(seriesChannelRank(review, episode, settings())).toBe(0);
      });

      test('does not come first under loose matching', () => {
        expect(ids(filterByEpisodeTitle([upload, review], { episode, settings: LOOSE })))
          .toEqual(['qHAsaUolgws', 'qQmJpJ-ChgI']);
      });

      test('still is the series\' channel when the series name itself has the word', () => {
        const reviewShow = show('Opening Night', { seriesTitle: 'The Review Show', seriesTitles: ['The Review Show'] });

        expect(seriesChannelRank(video('Opening Night', { channelName: 'The Review Show' }), reviewShow, settings()))
          .toBe(2);
      });
    });

    test('may be an alias', () => {
      const episode = show('Do as Planned', { seriesTitle: 'Money Heist', seriesTitles: ['Money Heist', 'La Casa de Papel'] });

      expect(passes('La Casa de Papel - Do as Planned', episode)).toBe(true);
    });

    test('a tag in the series name is not required', () => {
      const episode = show('Diversity Day', { seriesTitle: 'The Office (US)', seriesTitles: ['The Office (US)'] });

      expect(passes('The Office - Diversity Day', episode)).toBe(true);
    });

    test('without it anywhere the candidate fails strict matching and passes loose matching', () => {
      const episode = show('Play It Again, Dizzi!');

      expect(passes('Play it Again Dizzi', episode)).toBe(false);
      expect(passes('Play it Again Dizzi', episode, LOOSE)).toBe(true);
    });
  });

  describe('another episode in the title', () => {
    test('a marker for another episode rejects', () => {
      expect(passes('Beyblade S01E30 Play it Again Dizzi', beyblade())).toBe(false);
      expect(passes('Beyblade S01E30 Play it Again Dizzi', beyblade(), LOOSE)).toBe(false);
    });

    test('the right marker is fine', () => {
      expect(passes('Beyblade S01E29 Play it Again Dizzi', beyblade())).toBe(true);
    });

    test('an episode range rejects', () => {
      expect(passes('Beyblade Episodes 29-30 Play it Again Dizzi', beyblade(), settings(), { duration: 1400 })).toBe(false);
    });

    test('a single different bare number is fine: official channels count across seasons', () => {
      const episode = beyblade({ season: 2, episode: 5, absoluteNumber: 56, episodeTitle: 'Guess Who\'s Back in Town' });

      expect(passes('BEYBLADE EN Episode 56: Guess Who\'s Back in Town', episode)).toBe(true);
    });

    test('"Part 2" is not a second episode number', () => {
      expect(passes('Some Show Episode 5: The Long Night Part 2', show('The Long Night Part 2'))).toBe(true);
    });

    test('another episode\'s longer title that starts with the wanted one rejects', () => {
      const episode = show('The Long Fight', { otherEpisodeTitles: ['The Long Fight Part 2'] });

      expect(passes('Some Show: The Long Fight Part 2', episode)).toBe(false);
      expect(passes('Some Show: The Long Fight', episode)).toBe(true);
    });
  });

  describe('the length', () => {
    test('a candidate with no duration fails strict matching and passes loose matching', () => {
      const unknown = { ...OFFICIAL, duration: null };

      expect(filterByEpisodeTitle([unknown], { episode: beyblade(), settings: settings() })).toEqual([]);
      expect(filterByEpisodeTitle([unknown], { episode: beyblade(), settings: LOOSE })).toHaveLength(1);
    });

    // Without a runtime nothing bounds the length from above, and an hour of
    // episodes whose title lists this one would pass.
    test('without a runtime nothing is matched by title under strict matching', () => {
      const episode = show('Play It Again, Dizzi!', { runtimeSeconds: null });

      expect(passes('Some Show - Play it Again Dizzi', episode, settings(), { duration: 1320 })).toBe(false);
      expect(canMatchByTitle(episode, settings())).toBe(false);
      expect(canMatchByTitle(show('Play It Again, Dizzi!'), settings())).toBe(true);
    });

    test('a compilation is not offered when Sonarr reports no runtime', () => {
      const episode = show('Magic Xylophone', {
        seriesTitle: 'Bluey (2018)', seriesTitles: ['Bluey (2018)', 'Bluey'], runtimeSeconds: null,
      });
      const compilation = video('Bluey Full Episodes | Magic Xylophone, Hospital and more! | 1 Hour', {
        channelName: 'Bluey - Official Channel', duration: 3600,
      });

      expect(filterByEpisodeTitle([compilation], { episode, settings: settings() })).toEqual([]);
    });

    test('loose matching without a runtime falls back to the fixed minimum', () => {
      const episode = show('Play It Again, Dizzi!', { runtimeSeconds: null });

      expect(canMatchByTitle(episode, LOOSE)).toBe(true);
      expect(passes('Some Show - Play it Again Dizzi', episode, LOOSE, { duration: 2635 })).toBe(true);
      expect(passes('Some Show - Play it Again Dizzi', episode, LOOSE, { duration: 300 })).toBe(false);
    });
  });

  describe('another series', () => {
    test('a video naming a sibling series from the library is rejected', () => {
      const episode = beyblade({ siblingTitles: ['Beyblade Burst', 'Beyblade: Metal Fusion'] });

      expect(passes('Beyblade Burst Episode 29: Play it Again Dizzi', episode)).toBe(false);
      expect(passes('Beyblade Metal Fusion - Play it Again Dizzi', episode)).toBe(false);
      expect(passes('Play it Again Dizzi', episode, settings(), { channelName: 'Beyblade Burst Fans' })).toBe(false);
      expect(passes('BEYBLADE EN Episode 29: Play it Again Dizzi!', episode)).toBe(true);
    });

    test('the sibling rule is a strict rule', () => {
      const episode = beyblade({ siblingTitles: ['Beyblade Burst'] });

      expect(passes('Beyblade Burst Episode 29: Play it Again Dizzi', episode, LOOSE)).toBe(true);
    });

    test('a year before the series began means an earlier series of the same name', () => {
      const episode = show('The Hand of God', {
        seriesTitle: 'Battlestar Galactica (2003)',
        seriesTitles: ['Battlestar Galactica (2003)'],
        seriesYear: 2003,
        runtimeSeconds: 2640,
      });
      const length = { duration: 2880 };

      expect(passes('Battlestar Galactica (1978) - The Hand of God - Full Episode', episode, settings(), length)).toBe(false);
      expect(passes('Battlestar Galactica (2003) - The Hand of God - Full Episode', episode, settings(), length)).toBe(true);
      expect(passes('Battlestar Galactica - The Hand of God - Full Episode', episode, settings(), length)).toBe(true);
    });

    test('a year in the episode title or the series name is not held against the video', () => {
      const episode = show('The Summer of 1969', { seriesYear: 2005 });
      const tagged = show('Opening Night', {
        seriesTitle: 'Mission: Impossible (1988)', seriesTitles: ['Mission: Impossible (1988)'], seriesYear: 1988,
      });

      expect(passes('Some Show - The Summer of 1969', episode)).toBe(true);
      expect(passes('Mission Impossible 1988 - Opening Night', tagged)).toBe(true);
    });

    test('the series name must sit in the title or in the channel name, not half in each', () => {
      const episode = show('The End of the World', {
        seriesTitle: 'Doctor Who (2005)', seriesTitles: ['Doctor Who (2005)', 'Doctor Who'], runtimeSeconds: 2700,
      });

      expect(passes('Who Will Survive The End of the World?', episode, settings(), { channelName: 'Doctor Mike', duration: 2700 }))
        .toBe(false);
      expect(passes('The End of the World', episode, settings(), { channelName: 'Doctor Who Classic', duration: 2700 }))
        .toBe(true);
    });
  });

  describe('a one-word episode title', () => {
    const episode = show('Basketball', { seriesTitle: 'The Office (US)', seriesTitles: ['The Office (US)', 'The Office'] });

    test('needs the episode number under strict matching', () => {
      expect(passes('The Office - Basketball (Full Game Scene)', episode)).toBe(false);
      expect(passes('The Office S01E05 Basketball', episode)).toBe(true);
      expect(passes('The Office Episode 5: Basketball', episode)).toBe(true);
    });

    test('passes without a number when the title is only a series name and the episode title', () => {
      expect(passes('The Office - Basketball', episode)).toBe(true);
      expect(passes('The Office (US): Basketball', episode)).toBe(true);
      expect(passes('Basketball | The Office', episode)).toBe(true);
    });

    // What yt-dlp returned first for 'All Souls "The Deal"' on 2026-11-23:
    // the episode, from a channel that titles its uploads without a number.
    test('All Souls S01E03 finds the upload titled "All Souls the deal"', () => {
      const allSouls = show('The Deal', {
        seriesTitle: 'All Souls', seriesTitles: ['All Souls'], runtimeSeconds: 2700, episode: 3,
      });
      const upload = candidate('QDQ89luX_Cs', 'All Souls the deal', 'Ballinn Sunnie93', 2580);

      expect(ids(filterByEpisodeTitle([upload], { episode: allSouls, settings: settings() }))).toEqual(['QDQ89luX_Cs']);
    });

    test('accepts the absolute number as the episode number', () => {
      expect(passes('The Office #12 Basketball', { ...episode, absoluteNumber: 12 })).toBe(true);
      expect(passes('The Office #13 Basketball', { ...episode, absoluteNumber: 12 })).toBe(false);
    });

    test('passes without a number under loose matching', () => {
      expect(passes('The Office - Basketball (Full Game Scene)', episode, LOOSE)).toBe(true);
    });

    test('a title of an article and one word counts as one word', () => {
      expect(passes('Some Show Finale - The Fight', show('The Fight'))).toBe(false);
      expect(passes('Some Show Ep. 5 - The Fight', show('The Fight'))).toBe(true);
    });
  });

  describe('exclude terms', () => {
    test('reject a candidate', () => {
      expect(passes('Some Show - Play it Again Dizzi review', show('Play It Again, Dizzi!'))).toBe(false);
    });

    test('never reject for a word the episode title or the series name contains', () => {
      expect(passes('Some Show - The Big Interview', show('The Big Interview'))).toBe(true);
      const episode = show('Opening Night', { seriesTitle: 'The Review Show', seriesTitles: ['The Review Show'] });
      expect(passes('The Review Show - Opening Night', episode)).toBe(true);
    });
  });

  describe('the reason a candidate is left out (onReject)', () => {
    const office = show('Basketball', { seriesTitle: 'The Office (US)', seriesTitles: ['The Office (US)', 'The Office'] });

    test.each([
      ['excluded-word', video('Beyblade - Play it Again Dizzi review'), beyblade()],
      ['unknown-length', video('Beyblade - Play it Again Dizzi', { duration: undefined }), beyblade()],
      ['outside-runtime', CLIP, beyblade()],
      ['episode-title-missing', video('BEYBLADE X | Meet the Bladers: THE DREAMS!'), beyblade()],
      ['several-episodes', { ...DOUBLE, duration: 1400 }, beyblade({ otherEpisodeTitles: [] })],
      ['several-episodes', video('Beyblade S01E29-E30 Play it Again Dizzi'), beyblade()],
      ['wrong-episode', video('Beyblade S01E30 Play it Again Dizzi'), beyblade()],
      ['another-episode-title', video('BEYBLADE | Play it Again Dizzi! | Cruising for a Bruising'), beyblade()],
      ['name-missing', video('Play it Again Dizzi'), beyblade()],
      [
        'another-series',
        video('Beyblade Burst Episode 29: Play it Again Dizzi'),
        beyblade({ siblingTitles: ['Beyblade Burst'] }),
      ],
      ['episode-number-missing', video('The Office - Basketball (Full Game Scene)'), office],
    ])('%s', (reason, item, episode) => {
      expect(reasonFor(item, episode)).toBe(reason);
    });

    test('too-short, when no runtime is known and matching is loose', () => {
      const short = video('Beyblade - Play it Again Dizzi', { duration: 300 });

      expect(reasonFor(short, beyblade({ runtimeSeconds: null }), LOOSE)).toBe('too-short');
    });

    test('a candidate that is kept is not reported', () => {
      expect(reasonFor(OFFICIAL, beyblade())).toBeNull();
    });

    test('reports each candidate left out once, and keeps the ones it kept', () => {
      const reported = [];
      const kept = filterByEpisodeTitle(SEARCH_RESULTS, {
        episode: beyblade(), settings: settings(), onReject: (rejected, reason) => reported.push([rejected.youtubeId, reason]),
      });

      expect(ids(kept)).toEqual(['g7VYYfoNaf0', 'avUFb3DESfw']);
      expect(reported).toEqual([
        ['Ema1nx3zz4g', 'outside-runtime'],
        ['b9Xi2xAKqi4', 'outside-runtime'],
        ['WMfoWbXSSBQ', 'outside-runtime'],
      ]);
    });
  });

  test('bareEpisodeNumbers reads numbers written without a season, and not parts', () => {
    expect(bareEpisodeNumbers('Episode 29: Title')).toEqual([29]);
    expect(bareEpisodeNumbers('Ep.29 Title | Ep. 30 Other')).toEqual([29, 30]);
    expect(bareEpisodeNumbers('Show #7 E08')).toEqual([8, 7]);
    expect(bareEpisodeNumbers('Show S01E29 Part 2')).toEqual([]);
    expect(bareEpisodeNumbers('Episode 5 and episode 5 again')).toEqual([5]);
  });
});
