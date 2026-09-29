/* eslint-env jest */

const { parseAdditionalTags } = require('../additionalTags');

describe('parseAdditionalTags', () => {
  test('returns an empty array for null, undefined, and empty string', () => {
    expect(parseAdditionalTags(null)).toEqual([]);
    expect(parseAdditionalTags(undefined)).toEqual([]);
    expect(parseAdditionalTags('')).toEqual([]);
  });

  test('splits on pipes, trims each tag, and preserves order', () => {
    expect(parseAdditionalTags('tag1|tag2|tag3')).toEqual(['tag1', 'tag2', 'tag3']);
    expect(parseAdditionalTags(' single ')).toEqual(['single']);
    expect(parseAdditionalTags(' Foo |Bar  | baz')).toEqual(['Foo', 'Bar', 'baz']);
  });

  test('drops empty and whitespace-only segments', () => {
    expect(parseAdditionalTags('a||b')).toEqual(['a', 'b']);
    expect(parseAdditionalTags('a| |b')).toEqual(['a', 'b']);
    expect(parseAdditionalTags('|a')).toEqual(['a']);
    expect(parseAdditionalTags('a|')).toEqual(['a']);
    expect(parseAdditionalTags(' | ')).toEqual([]);
  });
});
