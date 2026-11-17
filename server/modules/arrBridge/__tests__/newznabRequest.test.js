/* eslint-env jest */
const { parseNewznabRequest } = require('../newznabRequest');

const SONARR_CATS = '5030,5040';
const RADARR_CATS = '2000,2010,2020,2030,2040,2045,2050,2060';
// What every observed request also carries.
const common = { extended: '1', apikey: 'k', offset: '0', limit: '100' };

function parse(query) {
  const result = parseNewznabRequest({ ...common, ...query });
  expect(result.ok).toBe(true);
  return result.request;
}

describe('parseNewznabRequest', () => {
  describe('observed Sonarr and Radarr requests', () => {
    test('an episode search with the raw title parameter', () => {
      const request = parse({ t: 'tvsearch', cat: SONARR_CATS, title: 'The Office (US)', season: '1', ep: '2' });
      expect(request).toMatchObject({
        shape: 'episode', kind: 'tv', text: 'The Office (US)', textSource: 'title', season: 1, episode: 2, limit: 100,
      });
    });

    test('an episode search with only a cleaned q', () => {
      const request = parse({ t: 'tvsearch', cat: SONARR_CATS, q: 'Office US', season: '1', ep: '2' });
      expect(request).toMatchObject({ shape: 'episode', text: 'Office US', textSource: 'q' });
    });

    test('title wins when both title and q are sent', () => {
      const request = parse({ t: 'tvsearch', cat: SONARR_CATS, q: 'Office', title: 'The Office', season: '1', ep: '2' });
      expect(request).toMatchObject({ text: 'The Office', textSource: 'title' });
    });

    test('a season search', () => {
      const request = parse({ t: 'tvsearch', cat: SONARR_CATS, title: 'Bluey (2018)', season: '3' });
      expect(request).toMatchObject({ shape: 'season', season: 3, episode: null });
    });

    test('a daily search', () => {
      const request = parse({ t: 'tvsearch', cat: SONARR_CATS, title: 'Last Week Tonight', season: '2025', ep: '02/16' });
      expect(request).toMatchObject({ shape: 'daily', year: 2025, month: 2, day: 16 });
    });

    test('a special arrives as season 00', () => {
      const request = parse({ t: 'tvsearch', cat: SONARR_CATS, title: 'Shōgun', season: '00', ep: '1' });
      expect(request).toMatchObject({ shape: 'episode', season: 0, episode: 1 });
    });

    test('the text search Sonarr sends for specials answers empty', () => {
      const request = parse({ t: 'search', cat: SONARR_CATS, q: 'Shogun 2024 Making of Shogun First Look' });
      expect(request.shape).toBe('empty');
    });

    test('RSS sync from Sonarr', () => {
      expect(parse({ t: 'tvsearch', cat: SONARR_CATS })).toMatchObject({ shape: 'rss', kind: 'tv' });
    });

    test('RSS sync from Radarr', () => {
      expect(parse({ t: 'movie', cat: RADARR_CATS })).toMatchObject({ shape: 'rss', kind: 'movie' });
    });

    test('a movie search splits the trailing year off q', () => {
      const request = parse({ t: 'search', cat: RADARR_CATS, q: 'Matrix 1999' });
      expect(request).toMatchObject({ shape: 'movie', kind: 'movie', text: 'Matrix', year: 1999 });
    });

    test('a movie whose title ends in a number keeps it', () => {
      const request = parse({ t: 'search', cat: RADARR_CATS, q: 'Blade Runner 2049 2017' });
      expect(request).toMatchObject({ text: 'Blade Runner 2049', year: 2017 });
    });
  });

  describe('requests that answer empty without a search', () => {
    test.each([
      ['a movie search without a year', { t: 'search', cat: RADARR_CATS, q: 'Matrix' }],
      ['a movie search that is only a year', { t: 'search', cat: RADARR_CATS, q: '1917' }],
      ['season and episode without text (Prowlarr)', { t: 'tvsearch', cat: SONARR_CATS, season: '1', ep: '1' }],
      ['a year-season request', { t: 'tvsearch', cat: SONARR_CATS, title: 'Last Week Tonight', season: '2025' }],
      ['TV text without a season', { t: 'tvsearch', cat: SONARR_CATS, q: 'Bluey' }],
      ['an episode without a season', { t: 'tvsearch', cat: SONARR_CATS, q: 'Bluey', ep: '3' }],
      ['a text search with no categories', { t: 'search', q: 'anything' }],
      ['a later page', { t: 'tvsearch', cat: SONARR_CATS, title: 'Bluey', season: '1', ep: '1', offset: '100' }],
      ['a later RSS page', { t: 'tvsearch', cat: SONARR_CATS, offset: '100' }],
      ['an impossible daily date', { t: 'tvsearch', cat: SONARR_CATS, title: 'Show', season: '2025', ep: '13/40' }],
    ])('%s', (_name, query) => {
      expect(parse(query).shape).toBe('empty');
    });

    test.each([
      ['movie-without-year', { t: 'search', cat: RADARR_CATS, q: 'Matrix' }],
      ['no-text', { t: 'tvsearch', cat: SONARR_CATS, season: '1', ep: '1' }],
      ['year-season', { t: 'tvsearch', cat: SONARR_CATS, title: 'Last Week Tonight', season: '2025' }],
      ['no-season', { t: 'tvsearch', cat: SONARR_CATS, q: 'Bluey' }],
      ['no-season', { t: 'search', cat: SONARR_CATS, q: 'Shogun 2024 Making of Shogun First Look' }],
      ['unknown-kind', { t: 'search', q: 'anything' }],
      ['later-page', { t: 'tvsearch', cat: SONARR_CATS, title: 'Bluey', season: '1', ep: '1', offset: '100' }],
      ['invalid-date', { t: 'tvsearch', cat: SONARR_CATS, title: 'Show', season: '2025', ep: '13/40' }],
    ])('says why: %s', (reason, query) => {
      expect(parse(query).emptyReason).toBe(reason);
    });

    test('a request that is searched carries no reason', () => {
      expect(parse({ t: 'tvsearch', cat: SONARR_CATS, title: 'Bluey', season: '1', ep: '1' }).emptyReason).toBeNull();
      expect(parse({ t: 'tvsearch', cat: SONARR_CATS }).emptyReason).toBeNull();
    });
  });

  test('a no-query request without categories is RSS with no kind (Prowlarr Test)', () => {
    expect(parse({ t: 'search' })).toMatchObject({ shape: 'rss', kind: null });
  });

  test('caps needs nothing else', () => {
    expect(parseNewznabRequest({ t: 'caps' })).toEqual({ ok: true, request: expect.objectContaining({ shape: 'caps' }) });
  });

  test('limit defaults to 50 and is clamped to 100', () => {
    expect(parseNewznabRequest({ t: 'tvsearch' }).request.limit).toBe(50);
    expect(parse({ t: 'tvsearch', limit: '500' }).limit).toBe(100);
    expect(parse({ t: 'tvsearch', limit: '0' }).limit).toBe(1);
  });

  test('trims the text', () => {
    expect(parse({ t: 'tvsearch', cat: SONARR_CATS, q: '  Bluey  ', season: '1', ep: '1' }).text).toBe('Bluey');
  });

  describe('invalid requests', () => {
    test('an unknown function is error 202', () => {
      expect(parseNewznabRequest({ t: 'details' })).toEqual({ ok: false, code: 202, description: 'No such function' });
    });

    test('a missing function is error 200', () => {
      expect(parseNewznabRequest({})).toMatchObject({ ok: false, code: 200 });
    });

    test.each([
      ['a repeated q', { t: 'tvsearch', q: ['a', 'b'] }],
      ['an object for cat', { t: 'tvsearch', cat: { x: '1' } }],
      ['an array for season', { t: 'tvsearch', season: ['1'] }],
      ['an array for t', { t: ['tvsearch'] }],
      ['text over 200 characters', { t: 'tvsearch', q: 'a'.repeat(201) }],
      ['a category that is not a number', { t: 'tvsearch', cat: '5030,abc' }],
      ['more than 50 categories', { t: 'tvsearch', cat: Array.from({ length: 51 }, () => '5030').join(',') }],
      ['a season that is not a number', { t: 'tvsearch', q: 'x', season: 'one' }],
      ['a five-digit season', { t: 'tvsearch', q: 'x', season: '12345' }],
      ['an episode that is not a number or a date', { t: 'tvsearch', q: 'x', season: '1', ep: '1-2' }],
      ['a limit that is not a number', { t: 'tvsearch', limit: 'many' }],
      ['a negative offset', { t: 'tvsearch', offset: '-1' }],
    ])('%s is error 201', (_name, query) => {
      expect(parseNewznabRequest(query)).toMatchObject({ ok: false, code: 201 });
    });

    test('a query that is not an object is rejected', () => {
      expect(parseNewznabRequest(null)).toMatchObject({ ok: false });
    });
  });
});
