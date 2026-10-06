// Runs the real Python script: the point of this module is matching Python's
// re semantics exactly, which a mocked child process could not verify.
const titleFilterRegex = require('../titleFilterRegex');

describe('titleFilterRegex', () => {
  describe('checkSyntax', () => {
    test('accepts a valid pattern', () => {
      expect(titleFilterRegex.checkSyntax('Episode \\d+')).toEqual({ valid: true });
    });

    test('accepts Python-only named groups', () => {
      expect(titleFilterRegex.checkSyntax('(?P<num>\\d+)')).toEqual({ valid: true });
    });

    test('rejects a pattern that does not compile', () => {
      const result = titleFilterRegex.checkSyntax('[unclosed');
      expect(result.valid).toBe(false);
    });

    test('reports the Python compile error', () => {
      const result = titleFilterRegex.checkSyntax('[unclosed');
      expect(result.error).toMatch(/Invalid regex pattern/);
    });
  });

  describe('matchTitles', () => {
    test('returns one result per title in order', async () => {
      await expect(titleFilterRegex.matchTitles('Episode \\d+', ['Episode 12', 'Trailer', 'Episode 3']))
        .resolves.toEqual([true, false, true]);
    });

    test('matches case-sensitively like yt-dlp', async () => {
      await expect(titleFilterRegex.matchTitles('review', ['REVIEW'])).resolves.toEqual([false]);
    });

    test('honors an inline (?i) flag', async () => {
      await expect(titleFilterRegex.matchTitles('(?i)review', ['REVIEW'])).resolves.toEqual([true]);
    });

    test('handles non-ASCII titles', async () => {
      await expect(titleFilterRegex.matchTitles('Café', ['Le Café 🎬'])).resolves.toEqual([true]);
    });

    test('resolves an empty list without spawning Python', async () => {
      await expect(titleFilterRegex.matchTitles('[unclosed', [])).resolves.toEqual([]);
    });

    test('rejects when the pattern does not compile', async () => {
      await expect(titleFilterRegex.matchTitles('[unclosed', ['x'])).rejects.toThrow(/Invalid regex pattern/);
    });
  });

  describe('checkPatterns', () => {
    test('reports null for each pattern that compiles', async () => {
      await expect(titleFilterRegex.checkPatterns(['(?i)Ep(?P<episode>[0-9]+)', '(?i:Ep(?:[0-9]+))']))
        .resolves.toEqual([null, null]);
    });

    test('reports the compile error of a pattern that does not', async () => {
      const [error] = await titleFilterRegex.checkPatterns(['[unclosed']);
      expect(error).toMatch(/unterminated character set/);
    });

    test('resolves an empty list without spawning Python', async () => {
      await expect(titleFilterRegex.checkPatterns([])).resolves.toEqual([]);
    });
  });

  describe('classifyTitles', () => {
    const patterns = [
      { regex: '(?i)Episode (?P<episode>[0-9]+): (?P<title>.+)$', excludes: ['(?i:official clip)'] },
      { regex: '(?i)(?P<title>.+?) \\| Official Clip' },
    ];

    test('returns the first matching pattern with its named groups', async () => {
      const [result] = await titleFilterRegex.classifyTitles(patterns, ['Episode 20: It\'s All Relative']);
      expect(result).toEqual({ index: 0, groups: { episode: '20', title: 'It\'s All Relative' } });
    });

    test('passes a title an exclude term rejects on to the next pattern', async () => {
      const [result] = await titleFilterRegex.classifyTitles(patterns, ['Episode 1: Bel battles Quadra | Official Clip']);
      expect(result.index).toBe(1);
    });

    test('returns null for a title no pattern matches', async () => {
      await expect(titleFilterRegex.classifyTitles(patterns, ['Behind the scenes'])).resolves.toEqual([null]);
    });

    test('returns null for a group that did not take part in the match', async () => {
      const [result] = await titleFilterRegex.classifyTitles(
        [{ regex: 'Ep(?P<episode>[0-9]+)(?: Part (?P<part>[0-9]+))?' }],
        ['Ep4']
      );
      expect(result.groups).toEqual({ episode: '4', part: null });
    });

    test('does not read non-ASCII digits as numbers', async () => {
      await expect(titleFilterRegex.classifyTitles(patterns, ['Episode ２０: Title'])).resolves.toEqual([null]);
    });

    test('rejects when a pattern does not compile', async () => {
      await expect(titleFilterRegex.classifyTitles([{ regex: '[unclosed' }], ['x'])).rejects.toThrow(/Invalid regex pattern/);
    });

    test('resolves an empty title list without spawning Python', async () => {
      await expect(titleFilterRegex.classifyTitles(patterns, [])).resolves.toEqual([]);
    });
  });
});

describe('titleFilterRegex timeouts', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.dontMock('child_process');
  });

  it('refuses a pattern that runs too long as a bad request, with a readable message', async () => {
    jest.useFakeTimers();
    const { EventEmitter } = require('events');
    const child = Object.assign(new EventEmitter(), {
      stdout: new EventEmitter(), stderr: new EventEmitter(), stdin: { end: jest.fn(), on: jest.fn() }, kill: jest.fn(),
    });
    let slow;
    jest.isolateModules(() => {
      jest.doMock('child_process', () => ({ spawn: jest.fn(() => child), execFileSync: jest.fn() }));
      slow = require('../titleFilterRegex');
    });
    const result = slow.classifyTitles([{ regex: '(a+)+$' }], ['aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa!']);
    jest.advanceTimersByTime(15000);
    await expect(result).rejects.toMatchObject({ status: 400, message: expect.stringMatching(/took too long/) });
  });
});
