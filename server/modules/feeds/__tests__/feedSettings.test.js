/* eslint-env jest */
const {
  DEFAULT_ITEM_LIMIT,
  MEDIA_TYPES,
  normalizeItemLimit,
  normalizeMediaTypes,
  getItemLimitError,
  getMediaTypesError,
} = require('../feedSettings');

describe('normalizeItemLimit', () => {
  test('keeps a whole number inside the limits', () => {
    expect(normalizeItemLimit(75)).toBe(75);
  });

  test('reads a hand-edited number written as text', () => {
    expect(normalizeItemLimit('100')).toBe(100);
  });

  test('raises a number below the minimum', () => {
    expect(normalizeItemLimit(1)).toBe(10);
  });

  test('lowers a number above the maximum', () => {
    expect(normalizeItemLimit(5000)).toBe(200);
  });

  test.each([undefined, null, '', 'lots', 1.5, {}, []])('uses the default for %p', (value) => {
    expect(normalizeItemLimit(value)).toBe(DEFAULT_ITEM_LIMIT);
  });
});

describe('normalizeMediaTypes', () => {
  test('keeps known types in the standard order', () => {
    expect(normalizeMediaTypes(['livestream', 'video'])).toEqual(['video', 'livestream']);
  });

  test('removes unknown types and repeats', () => {
    expect(normalizeMediaTypes(['short', 'podcast', 'short'])).toEqual(['short']);
  });

  test.each([undefined, null, 'video', [], ['podcast']])('uses every type for %p', (value) => {
    expect(normalizeMediaTypes(value)).toEqual(MEDIA_TYPES);
  });

  test('returns a copy, so changing the result cannot change the defaults', () => {
    normalizeMediaTypes(undefined).pop();

    expect(MEDIA_TYPES).toHaveLength(3);
  });
});

describe('getItemLimitError', () => {
  test.each([10, 50, 200])('accepts %p', (value) => {
    expect(getItemLimitError(value)).toBeNull();
  });

  test.each([9, 201, 1.5, '50', null])('rejects %p', (value) => {
    expect(getItemLimitError(value)).toMatch(/whole number from 10 to 200/);
  });
});

describe('getMediaTypesError', () => {
  test.each([[['video']], [['video', 'short', 'livestream']]])('accepts %j', (value) => {
    expect(getMediaTypesError(value)).toBeNull();
  });

  test('rejects an empty list', () => {
    expect(getMediaTypesError([])).toMatch(/at least one/);
  });

  test.each([[['podcast']], ['video'], [null]])('rejects %j', (value) => {
    expect(getMediaTypesError(value)).toMatch(/video, short or livestream/);
  });
});
