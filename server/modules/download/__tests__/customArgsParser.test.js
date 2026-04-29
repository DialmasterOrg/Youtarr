/* eslint-env jest */
const { tokenize, validate, normalizeFlag, ParseError, MAX_CUSTOM_ARGS_LENGTH, BLOCKED_FLAGS } = require('../customArgsParser');

describe('customArgsParser.tokenize', () => {
  test('returns empty array for empty / whitespace-only input', () => {
    expect(tokenize('')).toEqual([]);
    expect(tokenize('   ')).toEqual([]);
    expect(tokenize('\n\t')).toEqual([]);
  });

  test('splits bare flags on whitespace', () => {
    expect(tokenize('--no-mtime --no-warnings')).toEqual(['--no-mtime', '--no-warnings']);
  });

  test('splits flags-with-values on whitespace', () => {
    expect(tokenize('--concurrent-fragments 4 --retries 5'))
      .toEqual(['--concurrent-fragments', '4', '--retries', '5']);
  });

  test('preserves single-quoted values as one token (quotes stripped)', () => {
    expect(tokenize('--user-agent \'Mozilla/5.0 spaces inside\''))
      .toEqual(['--user-agent', 'Mozilla/5.0 spaces inside']);
  });

  test('preserves double-quoted values as one token (quotes stripped)', () => {
    expect(tokenize('--user-agent "Mozilla 5.0 spaces"'))
      .toEqual(['--user-agent', 'Mozilla 5.0 spaces']);
  });

  test('handles backslash-escaped spaces inside unquoted tokens', () => {
    expect(tokenize('--match-title hello\\ world'))
      .toEqual(['--match-title', 'hello world']);
  });

  test('throws ParseError on unterminated single quote', () => {
    expect(() => tokenize('--user-agent \'unterminated'))
      .toThrow(ParseError);
  });

  test('throws ParseError on unterminated double quote', () => {
    expect(() => tokenize('--user-agent "unterminated'))
      .toThrow(ParseError);
  });

  test('exports MAX_CUSTOM_ARGS_LENGTH = 2000', () => {
    expect(MAX_CUSTOM_ARGS_LENGTH).toBe(2000);
  });
});

