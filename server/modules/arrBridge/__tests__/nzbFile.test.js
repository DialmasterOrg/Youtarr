/* eslint-env jest */
const {
  PLACEHOLDER_ID,
  validateGrabFields,
  buildNzbLink,
  parseNzbLink,
  buildNzb,
  parseNzb,
} = require('../nzbFile');

const TITLE = 'The.Office.US.S01E02.1080p.WEB-DL-NBC';
const fields = (overrides = {}) => ({
  youtubeId: 'abcdefghijk',
  kind: 'tv',
  releaseTitle: TITLE,
  uploadDate: new Date('2024-03-01T12:00:00.000Z'),
  estimatedBytes: 123456789,
  ...overrides,
});

describe('nzbFile', () => {
  describe('validateGrabFields', () => {
    const raw = (overrides = {}) => ({
      id: 'abcdefghijk', kind: 'tv', title: TITLE, date: '2024-03-01T12:00:00.000Z', size: '123456789', ...overrides,
    });

    test('returns the typed fields', () => {
      expect(validateGrabFields(raw())).toEqual(fields());
    });

    test('accepts a title built before the YT marker existed', () => {
      const title = 'Show.S01E05.1080p.WEB-DL-Chan';
      expect(validateGrabFields(raw({ title }))).toEqual(fields({ releaseTitle: title }));
    });

    test.each([
      ['a 12-character id', { id: 'abcdefghijkl' }],
      ['the placeholder id', { id: PLACEHOLDER_ID }],
      ['an id with a slash', { id: 'abc/efghijk' }],
      ['an unknown kind', { kind: 'music' }],
      ['a title that is a path', { title: '../../etc' }],
      ['a title with a space', { title: 'The Office' }],
      ['an unreadable date', { date: 'yesterday' }],
      ['a negative size', { size: '-1' }],
      ['a size that is not a number', { size: 'big' }],
      ['a missing id', { id: undefined }],
      ['an array for the id', { id: ['abcdefghijk'] }],
    ])('rejects %s', (_name, overrides) => {
      expect(validateGrabFields(raw(overrides))).toBeNull();
    });

    test('treats a missing size as unknown', () => {
      expect(validateGrabFields(raw({ size: undefined })).estimatedBytes).toBe(0);
    });

    test('rejects input that is not an object', () => {
      expect(validateGrabFields(null)).toBeNull();
    });
  });

  describe('carrier NZB', () => {
    test('round-trips every field', () => {
      expect(parseNzb(buildNzb(fields()))).toEqual(fields());
    });

    test('round-trips a title with non-Latin letters', () => {
      const title = '進撃の巨人.S01E01.1080p.WEB-DL-YOUTARR';
      expect(parseNzb(buildNzb(fields({ releaseTitle: title }))).releaseTitle).toBe(title);
    });

    test('is a well-formed NZB with one file and one segment', () => {
      const nzb = buildNzb(fields());
      expect(nzb).toContain('<nzb xmlns="http://www.newzbin.com/DTD/2003/nzb">');
      expect(nzb.match(/<file /g)).toHaveLength(1);
      expect(nzb.match(/<segment /g)).toHaveLength(1);
    });

    test('reads a Buffer as sent by an upload', () => {
      expect(parseNzb(Buffer.from(buildNzb(fields())))).toEqual(fields());
    });

    test.each([
      ['an NZB from somewhere else', '<?xml version="1.0"?><nzb><head><meta type="title">x</meta></head><file/></nzb>'],
      ['an empty string', ''],
      ['a number', 42],
      ['null', null],
    ])('returns null for %s', (_name, input) => {
      expect(parseNzb(input)).toBeNull();
    });

    test('returns null when a field was tampered with', () => {
      const tampered = buildNzb(fields()).replace('abcdefghijk</meta>', 'abcdefghijkl</meta>');
      expect(parseNzb(tampered)).toBeNull();
    });

    test('returns null for a document over the size limit', () => {
      const padded = buildNzb(fields()).replace('</nzb>', `<!-- ${'x'.repeat(70 * 1024)} --></nzb>`);
      expect(parseNzb(padded)).toBeNull();
    });
  });

  describe('NZB link', () => {
    test('carries every field and the key', () => {
      const link = buildNzbLink('http://youtarr:3011', fields(), 'secretkey');
      const url = new URL(link);
      expect(url.pathname).toBe(`/arr/newznab/nzb/${TITLE}.nzb`);
      expect(Object.fromEntries(url.searchParams)).toEqual({
        id: 'abcdefghijk',
        kind: 'tv',
        date: '2024-03-01T12:00:00.000Z',
        size: '123456789',
        apikey: 'secretkey',
      });
    });

    test('URL-encodes a title with non-Latin letters', () => {
      const link = buildNzbLink('http://youtarr:3011', fields({ releaseTitle: '進撃.S01E01.1080p.WEB-DL-X' }), 'k');
      expect(link).toContain('/nzb/%E9%80%B2%E6%92%83.S01E01.1080p.WEB-DL-X.nzb?');
    });

    test('parses back from the route parameter and query', () => {
      const link = new URL(buildNzbLink('http://youtarr:3011', fields(), 'k'));
      const fileParam = decodeURIComponent(link.pathname.split('/').pop());
      expect(parseNzbLink(fileParam, Object.fromEntries(link.searchParams))).toEqual(fields());
    });

    test('needs the .nzb suffix', () => {
      expect(parseNzbLink(TITLE, { id: 'abcdefghijk', kind: 'tv', date: '2024-03-01T12:00:00.000Z', size: '0' }))
        .toBeNull();
    });

    test('returns null for the placeholder link', () => {
      expect(parseNzbLink(`${TITLE}.nzb`, { id: PLACEHOLDER_ID, kind: 'tv', date: '2020-01-01T00:00:00.000Z' }))
        .toBeNull();
    });
  });
});
