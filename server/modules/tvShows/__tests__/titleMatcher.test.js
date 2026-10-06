// matchVideos runs the real Python script: classification must follow
// Python's re exactly, like yt-dlp's match filter.
const { interpretMatch, matchVideos, MATCH_KIND } = require('../titleMatcher');
const { compilePattern } = require('../patternCompiler');

function pattern(text, sources) {
  return { key: text, compiledRegex: compilePattern({ text, kind: 'simple' }).compiledRegex, ...sources };
}

const fixedTitle = { seasonSource: 'fixed', seasonFixed: 1, episodeSource: 'title' };

describe('titleMatcher', () => {
  describe('interpretMatch', () => {
    it('numbers an episode from the title in a fixed season', () => {
      expect(interpretMatch(fixedTitle, { episode: '20', title: 'It\'s All Relative' })).toEqual({
        kind: MATCH_KIND.NUMBERED, season: 1, episode: 20, episodeTitle: 'It\'s All Relative', reason: null,
      });
    });

    it('takes the season from the title', () => {
      const result = interpretMatch({ seasonSource: 'title', episodeSource: 'title' }, { season: '10', episode: '43' });
      expect([result.season, result.episode]).toEqual([10, 43]);
    });

    it('leaves an empty title capture to the video title', () => {
      expect(interpretMatch(fixedTitle, { episode: '3', title: '   ' }).episodeTitle).toBeNull();
    });

    it('marks an order-numbered match for allocation', () => {
      expect(interpretMatch({ seasonSource: 'fixed', seasonFixed: 0, episodeSource: 'order' }, {}))
        .toMatchObject({ kind: MATCH_KIND.ORDER, season: 0, episode: null });
    });

    it('waits for the upload time in a year season', () => {
      expect(interpretMatch({ seasonSource: 'year', episodeSource: 'title' }, { episode: '4' }))
        .toMatchObject({ kind: MATCH_KIND.PENDING, season: null });
    });

    it('keeps a title episode it can\'t place before the upload year is known', () => {
      expect(interpretMatch({ seasonSource: 'year', episodeSource: 'title' }, { episode: '4' }).episode).toBe(4);
    });

    it('waits for the upload time for a date episode', () => {
      expect(interpretMatch({ seasonSource: 'year', episodeSource: 'date' }, {}).kind).toBe(MATCH_KIND.PENDING);
    });

    it('marks a compilation unsupported', () => {
      expect(interpretMatch(fixedTitle, { episode: '19', episode_end: '20' }))
        .toMatchObject({ kind: MATCH_KIND.UNSUPPORTED, reason: 'compilation', season: 1, episode: 19, episodeEnd: 20 });
    });

    it('marks a part unsupported', () => {
      expect(interpretMatch(fixedTitle, { episode: '1', part: '2' }))
        .toMatchObject({ kind: MATCH_KIND.UNSUPPORTED, reason: 'part', part: 2 });
    });

    it('marks a season above 199 unsupported', () => {
      expect(interpretMatch({ seasonSource: 'title', episodeSource: 'title' }, { season: '2024', episode: '1' }))
        .toMatchObject({ kind: MATCH_KIND.UNSUPPORTED, reason: 'number-out-of-range' });
    });

    it('marks a title-sourced season that captured nothing unsupported', () => {
      expect(interpretMatch({ seasonSource: 'title', episodeSource: 'title' }, { season: null, episode: '3' }))
        .toMatchObject({ kind: MATCH_KIND.UNSUPPORTED, reason: 'missing-number' });
    });

    it('marks a title-sourced episode that captured nothing unsupported', () => {
      expect(interpretMatch(fixedTitle, { episode: null }).reason).toBe('missing-number');
    });

    it('lets an upload-year season come without a capture', () => {
      expect(interpretMatch({ seasonSource: 'year', episodeSource: 'title' }, { episode: '4' }).kind).toBe(MATCH_KIND.PENDING);
    });

    it('numbers a year-season title episode when the upload year is known', () => {
      expect(interpretMatch({ seasonSource: 'year', episodeSource: 'title' }, { episode: '4' }, { uploadYear: 2024 }))
        .toMatchObject({ kind: MATCH_KIND.NUMBERED, season: 2024, episode: 4 });
    });

    it('still waits for the upload time for a date episode when the year is known', () => {
      expect(interpretMatch({ seasonSource: 'year', episodeSource: 'date' }, {}, { uploadYear: 2024 }))
        .toMatchObject({ kind: MATCH_KIND.PENDING, season: null });
    });

    it('still allocates an order episode in a year season when the year is known', () => {
      expect(interpretMatch({ seasonSource: 'year', episodeSource: 'order' }, {}, { uploadYear: 2024 }))
        .toMatchObject({ kind: MATCH_KIND.PENDING, season: null });
    });

    it('ignores the upload year for a title or fixed season', () => {
      expect(interpretMatch(fixedTitle, { episode: '4' }, { uploadYear: 2024 }).season).toBe(1);
    });

    it('marks episode 0 unsupported', () => {
      expect(interpretMatch(fixedTitle, { episode: '0' }).reason).toBe('number-out-of-range');
    });

    it('marks an episode beyond a 32-bit integer unsupported', () => {
      expect(interpretMatch(fixedTitle, { episode: '2147483648' }).reason).toBe('number-out-of-range');
    });
  });

  describe('matchVideos', () => {
    const shows = [
      {
        key: 'title:1',
        excludeTerms: ['Official Clip'],
        patterns: [pattern('BEYBLADE BURST QUADSTRIKE EP{episode}', fixedTitle)],
      },
      {
        key: 'title:2',
        excludeTerms: [],
        patterns: [pattern('{title} | BEYBLADE BURST QUADSTRIKE EP* | Official Clip', { seasonSource: 'fixed', seasonFixed: 1, episodeSource: 'order' })],
      },
    ];

    it('gives each video the first show that matches it', async () => {
      const result = await matchVideos(shows, [{ youtubeId: 'a', title: 'BEYBLADE BURST QUADSTRIKE EP3 recap' }]);
      expect(result.get('a')).toMatchObject({ showKey: 'title:1', patternKey: shows[0].patterns[0].key, episode: 3 });
    });

    it('passes a title one show excludes on to the next show', async () => {
      const result = await matchVideos(shows, [{ youtubeId: 'b', title: 'Bel battles Quadra | BEYBLADE BURST QUADSTRIKE EP1 | Official Clip' }]);
      expect(result.get('b')).toMatchObject({ showKey: 'title:2', kind: MATCH_KIND.ORDER, episodeTitle: 'Bel battles Quadra' });
    });

    it('leaves a video no show matches out of the result', async () => {
      const result = await matchVideos(shows, [{ youtubeId: 'c', title: 'Find the ODD One Out' }]);
      expect(result.has('c')).toBe(false);
    });

    it('matches nothing without shows', async () => {
      expect((await matchVideos([], [{ youtubeId: 'd', title: 'x' }])).size).toBe(0);
    });

    it('numbers a year-season title episode from the video\'s upload year', async () => {
      const yearShows = [{
        key: 'title:3',
        excludeTerms: [],
        patterns: [pattern('Hermitcraft {episode}', { seasonSource: 'year', episodeSource: 'title' })],
      }];
      const result = await matchVideos(yearShows, [
        { youtubeId: 'e', title: 'Hermitcraft 12', uploadYear: 2024 },
        { youtubeId: 'f', title: 'Hermitcraft 13' },
      ]);
      expect(result.get('e')).toMatchObject({ kind: MATCH_KIND.NUMBERED, season: 2024, episode: 12 });
      expect(result.get('f')).toMatchObject({ kind: MATCH_KIND.PENDING, season: null, episode: 13 });
    });
  });
});
