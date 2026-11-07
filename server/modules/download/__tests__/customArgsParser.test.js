/* eslint-env jest */
const {
  tokenize,
  checkCustomArgs,
  summarize,
  describeCheckFailure,
  ParseError,
  MAX_CUSTOM_ARGS_LENGTH,
} = require('../customArgsParser');

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
    expect(() => tokenize('--user-agent \'unterminated')).toThrow(ParseError);
  });

  test('throws ParseError on unterminated double quote', () => {
    expect(() => tokenize('--user-agent "unterminated')).toThrow(ParseError);
  });

  test('exports MAX_CUSTOM_ARGS_LENGTH = 2000', () => {
    expect(MAX_CUSTOM_ARGS_LENGTH).toBe(2000);
  });
});

describe('customArgsParser.checkCustomArgs', () => {
  test('empty input is ok with no args', () => {
    expect(checkCustomArgs('')).toEqual({ ok: true, args: [], blocked: [], warnings: [], errors: [] });
    expect(checkCustomArgs('   ')).toEqual({ ok: true, args: [], blocked: [], warnings: [], errors: [] });
  });

  test('allowed flags pass through as canonical names', () => {
    const r = checkCustomArgs('--no-mtime --concurrent-fragments 4 --retries 5');
    expect(r.ok).toBe(true);
    expect(r.args).toEqual(['--no-mtime', '--concurrent-fragments', '4', '--retries', '5']);
    expect(r.blocked).toEqual([]);
    expect(r.warnings).toEqual([]);
  });

  test.each([
    '--no-allow-unplayable-formats',
    '--no-restrict-filenames',
    '--no-colors',
  ])('allows %s (a yt-dlp default Youtarr does not override) without a warning', (input) => {
    const r = checkCustomArgs(input);
    expect(r).toEqual({ ok: true, args: [input], blocked: [], warnings: [], errors: [] });
  });

  test('unterminated quote is reported as an error, not a throw', () => {
    const r = checkCustomArgs('--user-agent "unterminated');
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/quote/i);
    expect(r.args).toEqual([]);
  });

  describe('resolves abbreviations and short forms to canonical names', () => {
    test.each([
      ['-N 4', ['--concurrent-fragments', '4']],
      ['--embed-th', ['--embed-thumbnail']],
      ['--format=best', ['--format', 'best']],
      ['--write-srt', ['--write-subs']],
      ['--match-f "re:x"', ['--match-filters', 're:x']],
    ])('%s -> canonical', (input, expectedArgs) => {
      const r = checkCustomArgs(input);
      expect(r.ok).toBe(true);
      expect(r.args).toEqual(expectedArgs);
    });

    test('grouped short options expand (e.g. -iw)', () => {
      // -i => --ignore-errors (allow), -w => --no-overwrites (allow)
      const r = checkCustomArgs('-iw');
      expect(r.ok).toBe(true);
      expect(r.args).toEqual(['--ignore-errors', '--no-overwrites']);
    });

    test('a value-taking short option consumes the attached value (-N4)', () => {
      const r = checkCustomArgs('-N4');
      expect(r.ok).toBe(true);
      expect(r.args).toEqual(['--concurrent-fragments', '4']);
    });
  });

  describe('blocks the known bypass vectors (resolved, with the rest kept)', () => {
    test.each([
      '--use-postprocessor X',
      '--postprocessor-args foo',
      '--ppa foo',
      '--parse-metadata foo',
      '--exec-before-d "touch /tmp/x"',
      '--netrc-c "id"',
      '-a /etc/passwd',
      '-U',
      '--update-to owner/repo@tag',
      '--plugin-dirs /media',
      '--enable-file-urls',
      '--print-to-file foo bar',
      '--exec "rm -rf /"',
      '--add-headers "Cookie: SID=abc"',
    ])('blocks %s', (input) => {
      const r = checkCustomArgs(input);
      expect(r.ok).toBe(false);
      expect(r.blocked.length).toBeGreaterThanOrEqual(1);
      expect(r.args).toEqual([]);
    });

    test('a blocked flag does not drop the allowed flags around it', () => {
      const r = checkCustomArgs('--no-mtime --exec "rm -rf /" --retries 5');
      expect(r.ok).toBe(false);
      expect(r.args).toEqual(['--no-mtime', '--retries', '5']);
      expect(r.blocked).toHaveLength(1);
      expect(r.blocked[0].option).toBe('--exec');
      expect(r.blocked[0].reason).toMatch(/run programs|load code/i);
    });

    test('blocked entry records what the user typed and the canonical name', () => {
      const r = checkCustomArgs('--exec-before-d "x"');
      expect(r.blocked[0].given).toBe('--exec-before-d');
      expect(r.blocked[0].option).toBe('--exec-before-download');
    });

    test('--no-exec is blocked because it would remove Youtarr\'s own post-processing', () => {
      const r = checkCustomArgs('--no-exec');
      expect(r.blocked[0].option).toBe('--no-exec');
      expect(r.blocked[0].reason).toMatch(/post-processing/i);
    });

    test('--add-headers is blocked because headers can carry cookies into the logs', () => {
      const r = checkCustomArgs('--add-headers "Accept-Language: en"');
      expect(r.blocked[0].option).toBe('--add-headers');
      expect(r.blocked[0].reason).toMatch(/cookies/i);
    });

    test('never leaks a blocked option value', () => {
      const secret = 'SECRETVALUE123';
      const r = checkCustomArgs(`--password ${secret}`);
      expect(r.ok).toBe(false);
      expect(JSON.stringify(r)).not.toContain(secret);
    });
  });

  describe('warnings (accepted, flagged)', () => {
    test('a warn-bucket flag is accepted but recorded as a warning', () => {
      const r = checkCustomArgs('--extract-audio');
      expect(r.ok).toBe(true);
      expect(r.args).toEqual(['--extract-audio']);
      expect(r.warnings).toHaveLength(1);
      expect(r.warnings[0].option).toBe('--extract-audio');
    });

    test.each([
      ['--merge-output-format mkv', '--merge-output-format', /\.mp4/],
      ['--remux-video mkv', '--remux-video', /\.mp4/],
      ['--recode-video webm', '--recode-video', /\.mp4/],
      ['--audio-format m4a', '--audio-format', /\.mp3/],
      ['--no-keep-video', '--no-keep-video', /MP3/],
      ['--split-chapters', '--split-chapters', /chapter/i],
      ['--convert-thumbnails png', '--convert-thumbnails', /thumbnail/i],
      ['--no-write-thumbnail', '--no-write-thumbnail', /thumbnail/i],
      ['--no-windows-filenames', '--no-windows-filenames', /filename/i],
      ['--no-sponsorblock', '--no-sponsorblock', /SponsorBlock/],
      ['--no-abort-on-error', '--no-abort-on-error', /post-processing/i],
    ])('%s is accepted with a warning about what Youtarr expects', (input, option, reason) => {
      const r = checkCustomArgs(input);
      expect(r.ok).toBe(true);
      expect(r.warnings).toEqual([{ given: option, option, reason: expect.stringMatching(reason) }]);
    });

    test('--no-match-filters warns that it clears Youtarr filters', () => {
      const r = checkCustomArgs('--no-match-filters');
      expect(r.ok).toBe(true);
      expect(r.warnings[0].option).toBe('--no-match-filters');
      expect(r.warnings[0].reason).toMatch(/filter/i);
    });
  });

  describe('optparse-faithful value handling', () => {
    test('a value that starts with a dash is still consumed as a value', () => {
      const r = checkCustomArgs('--match-title -weird');
      expect(r.ok).toBe(true);
      expect(r.args).toEqual(['--match-title', '-weird']);
    });

    test('a value-taking option at the very end is an error (would eat the URL)', () => {
      const r = checkCustomArgs('--format');
      expect(r.ok).toBe(false);
      expect(r.errors.join(' ')).toMatch(/--format/);
      expect(r.errors.join(' ')).toMatch(/value/i);
    });

    test('a two-value option consumes both values', () => {
      // --print-to-file is blocked, but arity 2 must be consumed so the trailing
      // token does not become a stray positional error.
      const r = checkCustomArgs('--print-to-file title out.txt --no-mtime');
      expect(r.blocked).toHaveLength(1);
      expect(r.errors).toEqual([]);
      expect(r.args).toEqual(['--no-mtime']);
    });
  });

  describe('ambiguous and unknown', () => {
    test('an ambiguous prefix is an error naming the candidates', () => {
      const r = checkCustomArgs('--sub x');
      expect(r.ok).toBe(false);
      expect(r.errors.join(' ')).toMatch(/--sub-format/);
      expect(r.errors.join(' ')).toMatch(/--sub-langs/);
    });

    test('an unknown long option is blocked as unrecognized', () => {
      const r = checkCustomArgs('--totally-made-up');
      expect(r.ok).toBe(false);
      expect(r.blocked[0].option).toBe('--totally-made-up');
      expect(r.blocked[0].reason).toMatch(/recognize/i);
    });

    test('an unknown short option is blocked', () => {
      const r = checkCustomArgs('-Z');
      expect(r.ok).toBe(false);
      expect(r.blocked.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('summarize', () => {
    test('projects only blocked/warnings/errors (drops args)', () => {
      const check = checkCustomArgs('--no-mtime --exec rm --extract-audio');
      const summary = summarize(check);
      expect(summary).toEqual({
        blocked: check.blocked,
        warnings: check.warnings,
        errors: check.errors,
      });
      expect(summary).not.toHaveProperty('args');
      expect(summary).not.toHaveProperty('ok');
    });
  });

  describe('describeCheckFailure', () => {
    test('names a blocked option and its reason', () => {
      const message = describeCheckFailure(checkCustomArgs('--exec rm'));
      expect(message).toMatch(/^Custom yt-dlp options are not valid: /);
      expect(message).toMatch(/--exec \(can run programs/);
    });

    test('names parse errors and blocked options together', () => {
      const message = describeCheckFailure(checkCustomArgs('stray --exec rm'));
      expect(message).toMatch(/"stray" looks like a positional argument/);
      expect(message).toMatch(/Not allowed: --exec/);
    });

    test('never includes a blocked option value', () => {
      const message = describeCheckFailure(checkCustomArgs('--password SECRETVALUE123'));
      expect(message).not.toContain('SECRETVALUE123');
    });
  });

  describe('stray positional tokens', () => {
    test('a leading non-flag token is an error', () => {
      const r = checkCustomArgs('dddd wwew');
      expect(r.ok).toBe(false);
      expect(r.errors.join(' ')).toMatch(/dddd/);
      expect(r.errors.join(' ')).toMatch(/positional/i);
    });

    test('a bare value where a flag is expected is an error', () => {
      const r = checkCustomArgs('--no-mtime 5M');
      expect(r.ok).toBe(false);
      expect(r.errors.join(' ')).toMatch(/5M/);
    });
  });
});
