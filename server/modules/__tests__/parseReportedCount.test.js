/* eslint-env jest */

const parseReportedCount = require('../parseReportedCount');

describe('parseReportedCount', () => {
  test('accepts a non-negative integer', () => {
    expect(parseReportedCount(449)).toBe(449);
  });

  test('accepts zero', () => {
    expect(parseReportedCount(0)).toBe(0);
  });

  test('accepts a numeric string', () => {
    expect(parseReportedCount('87')).toBe(87);
  });

  test.each([
    ['null', null],
    ['undefined', undefined],
    ['an empty string', ''],
    ['a blank string', ' '],
    ['a boolean', true],
    ['an array', []],
    ['a negative number', -1],
    ['a fraction', 1.5],
    ['NaN', NaN],
    ['a non-numeric string', 'lots'],
  ])('rejects %s', (_label, value) => {
    expect(parseReportedCount(value)).toBeNull();
  });
});
