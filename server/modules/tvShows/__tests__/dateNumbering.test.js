const {
  releaseTime,
  dateEpisodeFor,
  allocateEpisode,
  parseDateEpisodeCode,
  assignDateEpisodes
} = require('../dateNumbering');
const { buildEpisodeStem } = require('../episodeNaming');

const epoch = (iso) => Date.parse(iso) / 1000;

describe('dateNumbering', () => {
  describe('releaseTime', () => {
    it('prefers the exact timestamp', () => {
      expect(releaseTime({ timestamp: 1114313460, upload_date: '20050424' }))
        .toEqual({ epochSeconds: 1114313460, source: 'timestamp' });
    });

    it('falls back to the upload date at 00:00 UTC', () => {
      expect(releaseTime({ upload_date: '20240315' }))
        .toEqual({ epochSeconds: epoch('2024-03-15T00:00:00Z'), source: 'upload_date' });
    });

    it.each([
      ['no info', null],
      ['neither field', { title: 'x' }],
      ['a malformed upload date', { upload_date: '2024-03-15' }],
      ['an impossible upload date', { upload_date: '20240231' }],
    ])('returns null for %s', (_label, info) => {
      expect(releaseTime(info)).toBeNull();
    });
  });

  describe('dateEpisodeFor', () => {
    it('numbers by UTC year and MMDDHHMM', () => {
      expect(dateEpisodeFor(epoch('2024-03-15T12:00:00Z'))).toEqual({ season: 2024, episode: 3151200 });
    });

    it('uses UTC, not local time, at a year boundary', () => {
      expect(dateEpisodeFor(epoch('2024-12-31T23:59:59Z'))).toEqual({ season: 2024, episode: 12312359 });
    });

    it('matches the "Plex TV Series" preset for the first YouTube video', () => {
      expect(dateEpisodeFor(1114313460)).toEqual({ season: 2005, episode: 4240331 });
    });
  });

  describe('allocateEpisode', () => {
    it('keeps a free number', () => {
      expect(allocateEpisode(1151200, new Set())).toBe(1151200);
    });

    it('bumps past taken numbers to the next free integer', () => {
      expect(allocateEpisode(1151200, new Set([1151200, 1151201]))).toBe(1151202);
    });

    it('stops after a bounded number of bumps', () => {
      expect(() => allocateEpisode(1, { has: () => true })).toThrow('No free episode number');
    });
  });

  describe('parseDateEpisodeCode', () => {
    it('reads a "Plex TV Series" preset filename', () => {
      expect(parseDateEpisodeCode('S2019E04050000 Video Title [abcdefghijk].mp4'))
        .toEqual({ season: 2019, episode: 4050000 });
    });

    it('reads a date-numbered TV layout filename', () => {
      expect(parseDateEpisodeCode('S2024E12312359 - Title [abcdefghijk].mp4'))
        .toEqual({ season: 2024, episode: 12312359 });
    });

    it('reads back a number bumped past minute 59 from the name Youtarr built for it', () => {
      const episode = allocateEpisode(1151259, new Set([1151259]));
      const stem = buildEpisodeStem({ season: 2024, episode, dateNumbered: true, videoTitle: 'Second upload', youtubeId: 'abcdefghijk' });
      expect({ stem, parsed: parseDateEpisodeCode(`${stem}.mp4`) }).toEqual({
        stem: 'S2024E01151260 - Second upload [abcdefghijk]',
        parsed: { season: 2024, episode: 1151260 }
      });
    });

    it('reads back the 61st same-day video numbered from an upload date', () => {
      const { assigned } = assignDateEpisodes(Array.from({ length: 61 }, (_unused, index) => ({
        youtubeId: `vid${String(index).padStart(8, '0')}`,
        info: { upload_date: '20220617' }
      })));
      const last = assigned[assigned.length - 1];
      const stem = buildEpisodeStem({ ...last, dateNumbered: true, videoTitle: 'T' });
      expect({ episode: last.episode, parsed: parseDateEpisodeCode(stem) })
        .toEqual({ episode: 6170060, parsed: { season: 2022, episode: 6170060 } });
    });

    it.each([
      ['a title-numbered name', 'S01E20 - Title [abcdefghijk].mp4'],
      ['a movie-style name', 'Channel - Title [abcdefghijk].mp4'],
      ['too few digits', 'S2024E0115120 Title [abcdefghijk].mp4'],
      ['too many digits', 'S2024E011512001 Title [abcdefghijk].mp4'],
    ])('ignores %s', (_label, fileName) => {
      expect(parseDateEpisodeCode(fileName)).toBeNull();
    });
  });

  describe('assignDateEpisodes', () => {
    const at = (iso) => ({ timestamp: epoch(iso) });
    const numbersOf = (result) => Object.fromEntries(
      result.assigned.map(({ youtubeId, season, episode, source }) => [youtubeId, `${season}/${episode}/${source}`])
    );

    it('numbers videos from their upload time', () => {
      const result = assignDateEpisodes([{ youtubeId: 'aaaaaaaaaaa', info: at('2024-01-15T12:00:00Z') }]);
      expect(result).toEqual({
        assigned: [{ youtubeId: 'aaaaaaaaaaa', season: 2024, episode: 1151200, source: 'date', timestampSource: 'timestamp' }],
        unnumbered: []
      });
    });

    it('bumps the later of two uploads in the same minute', () => {
      const result = assignDateEpisodes([
        { youtubeId: 'bbbbbbbbbbb', info: at('2024-01-15T12:00:50Z') },
        { youtubeId: 'aaaaaaaaaaa', info: at('2024-01-15T12:00:10Z') },
      ]);
      expect(numbersOf(result)).toEqual({
        aaaaaaaaaaa: '2024/1151200/date',
        bbbbbbbbbbb: '2024/1151201/date'
      });
    });

    it('orders same-day uploads that only have an upload date by video id', () => {
      const result = assignDateEpisodes([
        { youtubeId: 'ccccccccccc', info: { upload_date: '20220617' } },
        { youtubeId: 'Bbbbbbbbbbb', info: { upload_date: '20220617' } },
        { youtubeId: 'aaaaaaaaaaa', info: { upload_date: '20220617' } },
      ]);
      expect(result.assigned.map(({ youtubeId, episode, timestampSource }) => [youtubeId, episode, timestampSource]))
        .toEqual([
          ['Bbbbbbbbbbb', 6170000, 'upload_date'],
          ['aaaaaaaaaaa', 6170001, 'upload_date'],
          ['ccccccccccc', 6170002, 'upload_date'],
        ]);
    });

    it('never reuses a number the show already holds', () => {
      const result = assignDateEpisodes(
        [{ youtubeId: 'aaaaaaaaaaa', info: at('2024-01-15T12:00:00Z') }],
        new Map([[2024, [1151200]]])
      );
      expect(numbersOf(result)).toEqual({ aaaaaaaaaaa: '2024/1151201/date' });
    });

    it('does not modify the numbers passed in', () => {
      const taken = new Map([[2024, new Set([1151200])]]);
      assignDateEpisodes([{ youtubeId: 'aaaaaaaaaaa', info: at('2024-01-15T12:00:00Z') }], taken);
      expect([...taken.get(2024)]).toEqual([1151200]);
    });

    it('adopts a preset code that is free', () => {
      const result = assignDateEpisodes([
        { youtubeId: 'aaaaaaaaaaa', info: at('2019-04-05T00:00:00Z'), adoptedCode: { season: 2019, episode: 4050000 } },
      ]);
      expect(numbersOf(result)).toEqual({ aaaaaaaaaaa: '2019/4050000/adopted' });
    });

    it('keeps adopted codes ahead of new date numbers that would collide', () => {
      const result = assignDateEpisodes([
        { youtubeId: 'zzzzzzzzzzz', info: at('2019-04-05T00:00:00Z') },
        { youtubeId: 'aaaaaaaaaaa', info: at('2019-04-05T00:00:30Z'), adoptedCode: { season: 2019, episode: 4050000 } },
      ]);
      expect(numbersOf(result)).toEqual({
        aaaaaaaaaaa: '2019/4050000/adopted',
        zzzzzzzzzzz: '2019/4050001/date'
      });
    });

    it('lets the earlier upload keep a shared preset code and bumps the later one', () => {
      const result = assignDateEpisodes([
        { youtubeId: 'aaaaaaaaaaa', info: at('2019-04-05T00:00:40Z'), adoptedCode: { season: 2019, episode: 4050000 } },
        { youtubeId: 'bbbbbbbbbbb', info: at('2019-04-05T00:00:20Z'), adoptedCode: { season: 2019, episode: 4050000 } },
      ]);
      expect(numbersOf(result)).toEqual({
        bbbbbbbbbbb: '2019/4050000/adopted',
        aaaaaaaaaaa: '2019/4050001/date'
      });
    });

    it('bumps a displaced adopted code from the code, not from an upload date at midnight', () => {
      const result = assignDateEpisodes([
        { youtubeId: 'aaaaaaaaaaa', info: { upload_date: '20190405' }, adoptedCode: { season: 2019, episode: 4051530 } },
        { youtubeId: 'bbbbbbbbbbb', info: { upload_date: '20190405' }, adoptedCode: { season: 2019, episode: 4051530 } },
      ]);
      expect(numbersOf(result)).toEqual({
        aaaaaaaaaaa: '2019/4051530/adopted',
        bbbbbbbbbbb: '2019/4051531/date'
      });
    });

    it('bumps a colliding adopted code that has no release time from the code itself', () => {
      const result = assignDateEpisodes([
        { youtubeId: 'aaaaaaaaaaa', info: {}, adoptedCode: { season: 2019, episode: 4050000 } },
        { youtubeId: 'bbbbbbbbbbb', info: {}, adoptedCode: { season: 2019, episode: 4050000 } },
      ]);
      expect(numbersOf(result)).toEqual({
        aaaaaaaaaaa: '2019/4050000/adopted',
        bbbbbbbbbbb: '2019/4050001/date'
      });
    });

    it('reports videos it cannot number', () => {
      const result = assignDateEpisodes([{ youtubeId: 'aaaaaaaaaaa', info: { title: 'no dates' } }]);
      expect(result).toEqual({ assigned: [], unnumbered: ['aaaaaaaaaaa'] });
    });
  });
});
