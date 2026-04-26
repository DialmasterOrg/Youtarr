import {
  MAX_CUSTOM_ARGS_LENGTH,
  BLOCKED_FLAGS,
  normalizeFlag,
  tokenizeForDenylistCheck,
  getBlockedFlagInArgs,
  getPositionalTokenInArgs,
  validateRateLimit,
} from '../ytdlpOptionsHelpers';

describe('ytdlpOptionsHelpers', () => {
  describe('tokenizeForDenylistCheck', () => {
    test('returns empty array for empty input', () => {
      expect(tokenizeForDenylistCheck('')).toEqual([]);
      expect(tokenizeForDenylistCheck('   ')).toEqual([]);
    });

    test('preserves quoted multi-word values as one token', () => {
      expect(tokenizeForDenylistCheck('--user-agent "Mozilla 5.0"'))
        .toEqual(['--user-agent', 'Mozilla 5.0']);
      expect(tokenizeForDenylistCheck("--match-title 'foo bar baz'"))
        .toEqual(['--match-title', 'foo bar baz']);
    });

    test('handles escaped spaces outside single quotes', () => {
      expect(tokenizeForDenylistCheck('--match-title hello\\ world'))
        .toEqual(['--match-title', 'hello world']);
    });
  });

  describe('normalizeFlag', () => {
    test('strips values from long --flag=value tokens', () => {
      expect(normalizeFlag('--exec=rm')).toBe('--exec');
      expect(normalizeFlag('--external-downloader=curl')).toBe('--external-downloader');
    });

    test('strips attached values from known short flags only', () => {
      expect(normalizeFlag('-o/tmp/x')).toBe('-o');
      expect(normalizeFlag('-P/tmp/dir')).toBe('-P');
      expect(normalizeFlag('-4')).toBe('-4');
      expect(normalizeFlag('-bogus')).toBe('-bogus');
    });

    test('returns non-flag tokens unchanged', () => {
      expect(normalizeFlag('foo')).toBe('foo');
      expect(normalizeFlag('')).toBe('');
    });
  });

  describe('getBlockedFlagInArgs', () => {
    test.each([
      ['--exec foo', '--exec'],
      ['--netrc-cmd "id"', '--netrc-cmd'],
      ['--external-downloader curl', '--external-downloader'],
      ['--downloader curl', '--downloader'],
      ['--external-downloader-args curl:--foo', '--external-downloader-args'],
      ['--downloader-args curl:--foo', '--downloader-args'],
      ['--print-to-file=__t__ /tmp/x', '--print-to-file'],
      ['--output=/tmp/x', '--output'],
      ['-o/tmp/x', '-o'],
    ])('returns %s for denylisted input', (input, expected) => {
      expect(getBlockedFlagInArgs(input)).toBe(expected);
    });

    test('returns null for allowed input', () => {
      expect(getBlockedFlagInArgs('--no-mtime --retries 5')).toBeNull();
    });

    test('exports BLOCKED_FLAGS and MAX_CUSTOM_ARGS_LENGTH', () => {
      expect(BLOCKED_FLAGS).toBeInstanceOf(Set);
      expect(BLOCKED_FLAGS.has('--netrc-cmd')).toBe(true);
      expect(MAX_CUSTOM_ARGS_LENGTH).toBe(2000);
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
