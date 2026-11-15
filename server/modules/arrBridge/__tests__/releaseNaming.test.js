/* eslint-env jest */
const {
  DEFAULT_GROUP,
  seriesToken,
  groupToken,
  resolutionLabel,
  buildTvTitle,
  buildDailyTitle,
  buildMovieTitle,
  isValidReleaseTitle,
} = require('../releaseNaming');

describe('releaseNaming', () => {
  describe('seriesToken', () => {
    // The pairs Sonarr 4, Sonarr 5 and Radarr matched in the Phase 0 spike.
    test.each([
      ['Penn & Teller: Fool Us', 'Penn.Teller.Fool.Us'],
      ['9-1-1', '9.1.1'],
      ['The Office (US)', 'The.Office.US'],
      ['Marvel\'s Agents of S.H.I.E.L.D.', 'Marvels.Agents.of.S.H.I.E.L.D'],
      ['Shōgun', 'Shogun'],
      ['Kurzgesagt – In a Nutshell', 'Kurzgesagt.In.a.Nutshell'],
      ['Bluey (2018)', 'Bluey.2018'],
      ['Le Fabuleux Destin d’Amélie Poulain', 'Le.Fabuleux.Destin.dAmelie.Poulain'],
      ['  Money   Heist  ', 'Money.Heist'],
    ])('%s -> %s', (text, expected) => {
      expect(seriesToken(text)).toBe(expected);
    });

    test('keeps letters that have no unaccented form', () => {
      expect(seriesToken('進撃の巨人')).toBe('進撃の巨人');
      expect(seriesToken('ガンダム 00')).toBe('ガンダム.00');
      expect(seriesToken('Blå øyne')).toBe('Bla.øyne');
    });

    test('removes the word sample, which Sonarr rejects', () => {
      expect(seriesToken('My Sample Show')).toBe('My.Show');
    });

    test('returns an empty string when nothing usable is left', () => {
      expect(seriesToken('!!! ???')).toBe('');
      expect(seriesToken('')).toBe('');
      expect(seriesToken(undefined)).toBe('');
    });

    test('cuts a very long title at a word boundary', () => {
      const token = seriesToken('Word '.repeat(40));
      expect(token.length).toBeLessThanOrEqual(60);
      expect(token.endsWith('Word')).toBe(true);
    });
  });

  describe('groupToken', () => {
    test('reduces a channel name to letters and digits', () => {
      expect(groupToken('Penn & Teller', 'tv')).toBe('PennTeller');
      expect(groupToken('Last Week Tonight', 'tv')).toBe('LastWeekTonight');
      expect(groupToken('Café Müller', 'tv')).toBe('CafeMuller');
    });

    test('keeps an ordinary name that only resembles a short language code', () => {
      expect(groupToken('Engineering Explained', 'tv')).toBe('EngineeringExplained');
    });

    test.each([
      ['HDTV'],
      ['BluRay Vault'],
      ['YTGerman'],
      ['YT Spanish With Paul'],
      ['ENG'],
      ['12345'],
      [''],
      ['進撃の巨人'],
      ['Proper Films'],
      ['4K Relaxation'],
      ['Nature 1080p'],
      ['Sample Channel'],
    ])('falls back for a name Sonarr would misread: %s', (name) => {
      expect(groupToken(name, 'tv')).toBe(DEFAULT_GROUP);
    });

    test('falls back for edition words only on movies', () => {
      expect(groupToken('Remastered Classics', 'movie')).toBe(DEFAULT_GROUP);
      expect(groupToken('Remastered Classics', 'tv')).toBe('RemasteredClassics');
    });

    test('cuts a long name to 30 characters', () => {
      expect(groupToken('A'.repeat(50), 'tv')).toHaveLength(30);
    });

    test('falls back for a missing name', () => {
      expect(groupToken(null, 'tv')).toBe(DEFAULT_GROUP);
    });
  });

  describe('resolutionLabel', () => {
    test.each([
      ['2160', 2160],
      ['4320', 2160],
      ['1440', 1080],
      ['1080', 1080],
      ['720', 720],
      ['480', 480],
      ['360', 480],
      [undefined, 1080],
      ['best', 1080],
    ])('%s -> %s', (preferred, expected) => {
      expect(resolutionLabel(preferred)).toBe(expected);
    });
  });

  describe('buildTvTitle', () => {
    const base = { season: 1, episode: 2, resolution: 1080, group: 'NBC' };

    test('names the release from the title Sonarr sent', () => {
      expect(buildTvTitle({ ...base, text: 'The Office (US)', textSource: 'title' }))
        .toBe('The.Office.US.S01E02.1080p.WEB-DL-NBC');
    });

    test('adds the AKA form when only a cleaned q is known', () => {
      expect(buildTvTitle({ ...base, text: 'Office', textSource: 'q' }))
        .toBe('Office.AKA.The.Office.S01E02.1080p.WEB-DL-NBC');
    });

    test('skips the AKA form when q still starts with The', () => {
      expect(buildTvTitle({ ...base, text: 'The Office', textSource: 'q' }))
        .toBe('The.Office.S01E02.1080p.WEB-DL-NBC');
    });

    test('keeps year seasons and wide episode numbers', () => {
      expect(buildTvTitle({ ...base, text: 'MrBeast', textSource: 'title', season: 2024, episode: 5 }))
        .toBe('MrBeast.S2024E05.1080p.WEB-DL-NBC');
      expect(buildTvTitle({ ...base, text: 'Show', textSource: 'title', season: 0, episode: 105 }))
        .toBe('Show.S00E105.1080p.WEB-DL-NBC');
    });

    test('returns null when the series text has nothing usable', () => {
      expect(buildTvTitle({ ...base, text: '!!!', textSource: 'title' })).toBeNull();
    });

    test('returns null when the name would be too long for a folder', () => {
      const text = '進'.repeat(60);
      expect(buildTvTitle({ ...base, text, textSource: 'q' })).toBeNull();
    });
  });

  test('buildDailyTitle puts the air date where the episode goes', () => {
    expect(buildDailyTitle({
      text: 'Last Week Tonight with John Oliver',
      textSource: 'title',
      year: 2025,
      month: 2,
      day: 16,
      resolution: 1080,
      group: 'LastWeekTonight',
    })).toBe('Last.Week.Tonight.with.John.Oliver.2025.02.16.1080p.WEB-DL-LastWeekTonight');
  });

  test('buildDailyTitle returns null for unusable text', () => {
    expect(buildDailyTitle({
      text: '??', textSource: 'title', year: 2025, month: 2, day: 16, resolution: 1080, group: 'X',
    })).toBeNull();
  });

  describe('buildMovieTitle', () => {
    test('puts the year after the title', () => {
      expect(buildMovieTitle({ title: 'Blade Runner 2049', year: 2017, resolution: 2160, group: 'YOUTARR' }))
        .toBe('Blade.Runner.2049.2017.2160p.WEB-DL-YOUTARR');
    });

    test('never adds the AKA form', () => {
      expect(buildMovieTitle({ title: 'Matrix', year: 1999, resolution: 1080, group: 'YOUTARR' }))
        .toBe('Matrix.1999.1080p.WEB-DL-YOUTARR');
    });

    test('returns null for unusable text', () => {
      expect(buildMovieTitle({ title: '...', year: 1999, resolution: 1080, group: 'YOUTARR' })).toBeNull();
    });
  });

  describe('isValidReleaseTitle', () => {
    test('accepts a built title, with or without non-Latin letters', () => {
      expect(isValidReleaseTitle('The.Office.US.S01E02.1080p.WEB-DL-NBC')).toBe(true);
      expect(isValidReleaseTitle('進撃の巨人.S01E01.1080p.WEB-DL-YOUTARR')).toBe(true);
    });

    test.each([
      ['a/b'],
      ['..'],
      ['Show..S01E01'],
      ['Show.S01E01.'],
      [''],
      ['Show S01E01'],
      ['.Show.S01E01'],
      ['a'.repeat(300)],
      [null],
      [42],
    ])('rejects %p', (title) => {
      expect(isValidReleaseTitle(title)).toBe(false);
    });
  });
});
