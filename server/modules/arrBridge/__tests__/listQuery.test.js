/* eslint-env jest */
const { readListQuery, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } = require('../listQuery');

describe('readListQuery', () => {
  test('reads the first page of the default size when nothing is asked', () => {
    expect(readListQuery()).toEqual({ page: 1, pageSize: DEFAULT_PAGE_SIZE, offset: 0, patterns: [] });
  });

  test('turns a page into the rows to skip', () => {
    expect(readListQuery({ page: '3', pageSize: '25' })).toMatchObject({ page: 3, pageSize: 25, offset: 50 });
  });

  test.each([
    [undefined, 1], ['abc', 1], ['0', 1], ['-2', 1], ['2.9', 2], [['4'], 1], ['999999999999999999999', 100000],
  ])('a page of %p reads as %p', (page, expected) => {
    expect(readListQuery({ page }).page).toBe(expected);
  });

  test.each([
    [undefined, DEFAULT_PAGE_SIZE], ['abc', DEFAULT_PAGE_SIZE], ['0', DEFAULT_PAGE_SIZE], ['7', 7], ['500', MAX_PAGE_SIZE],
  ])('a page size of %p reads as %p', (pageSize, expected) => {
    expect(readListQuery({ pageSize }).pageSize).toBe(expected);
  });

  test('makes one pattern per word of the search text', () => {
    expect(readListQuery({ q: '  Beyblade   s01e29 ' }).patterns).toEqual(['%Beyblade%', '%s01e29%']);
  });

  test('escapes what LIKE would read as a wildcard', () => {
    expect(readListQuery({ q: '100%_done\\' }).patterns).toEqual(['%100\\%\\_done\\\\%']);
  });

  test('reads text that is not a string as no search', () => {
    expect(readListQuery({ q: ['a', 'b'] }).patterns).toEqual([]);
  });

  test('cuts overlong text and keeps only the first words', () => {
    const { patterns } = readListQuery({ q: `one two three four five six ${'x'.repeat(200)}` });

    expect(patterns).toEqual(['%one%', '%two%', '%three%', '%four%', '%five%']);
    expect(readListQuery({ q: 'y'.repeat(500) }).patterns[0]).toHaveLength(102);
  });
});
