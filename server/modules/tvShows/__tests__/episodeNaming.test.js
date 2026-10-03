const { seasonFolderName, episodeCode, buildEpisodeStem, episodeFileName, EPISODE_TITLE_MAX_BYTES } = require('../episodeNaming');
const { SEASON_FOLDER_PATTERN } = require('../../filesystem/constants');

describe('episodeNaming', () => {
  describe('seasonFolderName', () => {
    it.each([
      [0, 'Season 00'],
      [1, 'Season 01'],
      [12, 'Season 12'],
      [150, 'Season 150'],
      [2024, 'Season 2024'],
    ])('names season %i "%s"', (season, expected) => {
      expect(seasonFolderName(season)).toBe(expected);
    });

    it('produces names the cleanup recognizes as season folders', () => {
      expect([0, 7, 2024].map(seasonFolderName).every((name) => SEASON_FOLDER_PATTERN.test(name))).toBe(true);
    });

    it.each([[-1], [1.5], [NaN], ['1']])('rejects %p', (season) => {
      expect(() => seasonFolderName(season)).toThrow(TypeError);
    });
  });

  describe('episodeCode', () => {
    it('pads date-numbered episodes to 8 digits', () => {
      expect(episodeCode({ season: 2024, episode: 1151200, dateNumbered: true })).toBe('S2024E01151200');
    });

    it('keeps 8 digits for a December date', () => {
      expect(episodeCode({ season: 2024, episode: 12312359, dateNumbered: true })).toBe('S2024E12312359');
    });

    it('pads title and order numbers to 2 digits', () => {
      expect(episodeCode({ season: 1, episode: 5 })).toBe('S01E05');
    });

    it('does not cut numbers wider than the padding', () => {
      expect(episodeCode({ season: 3, episode: 120 })).toBe('S03E120');
    });

    it('writes season 0 as S00', () => {
      expect(episodeCode({ season: 0, episode: 3 })).toBe('S00E03');
    });

    it('rejects a missing episode number', () => {
      expect(() => episodeCode({ season: 1 })).toThrow(TypeError);
    });
  });

  describe('buildEpisodeStem', () => {
    const base = { season: 1, episode: 20, youtubeId: 'y7xVT7DTt2k' };

    it('puts the episode code first and the video id last', () => {
      expect(buildEpisodeStem({ ...base, episodeTitle: 'It\'s All Relative' }))
        .toBe('S01E20 - It\'s All Relative [y7xVT7DTt2k]');
    });

    it('uses the date-numbered code for date shows', () => {
      expect(buildEpisodeStem({ season: 2024, episode: 3151200, dateNumbered: true, videoTitle: 'Vlog', youtubeId: 'abcdefghijk' }))
        .toBe('S2024E03151200 - Vlog [abcdefghijk]');
    });

    it('falls back to the video title when the episode title is empty', () => {
      expect(buildEpisodeStem({ ...base, episodeTitle: '   ', videoTitle: 'BEYBLADE EN Episode 20: It\'s All Relative' }))
        .toBe('S01E20 - BEYBLADE EN Episode 20： It\'s All Relative [y7xVT7DTt2k]');
    });

    it('trims whitespace around a captured title', () => {
      expect(buildEpisodeStem({ ...base, episodeTitle: '  Under the Microscope ' }))
        .toBe('S01E20 - Under the Microscope [y7xVT7DTt2k]');
    });

    it('sanitizes the title like a yt-dlp title field', () => {
      expect(buildEpisodeStem({ ...base, episodeTitle: 'AC/DC: Live? 12:30' }))
        .toBe('S01E20 - AC⧸DC： Live？ 12_30 [y7xVT7DTt2k]');
    });

    it(`cuts the title to ${EPISODE_TITLE_MAX_BYTES} bytes`, () => {
      const stem = buildEpisodeStem({ ...base, episodeTitle: 'あ'.repeat(40) });
      const title = stem.slice('S01E20 - '.length, -' [y7xVT7DTt2k]'.length);
      expect({ bytes: Buffer.byteLength(title, 'utf8'), title }).toEqual({ bytes: 63, title: 'あ'.repeat(21) });
    });

    it('omits the title separator when there is no title at all', () => {
      expect(buildEpisodeStem({ ...base })).toBe('S01E20 [y7xVT7DTt2k]');
    });

    it('rejects a value that is not a video id', () => {
      expect(() => buildEpisodeStem({ ...base, youtubeId: '../escape' })).toThrow(TypeError);
    });
  });

  describe('episodeFileName', () => {
    const id = 'abcdefghijk';
    const stem = `S2024E03151200 - Big Build [${id}]`;

    it.each([
      [`Mark Rober - Big Build [${id}].mp4`, `${stem}.mp4`],
      [`Mark Rober - Big Build [${id}].en.srt`, `${stem}.en.srt`],
      [`Mark Rober - Big Build [${id}]-fanart.jpg`, `${stem}-fanart.jpg`],
      [`._Mark Rober - Big Build [${id}].mp4`, `._${stem}.mp4`],
    ])('renames %s', (fileName, expected) => {
      expect(episodeFileName(fileName, id, stem)).toBe(expected);
    });
  });
});
