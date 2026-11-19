jest.mock('../../../logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const fs = require('fs');
const os = require('os');
const path = require('path');
const tvNfo = require('../tvNfo');

const INFO = {
  id: 'abcdefghijk',
  title: 'Big Build & More',
  description: 'We built <things>.',
  upload_date: '20240315',
  duration: 125,
  uploader: 'Mark Rober',
  categories: ['Science & Technology'],
  tags: ['engineering'],
  normalized_rating: 'TV-PG',
};

describe('tvNfo', () => {
  describe('buildEpisodeNfo', () => {
    const xml = tvNfo.buildEpisodeNfo({
      info: INFO, showTitle: 'Mark Rober', season: 2024, episode: 3151200, episodeTitle: 'Big Build & More',
    });

    it('uses an episodedetails root', () => {
      expect(xml).toMatch(/<episodedetails>[\s\S]*<\/episodedetails>\n$/);
    });

    it('writes the season and episode as plain integers', () => {
      expect(xml).toContain('<season>2024</season>');
      expect(xml).toContain('<episode>3151200</episode>');
    });

    it('escapes the episode title and show title', () => {
      expect(xml).toContain('<title>Big Build &amp; More</title>');
      expect(xml).toContain('<showtitle>Mark Rober</showtitle>');
    });

    it('writes aired and premiered as dates without a time', () => {
      expect(xml).toContain('<aired>2024-03-15</aired>');
      expect(xml).toContain('<premiered>2024-03-15</premiered>');
    });

    it('identifies the video by its YouTube id', () => {
      expect(xml).toContain('<uniqueid type="youtube" default="true">abcdefghijk</uniqueid>');
    });

    it('writes runtime, studio, genres, tags and rating', () => {
      expect(xml).toContain('<runtime>3</runtime>');
      expect(xml).toContain('<studio>Mark Rober</studio>');
      expect(xml).toContain('<genre>Science &amp; Technology</genre>');
      expect(xml).toContain('<tag>engineering</tag>');
      expect(xml).toContain('<mpaa>TV-PG</mpaa>');
    });

    it('never writes lockdata, dateadded or artwork paths', () => {
      expect(xml).not.toMatch(/<lockdata>|<dateadded>|<thumb>|<fanart>/);
    });
  });

  describe('buildTvShowNfo', () => {
    const xml = tvNfo.buildTvShowNfo({
      title: 'Mark Rober', plot: 'Engineering videos', premiered: '2016-01-20', externalKey: 'UC123',
    });

    it('carries the external key as both the YouTube id and a custom id', () => {
      expect(xml).toContain('<uniqueid type="youtube" default="true">UC123</uniqueid>');
      expect(xml).toContain('<uniqueid type="custom">UC123</uniqueid>');
    });

    it('writes title, plot, premiered and studio', () => {
      expect(xml).toMatch(/<tvshow>[\s\S]*<title>Mark Rober<\/title>/);
      expect(xml).toContain('<plot>Engineering videos</plot>');
      expect(xml).toContain('<premiered>2016-01-20</premiered>');
      expect(xml).toContain('<studio>YouTube</studio>');
    });

    it('leaves out an empty plot and premiered', () => {
      const bare = tvNfo.buildTvShowNfo({ title: 'X', externalKey: 'UC1' });
      expect(bare).not.toMatch(/<plot>|<premiered>/);
    });

    it('identifies a title show by its Youtarr key', () => {
      const titleShow = tvNfo.buildTvShowNfo({ title: 'Beyblade', externalKey: 'uuid-1', idType: 'youtarr' });
      expect(titleShow).toContain('<uniqueid type="youtarr" default="true">uuid-1</uniqueid>');
      expect(titleShow).not.toContain('type="youtube"');
    });

    it('names seasons in order', () => {
      const named = tvNfo.buildTvShowNfo({ title: 'Beyblade', externalKey: 'k', namedSeasons: { 2: 'V-Force', 1: 'Beyblade & Co' } });
      expect(named).toContain('  <namedseason number="1">Beyblade &amp; Co</namedseason>\n  <namedseason number="2">V-Force</namedseason>');
    });
  });

  describe('buildSeasonNfo', () => {
    it('writes the season name and number', () => {
      const xml = tvNfo.buildSeasonNfo({ season: 2, name: 'V-Force' });
      expect(xml).toMatch(/<season>\s*<title>V-Force<\/title>\s*<seasonnumber>2<\/seasonnumber>\s*<\/season>/);
    });
  });

  describe('writeSeasonNfo', () => {
    let tmpDir;
    beforeEach(() => { tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tvnfo-season-')); });
    afterEach(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

    it('writes season.nfo for a named season', async () => {
      await tvNfo.writeSeasonNfo(tmpDir, { season: 1, name: 'Beyblade' });
      expect(fs.readFileSync(path.join(tmpDir, 'season.nfo'), 'utf8')).toContain('<title>Beyblade</title>');
    });

    it('removes Youtarr\'s season.nfo when the season has no name', async () => {
      await tvNfo.writeSeasonNfo(tmpDir, { season: 1, name: 'Beyblade' });
      await tvNfo.writeSeasonNfo(tmpDir, { season: 1, name: null });
      expect(fs.existsSync(path.join(tmpDir, 'season.nfo'))).toBe(false);
    });

    it('leaves a season.nfo Youtarr didn\'t write', async () => {
      fs.writeFileSync(path.join(tmpDir, 'season.nfo'), '<season><title>Mine</title></season>');
      await tvNfo.writeSeasonNfo(tmpDir, { season: 1, name: null });
      expect(fs.existsSync(path.join(tmpDir, 'season.nfo'))).toBe(true);
    });
  });

  describe('dateFromEpisodeCode', () => {
    it('reads the date of a date-numbered episode, including bumped numbers', () => {
      expect(tvNfo.dateFromEpisodeCode(2024, 1151260)).toBe('2024-01-15');
    });

    it('returns null for numbers that are not a date', () => {
      expect(tvNfo.dateFromEpisodeCode(1, 20)).toBeNull();
    });
  });

  describe('writeTvShowNfoIfChanged', () => {
    let dir;
    beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tvnfo-')); });
    afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

    const params = { title: 'Mark Rober', externalKey: 'UC123' };

    it('writes tvshow.nfo when it is missing', async () => {
      await expect(tvNfo.writeTvShowNfoIfChanged(dir, params)).resolves.toBe(true);
      expect(fs.readFileSync(path.join(dir, 'tvshow.nfo'), 'utf8')).toContain('<title>Mark Rober</title>');
    });

    it('leaves an unchanged tvshow.nfo alone', async () => {
      await tvNfo.writeTvShowNfoIfChanged(dir, params);
      await expect(tvNfo.writeTvShowNfoIfChanged(dir, params)).resolves.toBe(false);
    });

    it('rewrites tvshow.nfo when a value changes', async () => {
      await tvNfo.writeTvShowNfoIfChanged(dir, params);
      await expect(tvNfo.writeTvShowNfoIfChanged(dir, { ...params, title: 'Mark Rober 2' })).resolves.toBe(true);
    });
  });
});