describe('customArgsParser.validate', () => {
  test('returns ok=true for empty token list', () => {
    expect(validate([])).toEqual({ ok: true });
  });

  test('returns ok=true for an allowed flag', () => {
    expect(validate(['--no-mtime'])).toEqual({ ok: true });
    expect(validate(['--concurrent-fragments', '4'])).toEqual({ ok: true });
    expect(validate(['--retries', '5'])).toEqual({ ok: true });
  });

  test.each([
    ['--exec'],
    ['--exec-before-download'],
    ['--netrc-cmd'],
    ['-o'],
    ['--output'],
    ['-P'],
    ['--paths'],
    ['--print-to-file'],
    ['--external-downloader'],
    ['--downloader'],
    ['--external-downloader-args'],
    ['--downloader-args'],
    ['--config-location'],
    ['--config-locations'],
    ['--batch-file'],
    ['--load-info-json'],
    ['--cookies'],
    ['--cookies-from-browser'],
    ['--download-archive'],
    ['--ffmpeg-location'],
    ['--proxy'],
    ['-4'],
    ['--force-ipv4'],
    ['-6'],
    ['--force-ipv6'],
    ['--limit-rate'],
    ['--sleep-requests'],
  ])('rejects denylisted flag %s with the flag name in the error', (flag) => {
    const result = validate([flag, 'value']);
    expect(result.ok).toBe(false);
    expect(result.error).toContain(flag);
  });

  test('rejects when a denylisted flag appears later in the token list', () => {
    const result = validate(['--no-mtime', '--exec', 'rm -rf']);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('--exec');
  });

  test('exports BLOCKED_FLAGS as a Set', () => {
    expect(BLOCKED_FLAGS).toBeInstanceOf(Set);
    expect(BLOCKED_FLAGS.has('--exec')).toBe(true);
  });

  describe('positional-token rejection', () => {
    test('rejects when the first token is not a flag', () => {
      const result = validate(['dddd', 'wwew']);
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/positional/i);
      expect(result.error).toContain('dddd');
    });

    test('rejects a single non-flag token (e.g. user typed rate limit value here)', () => {
      const result = validate(['5M']);
      expect(result.ok).toBe(false);
      expect(result.error).toContain('5M');
    });

    // Note: the heuristic cannot distinguish no-value flags (like --no-mtime)
    // from value-taking flags without yt-dlp's full flag table. A stray
    // positional immediately after a no-value flag will be accepted here and
    // caught later by yt-dlp's own argparse during dry-run.

    test('accepts a non-flag token when it follows a flag (treated as value)', () => {
      expect(validate(['--retries', '5'])).toEqual({ ok: true });
      expect(validate(['--user-agent', 'Mozilla/5.0'])).toEqual({ ok: true });
      expect(validate(['--concurrent-fragments', '4', '--retries', '5'])).toEqual({ ok: true });
    });

    test('accepts a sequence of bare flags (no values)', () => {
      expect(validate(['--no-mtime', '--no-warnings'])).toEqual({ ok: true });
    });
  });

  describe('denylist normalization', () => {
    test.each([
      ['--exec=rm -rf /', '--exec'],
      ['--exec-before-download=evil', '--exec-before-download'],
      ['--netrc-cmd=id', '--netrc-cmd'],
      ['--output=/tmp/x', '--output'],
      ['--paths=/tmp/dir', '--paths'],
      ['--print-to-file=__t__', '--print-to-file'],
      ['--external-downloader=curl', '--external-downloader'],
      ['--downloader=curl', '--downloader'],
      ['--external-downloader-args=curl:--foo', '--external-downloader-args'],
      ['--downloader-args=curl:--foo', '--downloader-args'],
      ['--config-location=/tmp/cfg', '--config-location'],
      ['--config-locations=/tmp/cfg', '--config-locations'],
      ['--batch-file=/etc/passwd', '--batch-file'],
      ['--load-info-json=/tmp/info', '--load-info-json'],
      ['--cookies=/tmp/c.txt', '--cookies'],
      ['--cookies-from-browser=firefox', '--cookies-from-browser'],
      ['--download-archive=/tmp/a', '--download-archive'],
      ['--ffmpeg-location=/tmp/ff', '--ffmpeg-location'],
      ['--proxy=http://x', '--proxy'],
      ['--limit-rate=5M', '--limit-rate'],
      ['--sleep-requests=10', '--sleep-requests'],
      ['--force-ipv4=1', '--force-ipv4'],
      ['--force-ipv6=1', '--force-ipv6'],
    ])('rejects long denylisted flag in --flag=value form: %s', (token, expectedFlag) => {
      const result = validate([token]);
      expect(result.ok).toBe(false);
      expect(result.error).toContain(expectedFlag);
    });

    test.each([
      ['-o/tmp/x', '-o'],
      ['-P/tmp/dir', '-P'],
    ])('rejects denylisted short flag with attached value: %s', (token, expectedFlag) => {
      const result = validate([token]);
      expect(result.ok).toBe(false);
      expect(result.error).toContain(expectedFlag);
    });

    test('does not strip unrelated short flags (e.g. --no-mtime stays intact)', () => {
      expect(validate(['--no-mtime'])).toEqual({ ok: true });
    });

    test('does not falsely reject long flags whose name contains a denylisted prefix', () => {
      // --output-na-placeholder is a real yt-dlp flag and should not be conflated with --output
      expect(validate(['--output-na-placeholder', 'Unknown'])).toEqual({ ok: true });
    });

    test('rejects print-to-file equals form before FILE can look like a flag value', () => {
      const result = validate(tokenize('--print-to-file=__t__ /tmp/x'));
      expect(result.ok).toBe(false);
      expect(result.error).toContain('--print-to-file');
    });
  });

  describe('normalizeFlag', () => {
    test('returns long flags without value unchanged', () => {
      expect(normalizeFlag('--retries')).toBe('--retries');
    });

    test('strips =value from long flags', () => {
      expect(normalizeFlag('--exec=rm')).toBe('--exec');
      expect(normalizeFlag('--config-locations=/tmp/x')).toBe('--config-locations');
    });

    test('strips attached value from known short flags only', () => {
      expect(normalizeFlag('-o/tmp/x')).toBe('-o');
      expect(normalizeFlag('-P/tmp/dir')).toBe('-P');
      // -4 does not take a value; do not strip
      expect(normalizeFlag('-4')).toBe('-4');
      // Unknown short flag bundle: leave intact (yt-dlp will reject it)
      expect(normalizeFlag('-bogus')).toBe('-bogus');
    });

    test('returns non-flag tokens unchanged', () => {
      expect(normalizeFlag('foo')).toBe('foo');
      expect(normalizeFlag('5M')).toBe('5M');
      expect(normalizeFlag('')).toBe('');
    });
  });
});
