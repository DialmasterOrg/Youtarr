import {
  MAX_CUSTOM_ARGS_LENGTH,
  tokenizeArgs,
  getPositionalTokenInArgs,
  validateRateLimit,
} from '../ytdlpOptionsHelpers';

describe('ytdlpOptionsHelpers', () => {
  test('exports MAX_CUSTOM_ARGS_LENGTH = 2000', () => {
    expect(MAX_CUSTOM_ARGS_LENGTH).toBe(2000);
  });

  describe('tokenizeArgs', () => {
    test('returns empty array for empty input', () => {
      expect(tokenizeArgs('')).toEqual([]);
      expect(tokenizeArgs('   ')).toEqual([]);
    });

    test('preserves quoted multi-word values as one token', () => {
      expect(tokenizeArgs('--user-agent "Mozilla 5.0"'))
        .toEqual(['--user-agent', 'Mozilla 5.0']);
      expect(tokenizeArgs("--match-title 'foo bar baz'"))
        .toEqual(['--match-title', 'foo bar baz']);
    });

    test('handles escaped spaces outside single quotes', () => {
      expect(tokenizeArgs('--match-title hello\\ world'))
        .toEqual(['--match-title', 'hello world']);
    });
  });

  describe('getPositionalTokenInArgs', () => {
    test('rejects the first token when it is not a flag', () => {
      expect(getPositionalTokenInArgs('5M')).toBe('5M');
    });

    test('allows non-flag values immediately after flags', () => {
      expect(getPositionalTokenInArgs('--retries 5')).toBeNull();
      expect(getPositionalTokenInArgs('--user-agent "Mozilla 5.0"')).toBeNull();
      expect(getPositionalTokenInArgs('--match-title "foo bar baz"')).toBeNull();
    });

    test('rejects a non-flag after another non-flag', () => {
      expect(getPositionalTokenInArgs('--match-title foo bar')).toBe('bar');
    });
  });

  describe('validateRateLimit', () => {
    test.each(['', '5M', '500K', '1.5M', '1500'])('accepts %s', (value) => {
      expect(validateRateLimit(value)).toBeNull();
    });

    test.each(['5MB', '5 M', 'fast', '5.M', '5M/s'])('rejects %s', (value) => {
      expect(validateRateLimit(value)).toMatch(/invalid rate format/i);
    });
  });
});
